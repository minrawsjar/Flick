import { id, type Agent, type State } from './model.ts';
import { verifyWebhookSignature, type WebhookHeaders } from './paypal.ts';
import { findWorkspace, save, state } from './store.ts';

// Webhooks: receives events from PayPal the moment they happen so Flick stays in sync.
// Verifies every event's signature before processing, keeps the handling idempotent with
// a 200-event memory, and answers 200 quickly so PayPal does not keep retrying.
//
// PayPal sends them with no cookie, so each event goes to the workspace whose checkout, invoice
// or payout it is about (`concerns`), and is applied there after that workspace's other changes.

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
 * Whether an event is about this workspace: the checkout, invoice or week's payout batch is its own.
 * Reads state saved by older versions too, so every field may be missing.
 */
export function concerns(state: State, event: WebhookEvent): boolean {
  const resource = event.resource ?? {};
  switch (event.event_type) {
    case 'CHECKOUT.ORDER.APPROVED':
      return Boolean(resource.id && state.checkouts?.[resource.id]);
    case 'INVOICING.INVOICE.PAID': {
      const invoiceId = resource.id ?? resource.invoice?.id;
      return Boolean(invoiceId && state.debts?.some((d) => d.invoiceId === invoiceId));
    }
    case 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED':
    case 'PAYMENT.PAYOUTS-ITEM.FAILED':
    case 'PAYMENT.PAYOUTS-ITEM.UNCLAIMED':
      return Boolean(resource.payout_batch_id && state.week?.payments?.some((p) => p.payoutBatchId === resource.payout_batch_id));
    default:
      return false;
  }
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
 * Validates the PayPal webhook signature and applies the event to the workspace it's about.
 * Resolves to a response object rather than throwing for anything PayPal sent, so server.ts answers
 * 200 and PayPal doesn't keep retrying.
 */
export async function handleWebhookRequest({
  headers,
  body,
  completeCheckout,
  within,
  verify = verifyWebhookSignature,
}: {
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
  completeCheckout?: (orderId: string) => Promise<unknown>;
  /** Runs `work` in a workspace, after that workspace's other changes (server.ts). */
  within: <T>(workspace: string, work: () => Promise<T>) => Promise<T>;
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

  const event = body as WebhookEvent;
  const workspace = findWorkspace((s) => concerns(s, event));
  if (!workspace) return { ok: true, applied: false, reason: 'not about anything in Flick' };
  const result = await within(workspace, async () => {
    const applied = await applyEvent(state, event, { completeCheckout });
    if (applied.applied) save();
    return applied;
  });
  return { ok: true, ...result };
}
