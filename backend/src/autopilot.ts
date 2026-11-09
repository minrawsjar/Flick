import { startCheckout } from './checkout.ts';
import { HttpError, need } from './http.ts';
import { addDays, cents, DAYS, id, usd, type Checkout, type Day } from './model.ts';
import { createPayout, refundCapture } from './paypal.ts';
import { dueNow, planWeek, unapproved } from './rules.ts';
import { log, payee, save, state } from './store.ts';

// Autopilot: plans the week (rules.ts), asks for one PayPal approval covering it, then pays each
// payment on its day. Approved money is captured into this app's account; each payee is paid from it
// with a PayPal Payout. Skipping an approved payment refunds it.

const find = (paymentId: unknown) => {
  const payment = state.week.payments.find((p) => p.id === paymentId);
  if (!payment) throw new HttpError(404, `No payment ${String(paymentId)} this week`);
  return payment;
};

/** Changes a payment before approval, or skips one (refunding it if it was already approved). */
export async function edit(body: Record<string, unknown>) {
  const payment = find(body.id);
  const { amount, day, skip } = body;

  if (skip === true) {
    need(payment.status === 'planned' || payment.status === 'scheduled', `${payment.payee} is already ${payment.status}.`, 409);
    const capture = state.week.approval?.captureId;
    if (payment.status === 'scheduled' && capture) {
      await refundCapture(capture, payment.amount, `Skipped: ${payment.payee}, ${payment.what}`, payment.id);
      log('autopilot', `Skipped ${payment.payee} and refunded ${usd(payment.amount)}`, payment.amount);
    }
    payment.status = 'skipped';
  } else if (skip === false) {
    need(payment.status === 'skipped' && !state.week.approval, 'Only a skipped payment can come back, before the week is approved.', 409);
    payment.status = 'planned';
  }

  if (amount !== undefined || day !== undefined) {
    need(payment.status === 'planned', 'Approved payments are fixed; skip it instead.', 409);
    if (amount !== undefined) {
      need(typeof amount === 'number' && Number.isFinite(amount) && amount > 0 && amount <= 10_000, 'amount must be between 0 and 10,000.');
      payment.amount = cents(amount);
    }
    if (day !== undefined) {
      need(DAYS.includes(day as Day), `day must be one of ${DAYS.join(', ')}.`);
      payment.day = day as Day;
    }
  }
  save();
  return state.week;
}

/** One PayPal checkout for every payment still waiting for approval. Returns where to approve it. */
export async function approve() {
  const waiting = unapproved(state.week);
  need(waiting.length, 'Nothing is waiting for approval this week.', 409);
  need(!state.week.approval || state.week.approval.status !== 'approved', 'This week is already approved.', 409);
  const total = cents(waiting.reduce((sum, p) => sum + p.amount, 0));
  const checkout = await startCheckout(
    { kind: 'week', paymentIds: waiting.map((p) => p.id) },
    `week-${state.week.starts}-${id('a')}`,
    `Flick: ${waiting.length} payments, week of ${state.week.starts}`,
    waiting.map((p) => ({ name: `${p.payee}: ${p.what} (${p.day})`, amount: p.amount })),
  );
  state.week.approval = { orderId: checkout.orderId, status: 'awaiting', amount: total };
  save();
  return checkout;
}

/** The week's checkout was captured: schedule its payments, and pay any whose day has already come. */
export async function approved(checkout: Extract<Checkout, { kind: 'week' }>, captureId: string) {
  for (const p of state.week.payments) if (checkout.paymentIds.includes(p.id) && p.status === 'planned') p.status = 'scheduled';
  state.week.approval = { orderId: checkout.orderId, status: 'approved', amount: checkout.amount, captureId };
  log('autopilot', `Week approved: ${checkout.paymentIds.length} payments, ${usd(checkout.amount)}`, checkout.amount);
  save();
  await payDue();
}

/** Pays every approved payment whose day has come, in one PayPal Payouts batch. */
async function payDue() {
  const due = dueNow(state.week);
  if (!due.length) return;
  try {
    const batch = await createPayout(
      `${state.week.starts}-${state.week.today}-${id('b')}`,
      'Flick paid you',
      due.map((p) => ({ id: p.id.slice(-60), email: payee(p.payeeId)?.email ?? '', amount: p.amount, note: `${p.what}, paid by Flick` })),
    );
    for (const p of due) {
      p.status = 'paid';
      p.payoutBatchId = batch.batchId;
      log('autopilot', `Paid ${p.payee}: ${p.what}`, p.amount);
    }
  } catch (err) {
    for (const p of due) {
      p.status = 'failed';
      p.error = err instanceof Error ? err.message : String(err);
    }
    log('autopilot', `Couldn't pay ${due.map((p) => p.payee).join(', ')}: PayPal said no. Check Payouts is enabled for the sandbox app.`);
  }
  save();
}

/** Moves the week on a day (the demo's clock) and pays whatever is now due. */
export async function tick() {
  need(state.week.today < 6, "It's already Sunday: start next week instead.", 409);
  state.week.today += 1;
  save();
  await payDue();
  return state.week;
}

/** Retries payments that failed (say, Payouts wasn't enabled yet). */
export async function retry() {
  for (const p of state.week.payments) if (p.status === 'failed') {
    p.status = 'scheduled';
    delete p.error;
  }
  await payDue();
  return state.week;
}

/** Closes the week: what was paid becomes history to learn from, and the next week is planned. */
export function nextWeek() {
  for (const p of state.week.payments) {
    if (p.status === 'paid') state.history.push({ payeeId: p.payeeId, what: p.what, amount: p.amount, date: addDays(state.week.starts, DAYS.indexOf(p.day)) });
  }
  const starts = addDays(state.week.starts, 7);
  state.week = { starts, today: -1, payments: planWeek(starts, state) };
  log('autopilot', `Planned the week of ${starts}: ${state.week.payments.length} payments`);
  save();
  return state.week;
}
