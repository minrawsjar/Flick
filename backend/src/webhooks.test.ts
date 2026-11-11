import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seed } from './seed.ts';
import { applyEvent, handleWebhookRequest, type WebhookEvent } from './webhooks.ts';

const monday = new Date('2026-11-09T12:00:00Z');

test('INVOICING.INVOICE.PAID marks debt as paid and logs Nudge activity', async () => {
  const state = seed(monday);
  const debt = state.debts.find((d) => d.id === 'debt_maya')!;
  debt.invoiceId = 'INV2-MAYA-1234';

  const event: WebhookEvent = {
    id: 'WH-EVT-INV-001',
    event_type: 'INVOICING.INVOICE.PAID',
    resource: {
      id: 'INV2-MAYA-1234',
      status: 'PAID',
    },
  };

  const result = await applyEvent(state, event);
  assert.equal(result.applied, true);
  assert.equal(debt.status, 'paid');
  assert.equal(state.webhookEvents?.[0], 'WH-EVT-INV-001');

  const act = state.activity.find((a) => a.agent === 'nudge' && a.text.includes('paid you back'));
  assert.ok(act, 'Activity logged for Nudge');
  assert.match(act.text, /Maya paid you back for movie night/);
  assert.equal(act.amount, 18.4);
});

test('repeated event ID is ignored and does not re-apply', async () => {
  const state = seed(monday);
  const debt = state.debts.find((d) => d.id === 'debt_maya')!;
  debt.invoiceId = 'INV2-MAYA-1234';

  const event: WebhookEvent = {
    id: 'WH-EVT-INV-001',
    event_type: 'INVOICING.INVOICE.PAID',
    resource: { id: 'INV2-MAYA-1234' },
  };

  const first = await applyEvent(state, event);
  assert.equal(first.applied, true);
  const activityCount = state.activity.length;

  const second = await applyEvent(state, event);
  assert.equal(second.applied, false);
  assert.equal(second.reason, 'duplicate');
  assert.equal(state.activity.length, activityCount, 'No duplicate activity logged');
  assert.equal(state.webhookEvents?.filter((id) => id === 'WH-EVT-INV-001').length, 1);
});

test('PAYMENT.PAYOUTS-ITEM.SUCCEEDED marks the week payment as paid', async () => {
  const state = seed(monday);
  const payment = state.week.payments[0];
  payment.status = 'scheduled';

  const event: WebhookEvent = {
    id: 'WH-EVT-PAYOUT-001',
    event_type: 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED',
    resource: {
      payout_item: {
        sender_item_id: payment.id,
      },
    },
  };

  const result = await applyEvent(state, event);
  assert.equal(result.applied, true);
  assert.equal(payment.status, 'paid');
  assert.equal(payment.error, undefined);
});

test('PAYMENT.PAYOUTS-ITEM.FAILED marks payment as failed and logs error', async () => {
  const state = seed(monday);
  const payment = state.week.payments[0];
  payment.status = 'scheduled';

  const event: WebhookEvent = {
    id: 'WH-EVT-PAYOUT-002',
    event_type: 'PAYMENT.PAYOUTS-ITEM.FAILED',
    resource: {
      sender_item_id: payment.id,
      errors: {
        message: 'Receiver account is restricted',
      },
    },
  };

  const result = await applyEvent(state, event);
  assert.equal(result.applied, true);
  assert.equal(payment.status, 'failed');
  assert.equal(payment.error, 'Receiver account is restricted');

  const act = state.activity.find((a) => a.agent === 'autopilot' && a.text.includes('failed'));
  assert.ok(act, 'Autopilot failure activity logged');
  assert.match(act.text, /Receiver account is restricted/);
});

test('PAYMENT.PAYOUTS-ITEM.UNCLAIMED updates payment to paid', async () => {
  const state = seed(monday);
  const payment = state.week.payments[0];
  payment.status = 'scheduled';

  const event: WebhookEvent = {
    id: 'WH-EVT-PAYOUT-003',
    event_type: 'PAYMENT.PAYOUTS-ITEM.UNCLAIMED',
    resource: {
      payout_item: {
        sender_item_id: payment.id,
      },
    },
  };

  const result = await applyEvent(state, event);
  assert.equal(result.applied, true);
  assert.equal(payment.status, 'paid');
});

test('CHECKOUT.ORDER.APPROVED triggers capture for awaiting checkout', async () => {
  const state = seed(monday);
  state.checkouts['order_123'] = {
    kind: 'week',
    orderId: 'order_123',
    amount: 142.3,
    paymentIds: ['p_1'],
    status: 'awaiting',
  };

  let capturedOrderId: string | undefined;
  const mockCompleteCheckout = async (orderId: string) => {
    capturedOrderId = orderId;
    state.checkouts[orderId].status = 'captured';
  };

  const event: WebhookEvent = {
    id: 'WH-EVT-CHK-001',
    event_type: 'CHECKOUT.ORDER.APPROVED',
    resource: {
      id: 'order_123',
    },
  };

  const result = await applyEvent(state, event, { completeCheckout: mockCompleteCheckout });
  assert.equal(result.applied, true);
  assert.equal(capturedOrderId, 'order_123');
  assert.equal(state.checkouts['order_123'].status, 'captured');
});

test('CHECKOUT.ORDER.APPROVED ignores already captured checkout', async () => {
  const state = seed(monday);
  state.checkouts['order_456'] = {
    kind: 'week',
    orderId: 'order_456',
    amount: 50,
    paymentIds: ['p_1'],
    status: 'captured',
  };

  let called = false;
  const mockCompleteCheckout = async () => {
    called = true;
  };

  const event: WebhookEvent = {
    id: 'WH-EVT-CHK-002',
    event_type: 'CHECKOUT.ORDER.APPROVED',
    resource: {
      id: 'order_456',
    },
  };

  const result = await applyEvent(state, event, { completeCheckout: mockCompleteCheckout });
  assert.equal(result.applied, true);
  assert.equal(called, false, 'Should not capture an already captured checkout');
});

test('webhookEvents list is capped at 200 items', async () => {
  const state = seed(monday);
  state.webhookEvents = Array.from({ length: 200 }, (_, i) => `WH-OLD-${i}`);

  const event: WebhookEvent = {
    id: 'WH-NEW-001',
    event_type: 'UNKNOWN.EVENT',
    resource: {},
  };

  await applyEvent(state, event);
  assert.equal(state.webhookEvents.length, 200);
  assert.equal(state.webhookEvents[0], 'WH-NEW-001');
  assert.equal(state.webhookEvents.includes('WH-OLD-199'), false);
});

test('handleWebhookRequest rejects event with bad signature and leaves state unchanged', async () => {
  const state = seed(monday);
  const prevEnv = process.env.PAYPAL_WEBHOOK_ID;
  process.env.PAYPAL_WEBHOOK_ID = 'WH-12345';

  try {
    const mockVerify = async () => false; // Bad signature
    const event: WebhookEvent = {
      id: 'WH-EVT-BAD',
      event_type: 'INVOICING.INVOICE.PAID',
      resource: { id: 'INV2-NONE' },
    };

    const res = await handleWebhookRequest({
      headers: { 'paypal-transmission-id': 'tx-1' },
      body: event,
      state,
      verify: mockVerify,
    });

    assert.equal(res.ok, false);
    assert.equal(res.reason, 'invalid signature');
    assert.equal(state.webhookEvents?.includes('WH-EVT-BAD'), false);
  } finally {
    process.env.PAYPAL_WEBHOOK_ID = prevEnv;
  }
});

