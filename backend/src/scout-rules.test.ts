import assert from 'node:assert/strict';
import { test } from 'node:test';
import { forecast, match, offers, quote, seedPurchases, shelf, STORES, usuals, weekOf } from './scout-rules.ts';

// Run with `npm test`. Scout's rules: learning what you buy, pricing a basket, reading a trend.

const sunday = '2026-11-08'; // Flick's planning day before the week of Monday 9 November
const week = weekOf(sunday);

test('Scout learns the Sunday shop, and that chocolate is not a habit', () => {
  const found = usuals(seedPurchases(sunday), sunday);
  const by = Object.fromEntries(found.map((u) => [u.productId, u]));

  assert.equal(by.cornflakes.label, 'every Sunday'); // one missed week doesn't break the habit
  assert.equal(by.cornflakes.due, sunday);
  assert.equal(by.milk.label, 'twice a week');
  assert.equal(by.coffee.label, 'every other Sunday');
  assert.equal(by.bananas.label, 'every Saturday');
  assert.equal(by.bananas.due, '2026-11-14');
  assert.equal(by.chocolate, undefined);
  assert.equal(by.cornflakes.last.storeId, 'corner-grocery');
});

test('an irregular pattern is not a usual', () => {
  const dates = ['2026-10-01', '2026-10-03', '2026-10-20', '2026-10-22', '2026-11-06'];
  const bought = dates.map((date) => ({ productId: 'rice', storeId: null, store: 'Shop', price: 5, qty: 1, date, from: 'receipt' as const }));
  assert.deepEqual(usuals(bought, sunday), []);
});

test('receipt lines match the catalog by their most specific word', () => {
  assert.equal(match('ORGANIC WHOLE MILK 1GAL'), 'milk');
  assert.equal(match('Oat Milk Barista 64oz'), 'oat-milk');
  assert.equal(match('Bananas'), 'bananas');
  assert.equal(match('Salmon roll'), null);
});

test('a basket is priced at every store, delivery included, and BulkBox has no fresh food', () => {
  const quotes = quote([{ productId: 'cornflakes', qty: 2 }, { productId: 'milk', qty: 1 }], week);
  const bulk = quotes.find((q) => q.storeId === 'bulkbox')!;
  assert.deepEqual(bulk.missing, ['milk']);
  assert.equal(quotes.at(-1)!.storeId, 'bulkbox'); // incomplete baskets sort last

  for (const q of quotes) {
    const store = STORES.find((s) => s.id === q.storeId)!;
    const subtotal = q.lines.reduce((sum, l) => sum + l.price * l.qty, 0);
    assert.ok(Math.abs(q.subtotal - subtotal) < 0.005);
    assert.equal(q.delivery, store.kind === 'online' && q.subtotal < store.freeOver! ? store.delivery : 0);
    assert.ok(Math.abs(q.total - (q.subtotal + q.delivery)) < 0.005);
  }
  const complete = quotes.filter((q) => !q.missing.length);
  assert.deepEqual(complete.map((q) => q.total), [...complete.map((q) => q.total)].sort((a, b) => a - b));
});

test('shelf prices are stable, end in 9, and sorted cheapest first', () => {
  assert.deepEqual(shelf('coffee', 'freshmart', week), shelf('coffee', 'freshmart', week));
  const list = offers('coffee', week);
  assert.equal(list.length, STORES.length);
  for (const o of list) assert.equal(Math.round(o.price * 100) % 10, 9);
  assert.deepEqual(list.map((o) => o.price), [...list.map((o) => o.price)].sort((a, b) => a - b));
});

test('forecasts: eggs and coffee rising, olive oil falling, cornflakes steady', () => {
  assert.equal(forecast('eggs', week).verdict, 'rising');
  assert.equal(forecast('coffee', week).verdict, 'rising');
  assert.equal(forecast('olive-oil', week).verdict, 'falling');
  assert.equal(forecast('cornflakes', week).verdict, 'steady');
  assert.equal(forecast('eggs', week).history.length, 12);
});
