import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Debt, State } from './model.ts';
import { blank } from './seed.ts';

// Webhooks come from PayPal with no cookie: each has to reach the workspace it's about, whether that
// workspace is open in memory or only saved on disk, and leave everyone else's alone. This file has
// its own state folder, set before the store loads (so the store is imported after it).
const dir = mkdtempSync(join(tmpdir(), 'flick-webhooks-'));
process.env.STATE_FILE = join(dir, 'state.json');
process.env.PAYPAL_WEBHOOK_ID = 'WH-TEST';
const store = await import('./store.ts');
const { handleWebhookRequest } = await import('./webhooks.ts');

const ALEX = 'webhook-test-alex-0001';
const ROBIN = 'webhook-test-robin-001';
const debt = (id: string, invoiceId: string): Debt => ({ id, friendId: 'friend', amount: 12.5, what: 'pizza', createdAt: '2026-11-10T12:00:00.000Z', status: 'requested', reminders: 0, invoiceId });

// Alex is open in memory: an invoice out, and a week's payment paid out in batch BATCH-ALEX.
store.inWorkspace(ALEX, () => {
  Object.assign(store.state, blank());
  store.state.debts.push(debt('debt_1', 'INV2-ALEX'));
  store.state.week.payments.push({ id: 'p1', payeeId: 'power', payee: 'City Power', what: 'Electricity', icon: 'power', amount: 64.2, day: 'Mon', why: '', status: 'paid', payoutBatchId: 'BATCH-ALEX' } as State['week']['payments'][number]);
  store.save();
});
// Robin is only on disk: an invoice out, and a checkout waiting on PayPal's page.
mkdirSync(join(dir, 'workspaces'), { recursive: true });
const robinFile = join(dir, 'workspaces', `${ROBIN}.json`);
writeFileSync(
  robinFile,
  JSON.stringify({ ...blank(), debts: [debt('debt_1', 'INV2-ROBIN')], checkouts: { 'ORDER-ROBIN': { kind: 'scan', scanId: 's1', payeeId: 'p', orderId: 'ORDER-ROBIN', amount: 9, status: 'awaiting', at: '' } } }),
);

const captured: string[][] = [];
const send = (event: Record<string, unknown>) =>
  handleWebhookRequest({
    headers: {},
    body: event,
    verify: async () => true,
    within: (workspace, work) => store.inWorkspace(workspace, work),
    completeCheckout: async (orderId) => void captured.push([store.workspaceId(), orderId]),
  });
// A copy: `store.state` itself is whichever workspace is current when it is read.
const inAlex = () => store.inWorkspace(ALEX, () => JSON.parse(JSON.stringify(store.state)) as State);

test('an invoice paid reaches the workspace that sent it, and only that one', async () => {
  const res = await send({ id: 'WH-1', event_type: 'INVOICING.INVOICE.PAID', resource: { id: 'INV2-ALEX' } });
  assert.deepEqual(res, { ok: true, applied: true });
  assert.equal(inAlex().debts[0].status, 'paid');
  assert.equal(JSON.parse(readFileSync(robinFile, 'utf8')).debts[0].status, 'requested', "Robin's debt with the same id is untouched");
  assert.equal(store.inWorkspace('local', () => store.state.debts.some((d) => d.status === 'paid' && d.what === 'pizza')), false);
});

test('a workspace only saved on disk is found, and the change is saved there', async () => {
  const res = await send({ id: 'WH-2', event_type: 'INVOICING.INVOICE.PAID', resource: { id: 'INV2-ROBIN' } });
  assert.equal(res.applied, true);
  const robin = JSON.parse(readFileSync(robinFile, 'utf8')) as State;
  assert.equal(robin.debts[0].status, 'paid');
  assert.deepEqual(robin.webhookEvents, ['WH-2']);
});

test('the same event twice is applied once', async () => {
  const res = await send({ id: 'WH-2', event_type: 'INVOICING.INVOICE.PAID', resource: { id: 'INV2-ROBIN' } });
  assert.deepEqual(res, { ok: true, applied: false, reason: 'duplicate' });
});

test('a checkout approved on PayPal, its tab closed, is captured in its own workspace', async () => {
  await send({ id: 'WH-3', event_type: 'CHECKOUT.ORDER.APPROVED', resource: { id: 'ORDER-ROBIN' } });
  assert.deepEqual(captured, [[ROBIN, 'ORDER-ROBIN']]);
});

test("a failed payout finds its week by PayPal's batch id", async () => {
  await send({ id: 'WH-4', event_type: 'PAYMENT.PAYOUTS-ITEM.FAILED', resource: { payout_batch_id: 'BATCH-ALEX', payout_item: { sender_item_id: 'p1' }, errors: { message: 'Receiver unregistered' } } });
  assert.equal(inAlex().week.payments[0].status, 'failed');
  assert.equal(inAlex().week.payments[0].error, 'Receiver unregistered');
});

test('an event about nothing in Flick changes nothing', async () => {
  for (const event of [
    { id: 'WH-5', event_type: 'INVOICING.INVOICE.PAID', resource: { id: 'INV2-NOBODY' } },
    { id: 'WH-6', event_type: 'CHECKOUT.ORDER.APPROVED', resource: { id: 'ORDER-NOBODY' } },
    { id: 'WH-7', event_type: 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED', resource: { payout_batch_id: 'BATCH-NOBODY' } },
    { id: 'WH-8', event_type: 'BILLING.PLAN.CREATED', resource: {} },
  ]) {
    assert.deepEqual(await send(event), { ok: true, applied: false, reason: 'not about anything in Flick' }, event.event_type);
  }
  assert.equal(captured.length, 1);
});
