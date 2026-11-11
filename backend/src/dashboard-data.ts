import {
  amountOf,
  getBalances,
  PayPalApiError,
  listInvoices,
  listPlans,
  listProducts,
  searchTransactions,
  TRANSACTION_SEARCH_MAX_DAYS,
  type Balances,
  type IntervalUnit,
  type Invoice,
  type InvoiceStatus,
  type Plan,
  type Product,
  type Transaction,
} from './paypal.ts';
import { HttpError } from './http.ts';
import { addDays, cents, DAYS, type Checkout } from './model.ts';
import { PRODUCTS } from './scout-rules.ts';
import { friend, inSample, payee, state, workspaceId } from './store.ts';

// Flat rows for the Dashboard's AG Studio data sources. Relationships between them:
//   invoices.customerId        -> customers.id
//   invoiceItems.invoiceId     -> invoices.id
//   invoicePayments.invoiceId  -> invoices.id
//   plans.productId            -> products.id
// Invoice, payment, transaction and payout dates also bind to a shared calendar.

const DAY_MS = 86_400_000;

const round2 = (n: number) => Math.round(n * 100) / 100;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);

// 'BANK_TRANSFER' -> 'Bank transfer'
const humanise = (code: string) => code[0] + code.slice(1).toLowerCase().replaceAll('_', ' ');

// --- Invoices ---------------------------------------------------------------------

const STATUS_GROUP: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  SENT: 'Open',
  UNPAID: 'Open',
  PAYMENT_PENDING: 'Open',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
  MARKED_AS_PAID: 'Paid',
  REFUNDED: 'Refunded',
  PARTIALLY_REFUNDED: 'Refunded',
  MARKED_AS_REFUNDED: 'Refunded',
  CANCELLED: 'Cancelled',
};

// Not yet sent, or withdrawn: nothing was billed.
const UNISSUED = new Set<InvoiceStatus>(['DRAFT', 'SCHEDULED', 'CANCELLED']);
const RECEIVABLE = new Set<InvoiceStatus>(['SENT', 'UNPAID', 'PAYMENT_PENDING', 'PARTIALLY_PAID']);

// Customers have no id of their own in PayPal, so invoices are matched to them by email.
const customerIdOf = (invoice: Invoice) =>
  invoice.primary_recipients?.[0]?.billing_info?.email_address?.toLowerCase() ?? 'unknown';

// Numbered so the buckets sort in age order on chart axes.
function agingBucket(daysOverdue: number) {
  if (daysOverdue <= 0) return '0. Not yet due';
  if (daysOverdue <= 30) return '1. 1-30 days';
  if (daysOverdue <= 60) return '2. 31-60 days';
  if (daysOverdue <= 90) return '3. 61-90 days';
  return '4. 90+ days';
}

function invoiceRows(invoices: Invoice[], today: string) {
  return invoices.map((inv) => {
    const total = amountOf(inv.amount);
    const paid = amountOf(inv.payments?.paid_amount);
    const refunded = amountOf(inv.refunds?.refund_amount);
    const receivable = RECEIVABLE.has(inv.status);
    const outstanding = receivable ? amountOf(inv.due_amount) : 0;
    const dueDate = inv.detail.payment_term?.due_date ?? inv.detail.invoice_date ?? null;
    const daysOverdue = receivable && dueDate ? Math.max(0, daysBetween(dueDate, today)) : 0;
    const firstPayment = inv.payments?.transactions
      ?.map((t) => t.payment_date)
      .filter((d) => d !== undefined)
      .sort()[0];

    return {
      id: inv.id,
      number: inv.detail.invoice_number,
      customerId: customerIdOf(inv),
      status: humanise(inv.status),
      statusGroup: STATUS_GROUP[inv.status],
      currency: inv.detail.currency_code,
      paymentTerm: inv.detail.payment_term?.term_type ? humanise(inv.detail.payment_term.term_type) : null,
      invoiceDate: inv.detail.invoice_date ?? null,
      dueDate,
      total,
      issuedAmount: UNISSUED.has(inv.status) ? 0 : total,
      paidAmount: paid,
      refundedAmount: refunded,
      netCollected: round2(paid - refunded),
      isReceivable: receivable,
      outstanding,
      overdueAmount: daysOverdue > 0 ? outstanding : 0,
      daysOverdue,
      agingBucket: receivable ? agingBucket(daysOverdue) : null,
      daysToPay: firstPayment && inv.detail.invoice_date ? daysBetween(inv.detail.invoice_date, firstPayment) : null,
      taxTotal: amountOf(inv.amount?.breakdown?.tax_total),
    };
  });
}

function customerRows(invoices: Invoice[]) {
  const byId = new Map<string, { id: string; name: string; company: string | null; email: string | null }>();
  for (const inv of invoices) {
    const info = inv.primary_recipients?.[0]?.billing_info;
    const id = customerIdOf(inv);
    if (!byId.has(id)) {
      byId.set(id, {
        id,
        name: info?.name?.full_name ?? info?.email_address ?? 'Unknown',
        // Individuals have no business name; label them so company charts stay readable.
        company: info?.business_name ?? 'Individual',
        email: info?.email_address ?? null,
      });
    }
  }
  return [...byId.values()];
}

function invoiceItemRows(invoices: Invoice[]) {
  return invoices.flatMap((inv) =>
    (inv.items ?? []).map((item, i) => {
      const gross = Number(item.quantity) * amountOf(item.unit_amount);
      const discount = item.discount?.amount ? amountOf(item.discount.amount) : (gross * Number(item.discount?.percent ?? 0)) / 100;
      const tax = item.tax?.amount ? amountOf(item.tax.amount) : ((gross - discount) * Number(item.tax?.percent ?? 0)) / 100;
      return {
        id: item.id ?? `${inv.id}-${i + 1}`,
        invoiceId: inv.id,
        name: item.name,
        unit: item.unit_of_measure ? humanise(item.unit_of_measure) : null,
        quantity: Number(item.quantity),
        unitPrice: amountOf(item.unit_amount),
        gross: round2(gross),
        discount: round2(discount),
        tax: round2(tax),
        lineTotal: round2(gross - discount + tax),
      };
    }),
  );
}

function invoicePaymentRows(invoices: Invoice[]) {
  return invoices.flatMap((inv) => [
    ...(inv.payments?.transactions ?? []).map((t, i) => ({
      id: t.payment_id ?? `${inv.id}-payment-${i + 1}`,
      invoiceId: inv.id,
      kind: 'Payment',
      method: t.method ? humanise(t.method) : 'Unknown',
      date: t.payment_date ?? null,
      amount: amountOf(t.amount),
      signedAmount: amountOf(t.amount),
    })),
    ...(inv.refunds?.transactions ?? []).map((t, i) => ({
      id: t.recipient_transaction_id ?? `${inv.id}-refund-${i + 1}`,
      invoiceId: inv.id,
      kind: 'Refund',
      method: t.method ? humanise(t.method) : 'Unknown',
      date: t.refund_date ?? null,
      amount: amountOf(t.amount),
      signedAmount: -amountOf(t.amount),
    })),
  ]);
}

// --- Catalog ------------------------------------------------------------------------

const MONTHS_PER_INTERVAL: Record<IntervalUnit, number> = { DAY: 12 / 365, WEEK: 12 / 52, MONTH: 1, YEAR: 12 };
const DAYS_PER_INTERVAL: Record<IntervalUnit, number> = { DAY: 1, WEEK: 7, MONTH: 365 / 12, YEAR: 365 };

function productRows(products: Product[]) {
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type ? humanise(p.type) : null,
    category: p.category ? humanise(p.category) : null,
    description: p.description ?? null,
  }));
}

function planRows(plans: Plan[]) {
  return plans.map((plan) => {
    const regular = plan.billing_cycles.find((c) => c.tenure_type === 'REGULAR');
    const trial = plan.billing_cycles.find((c) => c.tenure_type === 'TRIAL');
    const price = regular?.pricing_scheme?.fixed_price ? amountOf(regular.pricing_scheme.fixed_price) : null;
    const unit = regular?.frequency.interval_unit;
    const count = regular?.frequency.interval_count ?? 1;
    return {
      id: plan.id,
      productId: plan.product_id,
      name: plan.name,
      status: humanise(plan.status),
      billingInterval: unit ? (count === 1 ? `Every ${unit.toLowerCase()}` : `Every ${count} ${unit.toLowerCase()}s`) : null,
      price,
      monthlyPrice: price !== null && unit ? round2(price / (count * MONTHS_PER_INTERVAL[unit])) : null,
      trialDays: trial ? Math.round(trial.frequency.interval_count * DAYS_PER_INTERVAL[trial.frequency.interval_unit]) : 0,
      setupFee: amountOf(plan.payment_preferences?.setup_fee),
    };
  });
}

// --- Ledger -------------------------------------------------------------------------

const EVENT_TYPES: Record<string, string> = {
  T0001: 'Payout',
  T1105: 'Hold released',
  T1503: 'Payout hold',
};

const STATUSES: Record<string, string> = {
  S: 'Success',
  P: 'Pending',
  D: 'Denied',
  V: 'Reversed',
  F: 'Partially refunded',
};

const statusOf = (code?: string) => (code ? (STATUSES[code] ?? code) : null);

// Payout custom fields are '<CAMPAIGN>-<yyyy-mm>-<n>', e.g. 'AGGRID-AFFILIATES-2026-09-1'.
const campaignOf = (customField?: string) => {
  const campaign = customField?.match(/^AGGRID-([A-Z]+)-/)?.[1];
  return campaign ? humanise(campaign) : 'Other';
};

function transactionRows(transactions: Transaction[]) {
  return transactions.map(({ transaction_info: t, payer_info: p }) => {
    const amt = amountOf(t.transaction_amount);
    const fee = amountOf(t.fee_amount);
    return {
      id: t.transaction_id,
      date: t.transaction_initiation_date ?? null,
      eventType: EVENT_TYPES[t.transaction_event_code ?? ''] ?? t.transaction_event_code ?? 'Unknown',
      status: statusOf(t.transaction_status),
      direction: amt < 0 ? 'Debit' : 'Credit',
      currency: t.transaction_amount?.currency_code ?? null,
      amount: amt,
      fee,
      net: round2(amt + fee),
      endingBalance: t.ending_balance ? amountOf(t.ending_balance) : null,
      counterparty: p?.email_address ?? null,
      note: t.transaction_note ?? null,
    };
  });
}

// Payouts as positive amounts, so they size treemap tiles and pie slices.
function payoutRows(transactions: Transaction[]) {
  return transactions
    .filter((t) => t.transaction_info.transaction_event_code === 'T0001')
    .map(({ transaction_info: t, payer_info: p }) => ({
      id: t.transaction_id,
      campaign: campaignOf(t.custom_field),
      recipient: p?.email_address ?? 'Unknown',
      date: t.transaction_initiation_date ?? null,
      status: statusOf(t.transaction_status),
      amount: -amountOf(t.transaction_amount),
      fee: -amountOf(t.fee_amount),
      note: t.transaction_note ?? null,
    }));
}

function balanceRows({ balances = [] }: Balances) {
  return balances.map((b) => ({
    currency: b.currency,
    total: amountOf(b.total_balance),
    available: amountOf(b.available_balance),
    withheld: amountOf(b.withheld_balance),
  }));
}

// --- Flick's own data ----------------------------------------------------------------

// What the agents planned, paid, requested and did, from Flick's store (store.ts).
function flickRows() {
  const { week } = state;
  return {
    flickPayments: week.payments.map((p) => ({
      id: p.id,
      payee: p.payee,
      what: p.what,
      amount: p.amount,
      currency: 'USD',
      date: addDays(week.starts, DAYS.indexOf(p.day)),
      status: p.status,
      paid: p.status === 'paid' ? p.amount : 0,
      toPay: p.status === 'planned' || p.status === 'scheduled' ? p.amount : 0,
      reason: p.why,
    })),
    flickHistory: state.history.map((p, i) => ({ id: `h${i}`, payee: payee(p.payeeId)?.name ?? p.payeeId, what: p.what, amount: p.amount, currency: 'USD', date: p.date })),
    flickRequests: state.debts.map((d) => ({
      id: d.id,
      friend: friend(d.friendId)?.name ?? d.friendId,
      what: d.what,
      amount: d.amount,
      currency: 'USD',
      requested: d.createdAt.slice(0, 10),
      status: d.status,
      outstanding: d.status === 'requested' ? d.amount : 0,
      repaid: d.status === 'paid' ? d.amount : 0,
      reminders: d.reminders,
    })),
    flickActivity: state.activity.map((a) => ({ id: a.id, date: a.at.slice(0, 10), agent: a.agent, text: a.text, amount: a.amount ?? null })),
    // Each item Scout bought, from the basket's checkout (one payment to the store holds them all).
    flickPurchases: (state.scout?.purchases ?? [])
      .filter((p) => p.from === 'scout')
      .map((p, i) => {
        const product = PRODUCTS.find((x) => x.id === p.productId);
        return { id: `buy${i}`, date: p.date, product: product?.name ?? p.productId, size: product?.size ?? '', store: p.store, qty: p.qty, price: p.price, total: cents(p.price * p.qty), currency: 'USD' };
      }),
    flickCheckouts: Object.values(state.checkouts)
      .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))
      .map((c) => ({
        id: c.orderId,
        date: c.at?.slice(0, 10) ?? null,
        agent: AGENT_OF[c.kind],
        what: c.what ?? '',
        amount: c.amount,
        currency: 'USD',
        stage: stageOf(c),
        paid: c.status === 'captured' ? c.amount : 0,
      })),
  };
}

const AGENT_OF = { week: 'Autopilot', scan: 'Lens', basket: 'Scout' } as const;

/** Where a payment is in its lifecycle: approved on PayPal, received by Flick, paid out to whoever it's for. */
function stageOf(c: Checkout) {
  if (c.status === 'awaiting') return 'Waiting for your approval';
  if (c.status === 'cancelled') return 'Cancelled on PayPal';
  if (c.kind === 'week') {
    const left = state.week.payments.filter((p) => c.paymentIds.includes(p.id) && p.status !== 'paid').length;
    return left ? `Received by Flick, ${left} to pay out on their days` : 'Paid out';
  }
  return c.paidOut ? 'Paid out' : 'Received by Flick';
}

/** A visitor sees only their own PayPal invoices and payments; "local" (no workspace) sees the whole account. */
function ownOnly(invoices: Invoice[], transactions: Transaction[]) {
  if (workspaceId() === 'local') return { invoices, transactions };
  const invoiceIds = new Set(state.debts.map((d) => d.invoiceId));
  const captureIds = new Set(Object.values(state.checkouts).map((c) => c.captureId));
  return {
    invoices: invoices.filter((i) => invoiceIds.has(i.id)),
    transactions: transactions.filter((t) => captureIds.has(t.transaction_info.transaction_id) || invoiceIds.has(t.transaction_info.paypal_reference_id)),
  };
}

/** Nothing paid or requested yet: Money Studio shows the demo instead, and says so. */
const nothingYet = () => workspaceId() !== 'local' && !Object.keys(state.checkouts).length && !state.debts.length && !state.history.length;

// --- Snapshot -----------------------------------------------------------------------

const TRANSACTION_WINDOW_MS = TRANSACTION_SEARCH_MAX_DAYS * DAY_MS;

export async function getDashboardData(asOf = new Date()) {
  if (!nothingYet()) return dashboard(asOf);
  const sample = await inSample(() => dashboard(asOf, false));
  return { ...sample, warnings: ['This is sample data. Pay something with Lens, Scout or Autopilot, or split a bill, and your own payments show here.', ...sample.warnings] };
}

/** `own`: only the workspace's own PayPal invoices and payments. */
async function dashboard(asOf: Date, own = true) {
  // Transaction search is a separate app feature, off by default and slow to activate. Without it
  // the dashboard still works: those two tables are empty, and it says why.
  const warnings: string[] = [];
  const unlessForbidden = <T>(what: string, fallback: T) => (err: unknown): T => {
    if (!(err instanceof PayPalApiError && err.status === 403)) return orEmpty(what, fallback)(err);
    const off = 'Transactions and balances are empty: turn on Transaction search for your PayPal sandbox app (it can take a few hours to start working).';
    if (!warnings.includes(off)) warnings.push(off);
    return fallback;
  };
  // One PayPal list failing (the sandbox has its moments) leaves just its tables empty, saying so,
  // so the rest, Flick's own tables included, still shows. PayPal being off (no keys) still fails.
  const orEmpty = <T>(what: string, fallback: T) => (err: unknown): T => {
    if (err instanceof HttpError || (err instanceof PayPalApiError && err.status === 401)) throw err;
    console.error(`Money Studio: PayPal's ${what}:`, err instanceof Error ? err.message.slice(0, 300) : err);
    warnings.push(`PayPal's ${what} didn't load just now, so ${what === 'balances' ? 'that table is' : 'those tables are'} empty. Reload to try again.`);
    return fallback;
  };
  const [products, plans, allInvoices, allTransactions, balances] = await Promise.all([
    listProducts().catch(orEmpty<Product[]>('products', [])),
    listPlans().catch(orEmpty<Plan[]>('plans', [])),
    listInvoices().catch(orEmpty<Invoice[]>('invoices', [])),
    searchTransactions(new Date(asOf.getTime() - TRANSACTION_WINDOW_MS), asOf).catch(unlessForbidden<Transaction[]>('transactions', [])),
    getBalances().catch(unlessForbidden<Balances>('balances', {})),
  ]);
  const today = asOf.toISOString().slice(0, 10);
  const { invoices, transactions } = own ? ownOnly(allInvoices, allTransactions) : { invoices: allInvoices, transactions: allTransactions };

  return {
    asOf: asOf.toISOString(),
    warnings,
    customers: customerRows(invoices),
    invoices: invoiceRows(invoices, today),
    invoiceItems: invoiceItemRows(invoices),
    invoicePayments: invoicePaymentRows(invoices),
    products: productRows(products),
    plans: planRows(plans),
    transactions: transactionRows(transactions),
    payouts: payoutRows(transactions),
    balances: balanceRows(balances),
    ...flickRows(),
  };
}

export type DashboardData = Awaited<ReturnType<typeof dashboard>>;
