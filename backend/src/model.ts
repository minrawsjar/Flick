// Flick's data model and small pure helpers. Imports nothing, so everything can import it.

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type Day = (typeof DAYS)[number];
export type Agent = 'lens' | 'autopilot' | 'splitter' | 'nudge' | 'scout';

/** Someone Flick pays: a biller, a shop, or a friend. Emails should be PayPal sandbox accounts. */
export type Payee = { id: string; name: string; email: string; icon: 'power' | 'phone' | 'friend' | 'coffee' | 'cart' | 'ball' | 'bag' | 'bill' };
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
};

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
