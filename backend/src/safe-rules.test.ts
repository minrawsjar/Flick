import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addsUp, checkProof, filePrint, inUsd, judge, receiptPrint, shares, type Proof, type Terms } from './safe-rules.ts';

// Run with `npm test`. Flick Safe's rules: what a receipt gets from a Safe given for a purpose.

const now = '2026-11-12T10:00:00.000Z';
const terms: Terms = { purpose: 'chocolates', left: 20, made: '2026-11-11T09:00:00.000Z', expires: '2026-11-25T09:00:00.000Z', open: true };

/** The demo's receipt: two bars of chocolate, and a phone charger that isn't chocolates. */
const receipt = (over: Partial<Proof> = {}): Proof => ({
  kind: 'receipt',
  merchant: 'Cocoa Corner',
  date: '2026-11-12',
  currency: 'USD',
  total: 22.04,
  tax: 1.64,
  tip: 0,
  lines: [
    { name: 'Dairy Milk', price: 4.2, fits: true, why: 'chocolate' },
    { name: 'Dark chocolate bar', price: 4.2, fits: true, why: 'chocolate' },
    { name: 'Phone charger', price: 12, fits: false, why: 'not chocolate' },
  ],
  signs: [],
  paypal: null,
  ...over,
});

test("the reader's answer is cleaned: unknown kinds, bad dates, blank lines and odd emails go", () => {
  const proof = checkProof({
    kind: 'invoice' as never,
    merchant: '  Cocoa   Corner ',
    date: '12/11/2026',
    currency: 'inr',
    total: -5,
    lines: [{ name: 'Dairy Milk', price: 4.2, fits: true, why: 'chocolate' }, { name: '', price: 3, fits: true, why: '' }, { name: 'Free sample', price: 0, fits: true, why: '' }, { name: 'Bar', price: 2, fits: 'yes' as never, why: '' }],
    signs: ['looks like a photo of a screen', '', 7 as never],
    paypal: 'not an email',
  });
  assert.equal(proof.kind, 'other');
  assert.equal(proof.merchant, 'Cocoa Corner');
  assert.equal(proof.date, null);
  assert.equal(proof.currency, 'INR');
  assert.equal(proof.total, 0);
  assert.deepEqual(proof.lines.map((l) => [l.name, l.fits]), [['Dairy Milk', true], ['Bar', false]]); // only a real true fits
  assert.deepEqual(proof.signs, ['looks like a photo of a screen']);
  assert.equal(proof.paypal, null);
  assert.equal(checkProof({}).merchant, 'A shop');
  assert.equal(checkProof({ kind: 'bill', paypal: 'Shop@Example.com' }).paypal, 'shop@example.com');
});

test('the lines that fit are paid with their share of the tax, and the rest is asked of the giver', () => {
  assert.deepEqual(shares(receipt()), { fits: 9.08, rest: 12.96 });
  const j = judge(receipt(), terms, { now });
  assert.equal(j.refused, undefined);
  assert.equal(j.pay, 9.08);
  assert.equal(j.ask, 10.92); // all that's left of $20 once the chocolates are paid
  assert.equal(j.why, "Phone charger isn't for chocolates.");
  assert.equal(judge(receipt(), { ...terms, left: 50 }, { now }).ask, 12.96);
});

test('a receipt that is all for the purpose is paid in full, with nothing to ask', () => {
  const j = judge(receipt({ total: 8.4, tax: 0, lines: receipt().lines.slice(0, 2) }), terms, { now });
  assert.deepEqual(j, { pay: 8.4, ask: 0, why: '' });
});

test("never more than what's left: the pay, then the ask, are capped", () => {
  const j = judge(receipt(), { ...terms, left: 5 }, { now });
  assert.equal(j.pay, 5);
  assert.equal(j.ask, 0);
  const k = judge(receipt(), { ...terms, left: 10 }, { now });
  assert.equal(k.pay, 9.08);
  assert.equal(k.ask, 0.92);
});

test('a used receipt, an old one and one from the future are refused', () => {
  assert.match(judge(receipt(), terms, { now, usedOn: '2026-11-12T09:30:00.000Z' }).refused!, /already used, on Nov 12/);
  assert.match(judge(receipt({ date: '2026-11-02' }), terms, { now }).refused!, /from Nov 2, before the Safe was made/);
  assert.match(judge(receipt({ date: '2026-11-20' }), terms, { now }).refused!, /in the future/);
  // A day's grace either way, for time zones.
  assert.equal(judge(receipt({ date: '2026-11-10' }), terms, { now }).refused, undefined);
  assert.equal(judge(receipt({ date: '2026-11-13' }), terms, { now }).refused, undefined);
});

test('nothing for the purpose, or not a receipt at all, is refused', () => {
  const charger = receipt({ total: 13.3, tax: 1.3, lines: [{ name: 'Phone charger', price: 12, fits: false, why: '' }] });
  assert.equal(judge(charger, terms, { now }).refused, 'Nothing on it is for chocolates.');
  assert.equal(judge(receipt({ kind: 'other' }), terms, { now }).refused, "That isn't a receipt or a bill.");
  assert.equal(judge(receipt({ lines: [] }), terms, { now }).refused, 'Nothing on it is for chocolates.');
});

test("a closed, ended or empty Safe pays nothing", () => {
  assert.equal(judge(receipt(), { ...terms, open: false }, { now }).refused, 'This Safe is closed.');
  assert.equal(judge(receipt(), terms, { now: '2026-11-26T00:00:00.000Z' }).refused, 'This Safe has ended.');
  assert.equal(judge(receipt(), { ...terms, left: 0 }, { now }).refused, 'Nothing is left in this Safe.');
});

test('doubts pay nothing and ask the giver: no date, lines that do not add up, signs of a fake', () => {
  const noDate = judge(receipt({ date: null }), terms, { now });
  assert.equal(noDate.pay, 0);
  assert.equal(noDate.ask, 9.08);
  assert.equal(noDate.why, 'It has no date on it.');

  const off = judge(receipt({ total: 30 }), terms, { now });
  assert.equal(off.pay, 0);
  assert.equal(off.why, "Its lines don't add up to its total.");

  const fake = judge(receipt({ signs: ['It looks like a photo of a screen', 'The total looks edited.'] }), terms, { now });
  assert.equal(fake.pay, 0);
  assert.equal(fake.why, 'It looks like a photo of a screen. The total looks edited.');
  assert.equal(judge(receipt({ signs: ['x'] }), { ...terms, left: 3 }, { now }).ask, 3);
});

test('adding up allows 5 cents of rounding, and needs a total', () => {
  assert.equal(addsUp(receipt()), true);
  assert.equal(addsUp(receipt({ total: 22.09 })), true);
  assert.equal(addsUp(receipt({ total: 22.1 })), false);
  assert.equal(addsUp(receipt({ total: 0 })), false);
});

test('the same receipt is the same however it comes; the same file too', () => {
  assert.equal(receiptPrint(receipt()), receiptPrint(receipt({ merchant: 'COCOA CORNER.' })));
  assert.notEqual(receiptPrint(receipt()), receiptPrint(receipt({ total: 22.05 })));
  assert.notEqual(receiptPrint(receipt()), receiptPrint(receipt({ date: '2026-11-13' })));
  assert.equal(filePrint('Cocoa  Corner\nTotal 22.04', true), filePrint('cocoa corner total 22.04', true));
  assert.notEqual(filePrint('data:image/jpeg;base64,AAAA'), filePrint('data:image/jpeg;base64,AAAB'));
  assert.ok(receiptPrint(receipt()).startsWith('r:') && filePrint('x').startsWith('f:'));
});

test('a receipt in rupees is judged in dollars', () => {
  const rupees = receipt({ currency: 'INR', total: 1000, tax: 0, lines: [{ name: 'Chocolates', price: 1000, fits: true, why: '' }] });
  const usd = inUsd(rupees, 0.0119);
  assert.equal(usd.currency, 'USD');
  assert.equal(usd.total, 11.9);
  assert.equal(judge(usd, terms, { now }).pay, 11.9);
});
