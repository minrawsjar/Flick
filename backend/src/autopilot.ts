import { startCheckout } from './checkout.ts';
import { HttpError, need } from './http.ts';
import { addDays, cents, DAYS, id, usd, ymd, type Checkout, type Day } from './model.ts';
import { chargeSaved, createPayout, deleteSaved, PayPalApiError, refundCapture, type Saved } from './paypal.ts';
import { dueNow, planWeek, unapproved } from './rules.ts';
import { log, payee, save, state } from './store.ts';

// Autopilot: plans the week (rules.ts), asks for one PayPal approval covering it, then pays each
// payment on its day. Approved money is captured into this app's account; each payee is paid from it
// with a PayPal Payout. Skipping an approved payment refunds it.
//
// Paying by itself: approving once with "save PayPal" keeps the person's PayPal in PayPal's vault.
// From then on each week is paid with it, no approval page, as long as it's within the weekly cap;
// a bigger week, or a refusal from PayPal, goes back to asking. Stopping deletes the saved account.

/** The most Autopilot pays in a week by itself, until the person changes it. */
export const AUTOPAY_CAP = 200;

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

/**
 * Approves every payment still waiting. With PayPal saved for Autopilot and the week within its cap,
 * it's paid there and then (`approveUrl` is null); otherwise it's one checkout to approve on PayPal,
 * which also saves PayPal for next time if `save` is true.
 */
export async function approve(body: Record<string, unknown> = {}) {
  const waiting = unapproved(state.week);
  need(waiting.length, 'Nothing is waiting for approval this week.', 409);
  need(!state.week.approval || state.week.approval.status !== 'approved', 'This week is already approved.', 409);
  const total = cents(waiting.reduce((sum, p) => sum + p.amount, 0));
  const reference = `week-${state.week.starts}-${id('a')}`;
  const description = `Flick: ${waiting.length} payments, week of ${state.week.starts}`;
  const items = waiting.map((p) => ({ name: `${p.payee}: ${p.what} (${p.day})`, amount: p.amount }));

  if (state.autopay && total <= state.autopay.cap) {
    try {
      const { orderId, captureId } = await chargeSaved({ reference, description, items, savedId: state.autopay.savedId });
      const checkout = { kind: 'week' as const, orderId, amount: total, paymentIds: waiting.map((p) => p.id), status: 'captured' as const };
      state.checkouts[orderId] = checkout;
      await approved(checkout, captureId, undefined, true);
      return { orderId, approveUrl: null, amount: total };
    } catch (err) {
      // Revoked, or refused: ask the person instead, as before.
      log('autopilot', `Couldn't pay the week with your saved PayPal (${err instanceof Error ? err.message.slice(0, 120) : err}), so it needs your approval`);
    }
  }

  const saveIt = body.save === true && !state.autopay;
  const checkout = await startCheckout({ kind: 'week', paymentIds: waiting.map((p) => p.id), save: saveIt }, reference, description, items, saveIt);
  state.week.approval = { orderId: checkout.orderId, status: 'awaiting', amount: total };
  save();
  return checkout;
}

/**
 * The week was paid (its checkout captured, or charged to the saved PayPal): schedule its payments,
 * and pay any whose day has already come. `saved`: PayPal the person just saved for Autopilot.
 */
export async function approved(checkout: Extract<Checkout, { kind: 'week' }>, captureId: string, saved?: Saved, automatic = false) {
  for (const p of state.week.payments) if (checkout.paymentIds.includes(p.id) && p.status === 'planned') p.status = 'scheduled';
  state.week.approval = { orderId: checkout.orderId, status: 'approved', amount: checkout.amount, captureId };
  log(
    'autopilot',
    automatic
      ? `Paid the week with your saved PayPal: ${checkout.paymentIds.length} payments, ${usd(checkout.amount)}`
      : `Week approved: ${checkout.paymentIds.length} payments, ${usd(checkout.amount)}`,
    checkout.amount,
  );
  if (saved) {
    state.autopay = { savedId: saved.id, email: saved.email, since: ymd(new Date()), cap: AUTOPAY_CAP };
    log('autopilot', `Saved your PayPal${saved.email ? ` (${saved.email})` : ''}: from next week Autopilot pays by itself, up to ${usd(AUTOPAY_CAP)} a week`);
  } else if (checkout.save) {
    log('autopilot', "PayPal took the payment but didn't save your account for Autopilot, so next week asks again");
  }
  save();
  await payDue();
}

/** How much Autopilot may pay in a week by itself. */
export function setCap(body: Record<string, unknown>) {
  need(state.autopay, "Autopilot isn't paying by itself: approve a week with Save PayPal first.", 409);
  const cap = Number(body.cap);
  need(Number.isFinite(cap) && cap >= 10 && cap <= 5000, 'cap must be between $10 and $5,000.');
  state.autopay.cap = cents(cap);
  log('autopilot', `Autopilot now pays up to ${usd(state.autopay.cap)} a week by itself`);
  save();
  return state.autopay;
}

/** Stops Autopilot paying by itself, and deletes the saved PayPal at PayPal. */
export async function stopAutopay() {
  const autopay = state.autopay;
  need(autopay, "Autopilot isn't paying by itself.", 409);
  try {
    await deleteSaved(autopay.savedId);
  } catch (err) {
    // Already gone at PayPal is fine; anything else, keep it so the person can try again.
    if (!(err instanceof PayPalApiError && err.status === 404)) throw err;
  }
  delete state.autopay;
  log('autopilot', 'Stopped paying by itself and deleted your saved PayPal: each week asks for your approval again');
  save();
  return { autopay: null };
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

/** Closes the week: what was paid becomes history to learn from, and the next week is planned (and paid, if Autopilot pays by itself). */
export async function nextWeek() {
  for (const p of state.week.payments) {
    if (p.status === 'paid') state.history.push({ payeeId: p.payeeId, what: p.what, amount: p.amount, date: addDays(state.week.starts, DAYS.indexOf(p.day)) });
  }
  const starts = addDays(state.week.starts, 7);
  state.week = { starts, today: -1, payments: planWeek(starts, state) };
  log('autopilot', `Planned the week of ${starts}: ${state.week.payments.length} payments`);
  save();
  if (state.autopay && unapproved(state.week).length) {
    const total = unapproved(state.week).reduce((sum, p) => sum + p.amount, 0);
    if (total <= state.autopay.cap) await approve();
    else log('autopilot', `This week is ${usd(total)}, over your ${usd(state.autopay.cap)} cap, so it waits for your approval`);
  }
  return state.week;
}
