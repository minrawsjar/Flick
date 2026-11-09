import { addDays, cents, DAYS, usd, weekday, type Monthly, type Past, type Payee, type Planned, type Scan, type Week } from './model.ts';

// Flick's rules: pure functions, no I/O. Planning the week, deciding what's due, splitting a bill,
// and checking what Lens read. Everything that moves money builds on these (tests: rules.test.ts).

const LONG_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const shortDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;

/**
 * Autopilot's plan for the week starting `starts` (a Monday). It only plans what it has seen, from
 * three sources, each giving its reason:
 * - bills Lens read that fall due this week and aren't paid yet;
 * - monthly payments whose day falls this week;
 * - weekly habits: the same payee on the same weekday in at least 3 of the 4 weeks before.
 * It never invents a payee or an amount. One payment per payee per day, bills first.
 */
export function planWeek(
  starts: string,
  { payees, history, monthly, scans }: { payees: Payee[]; history: Past[]; monthly: Monthly[]; scans: Scan[] },
): Planned[] {
  const days = DAYS.map((_, i) => addDays(starts, i));
  const plan = new Map<string, Planned>();
  const add = (payeeId: string, day: number, what: string, amount: number, why: string) => {
    const who = payees.find((p) => p.id === payeeId);
    const key = `${payeeId}@${day}`;
    if (!who || plan.has(key) || !(amount > 0)) return;
    plan.set(key, { id: `${starts}-${key}`, payeeId, payee: who.name, what, icon: who.icon, amount: cents(amount), day: DAYS[day], why, status: 'planned' });
  };

  for (const scan of scans) {
    if (scan.kind !== 'bill' || scan.status === 'paid' || !scan.payeeId || !scan.due || !days.includes(scan.due)) continue;
    add(scan.payeeId, weekday(scan.due), scan.summary || 'Bill', scan.amount, `You snapped this bill on ${shortDate(scan.at.slice(0, 10))}. It's due ${LONG_DAYS[weekday(scan.due)]}, ${shortDate(scan.due)}.`);
  }

  for (const rule of monthly) {
    const day = days.findIndex((d) => Number(d.slice(8)) === rule.dayOfMonth);
    if (day >= 0) add(rule.payeeId, day, rule.what, rule.amount, `Same amount on the ${ordinal(rule.dayOfMonth)}, every month.`);
  }

  // Habits: group the last four weeks by payee and weekday.
  const since = addDays(starts, -28);
  const groups = new Map<string, Past[]>();
  for (const p of history) {
    if (p.date < since || p.date >= starts) continue;
    const key = `${p.payeeId}@${weekday(p.date)}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  for (const [key, paid] of groups) {
    const weeks = new Set(paid.map((p) => Math.floor((Date.parse(p.date) - Date.parse(since)) / (7 * 86_400_000)))).size;
    if (weeks < 3) continue;
    const [payeeId, day] = [key.slice(0, key.lastIndexOf('@')), Number(key.slice(key.lastIndexOf('@') + 1))];
    const amounts = paid.map((p) => p.amount);
    const average = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const same = amounts.every((a) => a === amounts[0]);
    const name = payees.find((p) => p.id === payeeId)?.name ?? 'them';
    const when = weeks === 4 ? `every ${LONG_DAYS[day]} for the last 4 weeks` : `on ${weeks} of the last 4 ${LONG_DAYS[day]}s`;
    const latest = paid.reduce((a, b) => (a.date > b.date ? a : b));
    add(payeeId, day, latest.what, average, `You've paid ${name} ${when}${same ? '' : `, ${usd(average)} on average`}.`);
  }

  return [...plan.values()].sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.payee.localeCompare(b.payee));
}

/** Approved payments whose day has come: Autopilot pays these now. */
export const dueNow = (week: Week) => week.payments.filter((p) => p.status === 'scheduled' && DAYS.indexOf(p.day) <= week.today);

/** Payments still waiting for the week's approval. */
export const unapproved = (week: Week) => week.payments.filter((p) => p.status === 'planned');

// --- Splitting a bill ------------------------------------------------------------------

export type SplitItem = { name: string; price: number; people: string[] };

/**
 * Who owes what. Each item is shared equally by the people who had it; tax and tip follow each
 * person's share of the subtotal. Shares are rounded to cents, and "you" (who paid the bill) take
 * the rounding, so the shares always add up to the total exactly.
 */
export function shares(items: SplitItem[], tax: number, tip: number) {
  const nobody = items.filter((item) => !item.people.length).map((item) => item.name);
  const subtotal = items.filter((item) => item.people.length).reduce((sum, item) => sum + item.price, 0);
  const total = cents(subtotal + tax + tip);
  const raw: Record<string, number> = {};
  for (const item of items) for (const p of item.people) raw[p] = (raw[p] ?? 0) + item.price / item.people.length;

  const each: Record<string, number> = {};
  for (const [p, share] of Object.entries(raw)) if (p !== 'you') each[p] = cents(subtotal ? (share * total) / subtotal : 0);
  each.you = cents(total - Object.values(each).reduce((a, b) => a + b, 0));
  return { total, each, nobody };
}

// --- What Lens read ---------------------------------------------------------------------

/** The model's answer, before checking: see lens.ts for the schema it was asked to fill. */
export type LensAnswer = {
  kind: string;
  title: string;
  summary: string;
  amount: number;
  currency: string;
  due: string;
  repeats: string;
  handle: string;
  items: { name: string; price: number }[];
  tax: number;
  tip: number;
  fields: { key: string; value: string }[];
};

const KINDS = ['bill', 'receipt', 'product', 'tip'] as const;
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const amount = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 100_000 ? cents(v) : 0);
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

/**
 * Model output is untrusted: keep only well-formed values, and never let a guess become money.
 * Anything unreadable becomes kind "unknown" with no amount, which Flick won't offer to pay.
 */
export function checkLens(answer: Partial<LensAnswer>, id: string, at: string): Omit<Scan, 'payeeId'> {
  const kind = KINDS.find((k) => k === answer.kind) ?? 'unknown';
  const items = (Array.isArray(answer.items) ? answer.items : [])
    .slice(0, 50)
    .map((i) => ({ name: text(i?.name, 80), price: amount(i?.price) }))
    .filter((i) => i.name && i.price);
  const due = text(answer.due, 10);
  return {
    id,
    at,
    kind,
    title: text(answer.title, 80) || 'Something to pay',
    summary: text(answer.summary, 120),
    amount: kind === 'unknown' ? 0 : amount(answer.amount),
    currency: /^[A-Z]{3}$/.test(text(answer.currency, 3)) ? text(answer.currency, 3) : 'USD',
    due: isDate(due) ? due : null,
    repeats: answer.repeats === 'weekly' || answer.repeats === 'monthly' ? answer.repeats : null,
    handle: text(answer.handle, 120) || null,
    items: kind === 'receipt' ? items : [],
    tax: amount(answer.tax),
    tip: amount(answer.tip),
    fields: (Array.isArray(answer.fields) ? answer.fields : [])
      .slice(0, 10)
      .map((f): [string, string] => [text(f?.key, 30), text(f?.value, 80)])
      .filter(([k, v]) => k && v),
    status: 'read',
  };
}
