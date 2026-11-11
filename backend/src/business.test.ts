import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

// Its own state folder, set before the store loads: businesses.json is shared by everyone.
process.env.STATE_FILE = join(mkdtempSync(join(tmpdir(), 'flick-business-')), 'state.json');
const store = await import('./store.ts');
const { businessFor, register, remove, words } = await import('./business.ts');

/** Runs `work` as someone signed in with that PayPal email, in a workspace of their own. */
const as = <T>(email: string, work: () => T) =>
  store.inWorkspace(`business-test-${email.replace(/\W/g, '')}`.padEnd(16, '0'), () => {
    store.state.profile = { name: email.split('@')[0], email, savedId: '', since: '' };
    return work();
  });
const failsWith = (work: () => unknown, status: number, says: RegExp) =>
  assert.throws(work, (err: { status?: number; message?: string }) => err.status === status && says.test(err.message ?? ''));

test('names match as bills write them: case, accents and punctuation aside', () => {
  assert.equal(words('  KFC — Koramangala #42 '), 'kfc koramangala 42');
  assert.equal(words('Café Coffee Day'), 'cafe coffee day');
});

test('registering needs signing in, a real name, and a name nobody else has', () => {
  store.inWorkspace('business-test-guest-01', () => failsWith(() => register({ name: 'KFC' }), 409, /Sign in/));
  as('kfc@business.example.com', () => {
    failsWith(() => register({ name: ' ' }), 400, /name is required/);
    failsWith(() => register({ name: 'K' }), 400, /can't be a name/);
    const { yours } = register({ name: 'KFC', names: 'Kentucky Fried Chicken, kfc, ' });
    assert.deepEqual(yours?.names, ['KFC', 'Kentucky Fried Chicken'], 'the same name twice is kept once');
    assert.equal(yours?.email, 'kfc@business.example.com', 'paid at the PayPal that signed in');
  });
  as('impostor@example.com', () => failsWith(() => register({ name: 'Burgers', names: ['K.F.C', 'kfc'] }), 409, /already on Flick/));
  as('ccd@business.example.com', () => register({ name: 'Café Coffee Day', names: ['CCD'] }));
});

test("a bill is a business's when one of its names is in it, as whole words", () => {
  assert.equal(businessFor('KFC')?.name, 'KFC');
  assert.equal(businessFor('KFC Koramangala')?.name, 'KFC');
  assert.equal(businessFor('KENTUCKY FRIED CHICKEN, MG Road')?.name, 'KFC');
  assert.equal(businessFor('Cafe Coffee Day - Indiranagar')?.name, 'Café Coffee Day');
  assert.equal(businessFor('KFCX Burgers'), undefined, 'not inside another word');
  assert.equal(businessFor('City Power'), undefined);
});

test('changing your names keeps one business per PayPal; removing it frees its names', () => {
  as('kfc@business.example.com', () => {
    register({ name: 'KFC', names: ['Kentucky Fried Chicken', 'KFC India'] });
    assert.equal(businessFor('KFC India, Bengaluru')?.email, 'kfc@business.example.com');
    remove();
    failsWith(() => remove(), 404, /haven't registered/);
  });
  assert.equal(businessFor('KFC'), undefined);
  as('someone-else@example.com', () => assert.equal(register({ name: 'KFC' }).yours?.email, 'someone-else@example.com'));
});
