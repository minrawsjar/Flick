import { HttpError } from './http.ts';
import type { Checkout } from './model.ts';
import { captureOrder, createOrder, type OrderItem } from './paypal.ts';
import { save, state } from './store.ts';

// A PayPal checkout: the person approves on PayPal's own page, PayPal sends them back to
// /api/paypal/return, and the money is captured into this app's account. server.ts then hands the
// checkout to whichever agent asked for it (Autopilot's week, or a Lens payment).

/** The frontend's address: PayPal returns there, and its /api/* rewrite brings the request here. */
export const frontendUrl = () => (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');

// What the caller supplies. Omit is applied to each kind of checkout separately (it distributes
// over T), so each keeps its own fields.
type Without<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type NewCheckout = Without<Checkout, 'orderId' | 'status' | 'amount'>;

/** `savePayPal`: also ask to save the person's PayPal, so Autopilot can pay later weeks by itself. */
export async function startCheckout(checkout: NewCheckout, reference: string, description: string, items: OrderItem[], savePayPal = false) {
  const order = await createOrder({
    reference,
    description,
    items,
    returnUrl: `${frontendUrl()}/api/paypal/return`,
    cancelUrl: `${frontendUrl()}/api/paypal/cancel`,
    save: savePayPal,
  });
  state.checkouts[order.id] = { ...checkout, orderId: order.id, amount: order.total, status: 'awaiting', at: new Date().toISOString(), what: description } as Checkout;
  save();
  return { orderId: order.id, approveUrl: order.approveUrl, amount: order.total };
}

/**
 * Captures an approved checkout. Returns it with the capture id (and the saved PayPal, if it saved
 * one), or with `captureId: undefined` if it was already captured (PayPal's return page reloaded),
 * so the agent acts only once.
 */
export async function captureCheckout(orderId: string) {
  const checkout = state.checkouts[orderId];
  if (!checkout) throw new HttpError(404, `No checkout ${orderId}`);
  if (checkout.status !== 'awaiting') return { checkout, captureId: undefined, saved: undefined };
  const { captureId, saved } = await captureOrder(orderId);
  checkout.status = 'captured';
  checkout.captureId = captureId;
  save();
  return { checkout, captureId, saved };
}

export function cancelCheckout(orderId: string) {
  const checkout = state.checkouts[orderId];
  if (checkout?.status === 'awaiting') {
    checkout.status = 'cancelled';
    save();
  }
  return checkout;
}
