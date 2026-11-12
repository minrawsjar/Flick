// Flick's data model and small pure helpers. Imports nothing, so everything can import it.

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type Day = (typeof DAYS)[number];
export type Agent = 'lens' | 'autopilot' | 'splitter' | 'nudge' | 'scout' | 'safe';

/** Someone Flick pays: a biller, a shop, or a friend. Emails should be PayPal sandbox accounts. */
/** `business`: a business registered on Flick (business.ts), paid at the PayPal it signed in with. */
export type Payee = { id: string; name: string; email: string; icon: 'power' | 'phone' | 'friend' | 'coffee' | 'cart' | 'ball' | 'bag' | 'bill'; business?: string };
export type Friend = { id: string; name: string; email: string; color: string; shape: string };

/** A payment that happened, which Autopilot learns habits from. */
export type Past = { payeeId: string; what: string; amount: number; date: string };

/** Something to pay every month on the same day, e.g. a bill Lens read and you asked to repeat. */
export type Monthly = { payeeId: string; what: string; amount: number; dayOfMonth: number; since: string };

/** Why Autopilot flags a planned payment: a payee never paid before, or an amount well above usual. */
export type Unusual = { kind: 'new-payee' } | { kind: 'above-usual'; percent: number; usual: number };

export type PlannedStatus = 'planned' | 'scheduled' | 'paid' | 'skipped' | 'failed';
export type Planned = {
  id: string;
  payeeId: string;
  payee: string;
  what: string;
  icon: Payee['icon'];
  amount: number;
  day: Day;
  /** Autopilot's reason, from what it has seen. */
  why: string;
  /** Set when it's out of the ordinary, for Autopilot to point out before you approve. */
  unusual?: Unusual;
  status: PlannedStatus;
  payoutBatchId?: string;
  error?: string;
};

export type Week = {
  /** The Monday it starts on, YYYY-MM-DD. */
  starts: string;
  /** -1 is the Sunday before (planning day); 0–6 are Monday to Sunday. Moved on by POST /api/week/tick. */
  today: number;
  payments: Planned[];
  approval?: { orderId: string; status: 'awaiting' | 'approved'; amount: number; captureId?: string };
};

/** What Lens read from a photo. */
export type Scan = {
  id: string;
  at: string;
  kind: 'bill' | 'receipt' | 'product' | 'tip' | 'unknown';
  title: string;
  summary: string;
  amount: number;
  currency: string;
  due: string | null;
  repeats: 'weekly' | 'monthly' | null;
  handle: string | null;
  items: { name: string; price: number }[];
  tax: number;
  tip: number;
  fields: [string, string][];
  status: 'read' | 'awaiting' | 'paid';
  payeeId?: string;
  /** What the photo said, when it wasn't in USD. The amounts above are then in USD (lens.ts). */
  original?: { currency: string; amount: number; rate: number };
  /** A small copy of your photo (a JPEG data URL, 480px at most). Only the newest scans keep one. */
  photo?: string;
};

/** Money a friend owes you, requested with a PayPal invoice. */
export type Debt = {
  id: string;
  friendId: string;
  amount: number;
  what: string;
  createdAt: string;
  invoiceId?: string;
  payerUrl?: string;
  status: 'requested' | 'paid' | 'cancelled';
  reminders: number;
  remindedAt?: string;
  /** The split it's a share of (split.ts), so its friends' shares show together. */
  split?: string;
  /** Asked in Flick Chat (chat.ts), not with an invoice: the friend's PayPal email, and the request's message. */
  chat?: { with: string; message: string };
};

/** A message in Flick Chat (chat.ts), between two people signed in with PayPal. */
export type ChatMessage = {
  id: string;
  at: string;
  /** The PayPal email of whoever sent it. */
  from: string;
  /** text; request (for money); paid (a request was paid); reminder (Nudge's, about a request); note (a change, like pays by itself); safe (money given for a purpose, or a receipt spent from it: safe.ts). */
  kind: 'text' | 'request' | 'paid' | 'reminder' | 'note' | 'safe';
  text?: string;
  amount?: number;
  what?: string;
  /** A bill's photo, for a request: a small JPEG (Lens's copy). Only the newest few keep theirs. */
  photo?: string;
  status?: 'open' | 'paying' | 'paid' | 'declined';
  /** Paid with no tap, as the payer allowed. */
  auto?: boolean;
  /** Paid, but Flick couldn't send it on to the asker's PayPal (yet). */
  payout?: 'failed';
  /** A request's record in the asker's Flick, which Nudge, Today and Money Studio follow. */
  debtId?: string;
  /** A paid message's or reminder's request. */
  about?: string;
  tries?: number;
  /** A Safe's message: the Safe (in the chat's `safes`), and the receipt spent from it, if that's what it's about. A request paid into a Safe: that Safe. */
  safeId?: string;
  spendId?: string;
};

/** A line on a receipt or bill, and whether Safe found it's for the Safe's purpose. */
export type SafeLine = { name: string; price: number; fits: boolean; why: string };

/** A receipt or bill spent from a Safe, as Safe read it and the rules judged it (safe-rules.ts). */
export type SafeSpend = {
  id: string;
  at: string;
  /** A receipt is paid already, so its money goes back to whoever spent it; a bill is paid to the shop. */
  kind: 'receipt' | 'bill' | 'other';
  merchant: string;
  date: string | null;
  total: number;
  tax: number;
  tip: number;
  lines: SafeLine[];
  /** What the reader saw that suggests it isn't a genuine receipt. */
  signs: string[];
  /** What left the Safe for it. */
  paid: number;
  /** What waits for the giver to allow: a doubtful receipt's share, or its lines that aren't for the purpose. */
  ask?: { amount: number; why: string; status: 'open' | 'allowed' | 'declined' };
  /** Why nothing left the Safe for it. */
  refused?: string;
  /** Its lines that aren't for the purpose, which the Safe never pays for, with their share of the tax. */
  notPaid?: { amount: number; why: string };
  /** Where its money goes: the shop's PayPal (a bill), or back to the spender's (a receipt). */
  to?: { kind: 'shop' | 'back'; email: string; name: string; business?: string };
  /** Released, but Flick couldn't send it on to that PayPal (yet). */
  payout?: 'failed';
  /** A small copy of the photo (Lens's kind). Only a Safe's newest few keep theirs. */
  photo?: string;
  /** What makes it the same receipt if it comes again: its shop, date and total, and the file itself. */
  prints: string[];
  /** What it said, when it wasn't in USD; the amounts above are then in USD. */
  original?: { currency: string; total: number; rate: number };
};

/**
 * Money given for one purpose (safe.ts). Flick holds it, in its own PayPal account, and lets it out
 * only against a receipt or bill for that purpose. What's left goes back to the giver at the end.
 */
export type Safe = {
  id: string;
  at: string;
  /** The giver's and the spender's PayPal emails. */
  from: string;
  to: string;
  purpose: string;
  note?: string;
  amount: number;
  left: number;
  expires: string;
  orderId: string;
  /** The giver's payment, which what's left is refunded from. */
  captureId: string;
  status: 'open' | 'closed';
  closed?: { at: string; by: 'giver' | 'spender' | 'expiry'; returned: number };
  spends: SafeSpend[];
};

/** Someone to chat with: a friend, or whoever started a chat with you; on Flick if they've signed in. */
export type ChatPeer = { email: string; name: string; onFlick: boolean; friendId?: string; color: string; shape: string };

/** A PayPal checkout in flight: what to do once it's approved. */
type Paying =
  | { kind: 'week'; orderId: string; amount: number; paymentIds: string[]; status: 'awaiting' | 'captured' | 'cancelled'; save?: boolean }
  | { kind: 'scan'; orderId: string; amount: number; scanId: string; payeeId: string; repeat: boolean; status: 'awaiting' | 'captured' | 'cancelled' }
  | { kind: 'basket'; orderId: string; amount: number; storeId: string; items: { productId: string; qty: number; price: number }[]; status: 'awaiting' | 'captured' | 'cancelled' };
// Its lifecycle, for Money Studio: started (`at`), approved and captured (`captureId`), paid out to
// whoever it's for (`paidOut`, when). Checkouts from before these were kept have none of them.
export type Checkout = Paying & { at?: string; what?: string; captureId?: string; paidOut?: string };

export type Activity = { id: string; at: string; agent: Agent; text: string; amount?: number };

/** Something you bought, item by item, for Scout to learn from: its own history, a receipt Lens read, or a basket Scout bought. */
export type Purchase = { productId: string; storeId: string | null; store: string; price: number; qty: number; date: string; from: 'history' | 'receipt' | 'scout' };

export type State = {
  payees: Payee[];
  friends: Friend[];
  history: Past[];
  monthly: Monthly[];
  week: Week;
  scans: Scan[];
  debts: Debt[];
  checkouts: Record<string, Checkout>;
  activity: Activity[];
  /** Scout's purchases; started on first use (scout.ts), so older state files work as they are. */
  scout?: { purchases: Purchase[] };
  /** Autopilot paying by itself: the PayPal account the person saved for it, and the most it may pay in a week. */
  autopay?: { savedId: string; email?: string; since: string; cap: number };
  /** Who this Flick belongs to, once they've signed in with PayPal (account.ts). */
  profile?: Profile;
  /** A sign-in under way in this browser: the PayPal approval it's waiting for, and the page to go back to. */
  signingIn?: { setupTokenId: string; next: string; at: string };
  /** The last 200 PayPal webhook event IDs processed, newest first. */
  webhookEvents?: string[];
};

/**
 * A person signed in with PayPal. Their PayPal is saved in PayPal's vault (`savedId`), so a flick
 * pays it straight away, with no PayPal page each time.
 */
export type Profile = {
  name: string;
  email: string;
  payerId?: string;
  savedId: string;
  since: string;
  /** They chose `name` in Flick (/profile): signing in again keeps it, rather than PayPal's. */
  named?: boolean;
};

// --- Helpers ------------------------------------------------------------------------

export const id = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
export const cents = (n: number) => Math.round(n * 100) / 100;
export const usd = (n: number) => `$${n.toFixed(2)}`;

// Dates are calendar days in UTC, as YYYY-MM-DD, so time zones never move a payment a day.
export const ymd = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (date: string, n: number) => ymd(new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000));
/** 0 = Monday. */
export const weekday = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
export const mondayOf = (d: Date) => addDays(ymd(d), -weekday(ymd(d)));
/** The same day of the month, `n` months earlier: the month's last day if it's shorter. */
export function monthsBack(date: string, n: number) {
  const [y, m, d] = date.split('-').map(Number);
  const last = new Date(Date.UTC(y, m - n, 0)).getUTCDate();
  return ymd(new Date(Date.UTC(y, m - 1 - n, Math.min(d, last))));
}
export const daysApart = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;
