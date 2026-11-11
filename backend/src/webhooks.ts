import { id, type Agent, type State } from './model.ts';
import { verifyWebhookSignature, type WebhookHeaders } from './paypal.ts';
import { save, state as globalState } from './store.ts';

// Webhooks: receives events from PayPal the moment they happen so Flick stays in sync.
// Verifies every event's signature before processing, keeps the handling idempotent with
// a 200-event memory, and answers 200 quickly so PayPal does not keep retrying.

export type WebhookEvent = {
  id: string;
  event_type: string;
  create_time?: string;
  resource_type?: string;
  resource?: Record<string, any>;
  [key: string]: unknown;
};

export type ApplyEventOptions = {
  /** Captured an approved checkout and notifies the appropriate agent. */
  completeCheckout?: (orderId: string) => Promise<unknown>;
};

function logActivity(state: State, agent: Agent, text: string, amount?: number) {
  if (!state.activity) state.activity = [];
  state.activity.unshift({ id: id('act'), at: new Date().toISOString(), agent, text, amount });
  state.activity.length = Math.min(state.activity.length, 200);
}

/**
 * Extracts PayPal transmission and signature headers from incoming request headers.
 */
export function extractWebhookHeaders(headers: Record<string, string | string[] | undefined>): WebhookHeaders {
  const getHeader = (name: string) => {
    const val = headers[name.toLowerCase()];
    return Array.isArray(val) ? val[0] : val;
  };
  return {
    authAlgo: getHeader('paypal-auth-algo'),
    certUrl: getHeader('paypal-cert-url'),
    transmissionId: getHeader('paypal-transmission-id'),
    transmissionSig: getHeader('paypal-transmission-sig'),
    transmissionTime: getHeader('paypal-transmission-time'),
  };
}

/**
 * Pure function that applies a single webhook event to state without requiring network access.
 * Safe to call repeatedly: remembers the last 200 event ids.
 */
export async function applyEvent(
  state: State,
  event: WebhookEvent,
  options: ApplyEventOptions = {},
): Promise<{ applied: boolean; reason?: string }> {
  if (!state.webhookEvents) state.webhookEvents = [];

  // De-duplicate: ignore events we have already processed
  if (event.id && state.webhookEvents.includes(event.id)) {
    return { applied: false, reason: 'duplicate' };
  }

  switch (event.event_type) {
    case 'INVOICING.INVOICE.PAID': {
      const invoiceId = (event.resource?.id ?? event.resource?.invoice?.id) as string | undefined;
      const reference = (event.resource?.reference ?? event.resource?.detail?.reference) as string | undefined;
      const debt = state.debts.find((d) => (invoiceId && d.invoiceId === invoiceId) || (reference && d.id === reference));
      if (debt) {
        debt.status = 'paid';
        const who = state.friends.find((f) => f.id === debt.friendId)?.name ?? 'A friend';
        const text = debt.what ? `${who} paid you back for ${debt.what}` : `${who} paid you back`;
        logActivity(state, 'nudge', text, debt.amount);
      }
      break;
    }

    case 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED': {
      const itemId = (event.resource?.payout_item?.sender_item_id ?? event.resource?.sender_item_id) as string | undefined;
      const payment = state.week.payments.find((p) => p.id === itemId || p.id.slice(-60) === itemId);
      if (payment) {
        payment.status = 'paid';
        delete payment.error;
        if (!payment.payoutBatchId && event.resource?.payout_batch_id) {
          payment.payoutBatchId = event.resource.payout_batch_id;
        }
      }
      break;
    }

    case 'PAYMENT.PAYOUTS-ITEM.FAILED': {
      const itemId = (event.resource?.payout_item?.sender_item_id ?? event.resource?.sender_item_id) as string | undefined;
      const payment = state.week.payments.find((p) => p.id === itemId || p.id.slice(-60) === itemId);
      if (payment) {
        payment.status = 'failed';
        const msg = (event.resource?.errors?.message ?? event.resource?.error?.message ?? 'Payout failed') as string;
        payment.error = msg;
        logActivity(state, 'autopilot', `Payment to ${payment.payee} failed: ${msg}`);
      }
      break;
    }

    case 'PAYMENT.PAYOUTS-ITEM.UNCLAIMED': {
      const itemId = (event.resource?.payout_item?.sender_item_id ?? event.resource?.sender_item_id) as string | undefined;
      const payment = state.week.payments.find((p) => p.id === itemId || p.id.slice(-60) === itemId);
      if (payment) {
        payment.status = 'paid';
        delete payment.error;
      }
      break;
    }

    case 'CHECKOUT.ORDER.APPROVED': {
      const orderId = (event.resource?.id) as string | undefined;
      if (orderId && state.checkouts[orderId]?.status === 'awaiting') {
        if (options.completeCheckout) {
          await options.completeCheckout(orderId);
        }
      }
      break;
    }

    default:
      // Other events are acknowledged without error
      break;
  }

  // Record event id (keeping the last 200)
  if (event.id) {
    state.webhookEvents.unshift(event.id);
    state.webhookEvents.length = Math.min(state.webhookEvents.length, 200);
  }

  return { applied: true };
}

/**
 * Validates the PayPal webhook signature and applies the event to Flick's state.
 * Always resolves to a response object (never throws), allowing server.ts to answer 200 quickly.
 */
export async function handleWebhookRequest({
  headers,
  body,
  completeCheckout,
  state = globalState,
  verify = verifyWebhookSignature,
}: {
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
  completeCheckout?: (orderId: string) => Promise<unknown>;
  state?: State;
  verify?: typeof verifyWebhookSignature;
}): Promise<{ ok: boolean; applied?: boolean; reason?: string }> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    console.warn('PayPal webhook received but PAYPAL_WEBHOOK_ID is not set in backend/.env');
    return { ok: false, reason: 'PAYPAL_WEBHOOK_ID not set' };
  }

  const webhookHeaders = extractWebhookHeaders(headers);
  const isValid = await verify({
    webhookId,
    headers: webhookHeaders,
    event: body,
  });

  if (!isValid) {
    console.warn('PayPal webhook rejected: signature verification failed');
    return { ok: false, reason: 'invalid signature' };
  }

  const result = await applyEvent(state, body as WebhookEvent, { completeCheckout });
  if (result.applied) {
    save();
  }
  return { ok: true, ...result };
}
