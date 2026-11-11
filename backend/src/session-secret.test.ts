import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

// Setting SESSION_SECRET after people have signed in: their Flick, keyed with the PayPal secret,
// must still open. Its own state folder, set before the store loads.
const dir = mkdtempSync(join(tmpdir(), 'flick-session-'));
process.env.STATE_FILE = join(dir, 'state.json');
process.env.PAYPAL_SECRET = 'the-paypal-secret';
process.env.SESSION_SECRET = 'a-new-session-secret';
const { signInTo, workspaceFor } = await import('./account.ts');

test('someone who signed in before SESSION_SECRET keeps their Flick', () => {
  const before = workspaceFor('PAYER-OLD', 'the-paypal-secret');
  mkdirSync(join(dir, 'workspaces'), { recursive: true });
  writeFileSync(join(dir, 'workspaces', `${before}.json`), '{}');
  assert.equal(signInTo('PAYER-OLD'), before);
});

test('someone new is keyed with SESSION_SECRET, not the PayPal secret', () => {
  const now = signInTo('PAYER-NEW');
  assert.equal(now, workspaceFor('PAYER-NEW', 'a-new-session-secret'));
  assert.notEqual(now, workspaceFor('PAYER-NEW', 'the-paypal-secret'));
});

test('once someone has a Flick under SESSION_SECRET, that one opens', () => {
  const now = workspaceFor('PAYER-BOTH', 'a-new-session-secret');
  writeFileSync(join(dir, 'workspaces', `${now}.json`), '{}');
  writeFileSync(join(dir, 'workspaces', `${workspaceFor('PAYER-BOTH', 'the-paypal-secret')}.json`), '{}');
  assert.equal(signInTo('PAYER-BOTH'), now);
});
