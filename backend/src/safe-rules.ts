import { createHash } from 'node:crypto';
import { addDays, cents, type SafeLine, type SafeSpend } from './model.ts';

// Flick Safe's rules: pure functions, no I/O. What Safe's reader said about a receipt is checked and
// cleaned here, and these rules, not the AI, decide what leaves a Safe (tests: safe-rules.test.ts).
//
// - Only the lines that are for the Safe's purpose count, with their share of the tax and tip.
// - Refused: a Safe that's closed, expired or empty; something that isn't a receipt or a bill; a
//   receipt used before (anywhere, by its shop, date and total, or the file itself); one dated before
//   the Safe was made, or in the future; one with nothing on it for the purpose.
// - Asked of the giver, with nothing paid: a receipt with no date, lines that don't add up to its
//   total, or anything the reader thought looked edited or fake.
// - Otherwise paid at once (the giver said yes when they named the purpose). The lines that aren't
//   for it are never paid from the Safe, by anyone: money given for chocolates only buys chocolates.

/** What Safe's reader reports about a receipt or bill (safe.ts asks for exactly this). */
export type SafeAnswer = {
  kind: 'receipt' | 'bill' | 'other';
  merchant: string;
  date: string;
  currency: string;
  total: number;
  tax: number;
  tip: number;
  lines: { name: string; price: number; fits: boolean; why: string }[];
  signs: string[];
  paypal: string;
};

/** A reader's answer, checked: what a spend is made from. */
export type Proof = Pick<SafeSpend, 'kind' | 'merchant' | 'date' | 'total' | 'tax' | 'tip' | 'lines' | 'signs'> & { currency: string; paypal: string | null };

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const money = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1_000_000 ? cents(v) : 0);
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** The reader's answer, made safe to use: model output is untrusted. */
export function checkProof(answer: Partial<SafeAnswer>): Proof {
  const kind = answer.kind === 'receipt' || answer.kind === 'bill' ? answer.kind : 'other';
  const lines: SafeLine[] = (Array.isArray(answer.lines) ? answer.lines : [])
    .slice(0, 60)
    .map((l) => ({ name: text(l?.name, 80), price: money(l?.price), fits: l?.fits === true, why: text(l?.why, 120) }))
    .filter((l) => l.name && l.price);
  const date = text(answer.date, 10);
  const currency = text(answer.currency, 3).toUpperCase();
  const paypal = text(answer.paypal, 120);
  return {
    kind,
    merchant: text(answer.merchant, 80) || 'A shop',
    date: isDate(date) ? date : null,
    currency: /^[A-Z]{3}$/.test(currency) ? currency : 'USD',
    total: money(answer.total),
    tax: money(answer.tax),
    tip: money(answer.tip),
    lines,
    signs: (Array.isArray(answer.signs) ? answer.signs : []).map((s) => text(s, 140)).filter(Boolean).slice(0, 5),
    paypal: EMAIL.test(paypal) ? paypal.toLowerCase() : null,
  };
}

/** A proof's amounts in USD, at `rate` dollars to its currency. */
export function inUsd(proof: Proof, rate: number): Proof {
  const usd = (n: number) => cents(n * rate);
  return { ...proof, currency: 'USD', total: usd(proof.total), tax: usd(proof.tax), tip: usd(proof.tip), lines: proof.lines.map((l) => ({ ...l, price: usd(l.price) })) };
}

/** Whether a proof's lines, tax and tip add up to its total, within 5 cents. */
export const addsUp = (proof: Pick<Proof, 'lines' | 'tax' | 'tip' | 'total'>) =>
  proof.total > 0 && Math.abs(cents(proof.lines.reduce((sum, l) => sum + l.price, 0) + proof.tax + proof.tip - proof.total)) <= 0.05;

/**
 * What the lines that fit the purpose cost, and what the rest cost, each with its share of the tax
 * and tip (shared by price, as Splitter shares them).
 */
export function shares(proof: Pick<Proof, 'lines' | 'tax' | 'tip'>) {
  const sum = (lines: SafeLine[]) => lines.reduce((s, l) => s + l.price, 0);
  const all = sum(proof.lines);
  const fit = sum(proof.lines.filter((l) => l.fits));
  if (!all) return { fits: 0, rest: 0 };
  const extra = proof.tax + proof.tip;
  const fits = cents(fit + (extra * fit) / all);
  return { fits, rest: cents(all + extra - fits) };
}

/** The same receipt, however it's sent again: its shop (letters and digits), its date and its total. */
export function receiptPrint(proof: Pick<Proof, 'merchant' | 'date' | 'total'>) {
  const shop = proof.merchant.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return `r:${createHash('sha256').update(`${shop}|${proof.date ?? 'no date'}|${proof.total.toFixed(2)}`).digest('hex').slice(0, 32)}`;
}

/** The same file, byte for byte (a photo, PDF or text sent again). Text is compared without its spacing. */
export const filePrint = (data: string, isText = false) =>
  `f:${createHash('sha256').update(isText ? data.replace(/\s+/g, ' ').trim().toLowerCase() : data).digest('hex').slice(0, 32)}`;

export type Terms = {
  purpose: string;
  left: number;
  /** When the Safe was made, and when it ends (ISO). */
  made: string;
  expires: string;
  open: boolean;
};

export type Judgement = {
  /** Paid out of the Safe now. */
  pay: number;
  /** Waits for the giver to allow, and why. */
  ask: number;
  why: string;
  /** Why nothing leaves the Safe for it. */
  refused?: string;
  /** What the Safe won't pay for at all: the lines that aren't for its purpose, with their share of the tax. */
  notPaid?: { amount: number; why: string };
};

const shortDate = (date: string) => new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const names = (lines: SafeLine[]) => {
  const list = lines.map((l) => l.name);
  return list.length <= 2 ? list.join(' and ') : `${list.slice(0, 2).join(', ')} and ${list.length - 2} more`;
};

/**
 * What a receipt gets from a Safe, by the rules above. `usedOn`: when this receipt was last used,
 * if it was. `now` is an ISO time; dates are calendar days in UTC, with a day's grace either way for
 * time zones.
 */
export function judge(proof: Proof, terms: Terms, { now, usedOn }: { now: string; usedOn?: string }): Judgement {
  const no = (refused: string): Judgement => ({ pay: 0, ask: 0, why: '', refused });
  const today = now.slice(0, 10);
  if (!terms.open) return no('This Safe is closed.');
  if (now > terms.expires) return no('This Safe has ended.');
  if (!(terms.left > 0)) return no('Nothing is left in this Safe.');
  if (proof.kind === 'other') return no("That isn't a receipt or a bill.");
  if (usedOn) return no(`This receipt was already used, on ${shortDate(usedOn)}.`);
  if (proof.date && proof.date < addDays(terms.made.slice(0, 10), -1)) return no(`This receipt is from ${shortDate(proof.date)}, before the Safe was made.`);
  if (proof.date && proof.date > addDays(today, 1)) return no(`This receipt is dated ${shortDate(proof.date)}, in the future.`);

  const fitting = proof.lines.filter((l) => l.fits);
  if (!fitting.length) return no(`Nothing on it is for ${terms.purpose}.`);
  const { fits, rest } = shares(proof);

  const doubts = [
    ...(proof.date ? [] : ['It has no date on it.']),
    ...(addsUp(proof) ? [] : ["Its lines don't add up to its total."]),
    ...proof.signs.map((s) => (/[.!?]$/.test(s) ? s : `${s}.`)),
  ];
  const others = proof.lines.filter((l) => !l.fits);
  const notPaid = others.length ? { notPaid: { amount: rest, why: `${names(others)} ${others.length === 1 ? "isn't" : "aren't"} for ${terms.purpose}, so the Safe doesn't pay for ${others.length === 1 ? 'it' : 'them'}.` } } : {};
  if (doubts.length) return { pay: 0, ask: Math.min(fits, terms.left), why: doubts.join(' '), ...notPaid };
  return { pay: Math.min(fits, terms.left), ask: 0, why: '', ...notPaid };
}
