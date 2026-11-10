import * as autopilot from './autopilot.ts';
import { HttpError } from './http.ts';
import * as lens from './lens.ts';
import { addDays, cents, usd, type Agent } from './model.ts';
import * as nudge from './nudge.ts';
import { unapproved } from './rules.ts';
import * as scout from './scout.ts';
import { shelf, weekOf } from './scout-rules.ts';
import { friend, state } from './store.ts';

// The inbox: what the agents think needs the person next, each with the one action that does it.
// Today shows it, and push.ts sends each new item as a notification. Nothing runs until the person
// taps it (POST /api/inbox/act), and money still goes through PayPal's approval page, or the PayPal
// they saved for Autopilot, within its weekly cap.

export type Item = {
  /** Stable while the situation lasts, so a notification is sent once. */
  id: string;
  agent: Agent;
  title: string;
  detail: string;
  amount?: number;
  /** The button's label; null when it's only a link. */
  action: string | null;
  href: string;
};
type Entry = Item & { run?: () => Promise<{ approveUrl?: string | null; done: string }> };

const total = (list: { amount: number }[]) => cents(list.reduce((sum, p) => sum + p.amount, 0));
const days = (iso: string) => Math.round((Date.now() - Date.parse(iso)) / 86_400_000);

function entries(): Entry[] {
  const out: Entry[] = [];
  const { week } = state;

  const failed = week.payments.filter((p) => p.status === 'failed');
  if (failed.length) {
    out.push({
      id: `retry-${failed.map((p) => p.id).join('.')}`,
      agent: 'autopilot',
      title: failed.length === 1 ? `Paying ${failed[0].payee} failed` : `${failed.length} payments failed`,
      detail: 'PayPal said no. The money is safe in Flick: try again.',
      amount: total(failed),
      action: 'Retry',
      href: '/autopilot',
      run: async () => (await autopilot.retry(), { done: 'Tried again' }),
    });
  }

  const waiting = unapproved(week);
  if (waiting.length && week.approval?.status !== 'approved') {
    const sum = total(waiting);
    const itself = Boolean(state.autopay && sum <= state.autopay.cap);
    out.push({
      id: `week-${week.starts}`,
      agent: 'autopilot',
      title: `Approve this week: ${waiting.length} payments`,
      detail: itself ? 'Paid with the PayPal you saved for Autopilot: no approval page.' : 'One PayPal approval covers the week; Autopilot pays each on its day.',
      amount: sum,
      action: itself ? 'Pay the week' : 'Approve with PayPal',
      href: '/autopilot',
      run: async () => {
        const { approveUrl } = await autopilot.approve();
        return { approveUrl, done: approveUrl ? 'Opening PayPal' : `Paid ${usd(sum)} with your saved PayPal` };
      },
    });
  }

  // Bills and tags Lens read in the last two weeks and nobody has paid (tips need an amount: open Lens).
  // The same bill snapped twice is one bill; a bill Autopilot already planned this week is in the week.
  const planned = new Set(week.payments.filter((p) => p.status !== 'skipped').map((p) => p.payeeId));
  const unpaid = state.scans.filter((s) => s.status === 'read' && (s.kind === 'bill' || s.kind === 'product' || s.kind === 'tip') && days(s.at) <= 14 && !planned.has(s.payeeId ?? ''));
  const once = unpaid.filter((s, i) => unpaid.findIndex((t) => t.title === s.title && t.amount === s.amount && t.due === s.due) === i);
  for (const s of once.slice(0, 2)) {
    out.push({
      id: `scan-${s.id}`,
      agent: 'lens',
      title: `Pay ${s.title}`,
      detail: [s.summary, s.due && `due ${s.due}`].filter(Boolean).join(', ') || 'Lens read it; it isn\'t paid yet.',
      amount: s.kind === 'tip' ? undefined : s.amount,
      action: s.kind === 'tip' ? null : 'Pay with PayPal',
      href: '/lens',
      run: s.kind === 'tip' ? undefined : async () => ({ approveUrl: (await lens.pay({ scanId: s.id })).approveUrl, done: 'Opening PayPal' }),
    });
  }

  // Requests open a week or more, not reminded in the last three days.
  for (const d of state.debts.filter((d) => d.status === 'requested' && days(d.createdAt) >= 7 && (!d.remindedAt || days(d.remindedAt) >= 3))) {
    const name = friend(d.friendId)?.name ?? 'A friend';
    out.push({
      id: `debt-${d.id}-${d.reminders}`,
      agent: 'nudge',
      title: `${name} owes you ${usd(d.amount)}`,
      detail: `For ${d.what}, ${days(d.createdAt)} days now${d.reminders ? `, ${d.reminders} reminder${d.reminders === 1 ? '' : 's'} so far` : ''}. Nudge writes a friendly one; PayPal sends it.`,
      amount: d.amount,
      action: 'Remind',
      href: '/nudge',
      run: async () => {
        const { text } = await nudge.draft({ debtId: d.id, tone: 'Friendly' });
        await nudge.send({ debtId: d.id, text });
        return { done: `Reminded ${name}` };
      },
    });
  }

  // Scout: the next shop at the cheapest store that has it all, and anything worth stocking up on.
  const v = scout.view();
  const storeName = (id: string) => v.stores.find((s) => s.id === id)?.name ?? id;
  const best = v.basket.quotes.find((q) => !q.missing.length);
  if (v.basket.items.length && best) {
    const usual = v.basket.quotes.find((q) => q.storeId === v.basket.usualStore);
    const saving = usual && !usual.missing.length && usual.storeId !== best.storeId ? cents(usual.total - best.total) : 0;
    out.push({
      id: `shop-${v.today}`,
      agent: 'scout',
      title: `Your ${v.basket.items.length} usuals: ${usd(best.total)} at ${storeName(best.storeId)}`,
      detail: saving > 0 ? `${usd(saving)} less than at ${storeName(v.basket.usualStore)}.` : 'The best price this week.',
      amount: best.total,
      action: 'Buy with PayPal',
      href: '/scout',
      run: async () => ({ approveUrl: (await scout.buy({ storeId: best.storeId, items: v.basket.items })).approveUrl, done: 'Opening PayPal' }),
    });
  }
  const due = new Set(v.basket.items.map((i) => i.productId));
  for (const p of v.products.filter((p) => p.usual && p.stockUp && !due.has(p.id))) {
    const two = [{ productId: p.id, qty: 2 }];
    const q = scout.priceBasket({ items: two }).find((x) => !x.missing.length)!;
    out.push({
      id: `stock-${p.id}-${weekOf(v.today)}`,
      agent: 'scout',
      title: `${p.name} is heading up ${Math.round(p.forecast.change * 100)}%`,
      detail: `It keeps: two now at ${storeName(q.storeId)} are ${usd(q.total)}${q.delivery ? `, delivery included` : ''}.`,
      amount: q.total,
      action: 'Buy two',
      href: '/scout',
      run: async () => ({ approveUrl: (await scout.buy({ storeId: q.storeId, items: two })).approveUrl, done: 'Opening PayPal' }),
    });
  }
  return out;
}

/** What needs the person, most urgent first. */
export const items = (): Item[] => entries().map(({ run: _run, ...item }) => item);

/** Does what an inbox item says. The item must still be there: nothing runs twice. */
export async function act(body: Record<string, unknown>) {
  const entry = entries().find((e) => e.id === body.id);
  if (!entry) throw new HttpError(409, "That's done already, or no longer needed.");
  if (!entry.run) throw new HttpError(409, `Open ${entry.href} to do that.`);
  return entry.run();
}

/**
 * What Flick did for the person this month: what Scout saved against their usual store, what friends
 * paid back, what Autopilot and Lens paid, and how many photos Lens read.
 */
export function impact() {
  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = state.activity.filter((a) => a.at.startsWith(month));

  const usualStore = scout.view().basket.usualStore;
  let saved = 0;
  for (const p of state.scout?.purchases ?? []) {
    if (p.from !== 'scout' || p.storeId === usualStore || p.date.slice(0, 7) !== addDays(state.week.starts, state.week.today).slice(0, 7)) continue;
    const there = shelf(p.productId, usualStore, weekOf(p.date));
    if (there) saved += Math.max(0, there.price - p.price) * p.qty;
  }

  const paid = thisMonth.filter((a) => (a.agent === 'autopilot' || a.agent === 'lens') && /^Paid (?!the week)/.test(a.text) && a.amount);
  return {
    month,
    saved: cents(saved),
    paidBack: total(thisMonth.filter((a) => a.agent === 'nudge' && a.text.includes('paid you back') && a.amount).map((a) => ({ amount: a.amount! }))),
    paid: { count: paid.length, amount: total(paid.map((a) => ({ amount: a.amount! }))) },
    read: thisMonth.filter((a) => a.agent === 'lens' && a.text.startsWith('Read a')).length,
  };
}
