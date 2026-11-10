import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkLens, dueNow, pickFace, planWeek, shares } from './rules.ts';
import { seed } from './seed.ts';

// Run with `npm test`. Covers the rules every money movement depends on.

const monday = new Date('2026-11-09T12:00:00Z');

test("the seeded week plans the one-pager's six payments", () => {
  const { week } = seed(monday);
  assert.equal(week.starts, '2026-11-09');
  assert.deepEqual(
    week.payments.map((p) => [p.day, p.payee, p.amount]),
    [
      ['Wed', 'City Power', 64.2],
      ['Thu', 'Maya', 9],
      ['Thu', 'Mobile Co', 25],
      ['Fri', 'Bean There', 2],
      ['Sat', 'Corner Grocery', 38.5],
      ['Sun', 'Leo', 3.6],
    ],
  );
  assert.equal(week.payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2), '142.30');
  assert.match(week.payments[0].why, /snapped this bill on Nov 3\. It's due Wednesday, Nov 11/);
  assert.match(week.payments[2].why, /12th, every month/);
  assert.match(week.payments[3].why, /on 3 of the last 4 Fridays/);
  assert.match(week.payments[4].why, /every Saturday for the last 4 weeks, \$38\.50 on average/);
});

test('any day of the week seeds the same week', () => {
  assert.equal(seed(new Date('2026-11-15T23:00:00Z')).week.starts, '2026-11-09');
});

test('a paid bill and an old habit drop out of the plan', () => {
  const state = seed(monday);
  state.scans[0].status = 'paid';
  state.history = state.history.filter((p) => p.payeeId !== 'leo' || p.date > '2026-10-26');
  const payees = planWeek('2026-11-09', state).map((p) => p.payee);
  assert.ok(!payees.includes('City Power'));
  assert.ok(!payees.includes('Leo'));
});

test('only approved payments whose day has come are due', () => {
  const { week } = seed(monday);
  week.today = 3;
  assert.equal(dueNow(week).length, 0, 'nothing is due before approval');
  for (const p of week.payments) p.status = 'scheduled';
  assert.deepEqual(dueNow(week).map((p) => p.payee), ['City Power', 'Maya', 'Mobile Co']);
});

test("the dinner splits as the one-pager shows, and adds up to the cent", () => {
  const all = ['you', 'maya', 'leo', 'priya'];
  const { total, each, nobody } = shares(
    [
      { name: 'Salmon roll', price: 14, people: ['you', 'maya'] },
      { name: 'Dragon roll', price: 16.5, people: ['leo', 'priya'] },
      { name: 'Gyoza', price: 8.5, people: all },
      { name: 'Edamame', price: 6, people: all },
      { name: 'Miso soup ×2', price: 7, people: ['you', 'leo'] },
      { name: 'Green tea ×4', price: 16, people: all },
    ],
    6.04,
    12.24,
  );
  assert.equal(total, 86.28);
  assert.deepEqual(each, { maya: 18.56, leo: 24.58, priya: 20.14, you: 23 });
  assert.equal(Object.values(each).reduce((a, b) => a + b, 0).toFixed(2), '86.28');
  assert.deepEqual(nobody, []);
});

test('an item nobody had is reported, and you take the rounding', () => {
  const { each, nobody } = shares(
    [
      { name: 'Pizza', price: 10, people: ['maya', 'leo', 'priya'] },
      { name: 'Wine', price: 20, people: [] },
    ],
    0,
    0,
  );
  assert.deepEqual(nobody, ['Wine']);
  assert.deepEqual(each, { maya: 3.33, leo: 3.33, priya: 3.33, you: 0.01 });
});

test('Lens output is checked before it can become a payment', () => {
  const scan = checkLens(
    {
      kind: 'bill',
      title: '  City Power  ',
      amount: 64.2,
      currency: 'usd',
      due: '2026-02-30',
      repeats: 'yearly',
      items: [{ name: 'x', price: 3 }],
      fields: [{ key: 'payee', value: 'City Power' }, { key: '', value: 'dropped' }],
    },
    'scan_1',
    '2026-11-09T10:00:00Z',
  );
  assert.equal(scan.title, 'City Power');
  assert.equal(checkLens({ kind: 'bill', title: 'CITY POWER' }, 's', 't').title, 'City Power', 'all caps is calmed');
  assert.equal(checkLens({ kind: 'bill', title: "JOE'S COFFEE & SPICE-ROUTE" }, 's', 't').title, "Joe's Coffee & Spice-Route", 'no capital after an apostrophe');
  assert.equal(checkLens({ kind: 'bill', title: 'IKEA Family' }, 's', 't').title, 'IKEA Family', 'mixed case is kept');
  assert.equal(scan.currency, 'USD');
  assert.equal(scan.due, null, 'Feb 30 is not a date');
  assert.equal(scan.repeats, null);
  assert.deepEqual(scan.items, [], 'only receipts carry items');
  assert.deepEqual(scan.fields, [['payee', 'City Power']]);

  const nonsense = checkLens({ kind: 'cat', amount: 12 }, 'scan_2', '2026-11-09T10:00:00Z');
  assert.equal(nonsense.kind, 'unknown');
  assert.equal(nonsense.amount, 0, 'never pay what Lens could not read');
  assert.equal(checkLens({ kind: 'tip', amount: -5 }, 's', 't').amount, 0);
  assert.equal(checkLens({ kind: 'tip', amount: Number.NaN }, 's', 't').amount, 0);
});

test('new friends get a face nobody has, in a fresh colour while there are any', () => {
  const { friends } = seed(monday);
  const face = pickFace([{ color: 'red', shape: 'circle' }, ...friends]);
  assert.ok(!['red', 'violet', 'orange', 'blue'].includes(face.color), `fresh colour, got ${face.color}`);
  const colors = ['violet', 'orange', 'blue', 'red', 'green', 'pink', 'yellow', 'cyan'];
  const shapes = ['hexagon', 'drop', 'squircle', 'circle', 'capsule'];
  const everyFaceButOne = colors.flatMap((color) => shapes.map((shape) => ({ color, shape }))).filter((f) => !(f.color === 'green' && f.shape === 'drop'));
  assert.deepEqual(pickFace(everyFaceButOne), { color: 'green', shape: 'drop' }, 'the one face left');
});
