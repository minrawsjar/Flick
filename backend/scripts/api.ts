// `npm run api`: every route of Flick's API, the way it's meant to be used and the ways it isn't, on
// its own backend (port 4200, a throwaway state file). Real calls to the PayPal sandbox and the AI
// model; no money moves without a buyer's approval, so checkouts are created and then cancelled.
// The approval page itself is `npm run loop`'s job.

import { check, checklist, client, startBackend, type Json } from './harness.ts';

const base = await startBackend(4200);
const { call, api, refuses } = client(base);
const { step, section, done } = checklist();
const state = () => api('state');
const near = (a: number, b: number) => Math.abs(a - b) < 0.005;

section('Basics');
await step('health', async () => check((await api('health')).ok === true, 'not ok'));
await step('an unknown route is a 404 in JSON', () => refuses('nope', undefined, 404, 'No route'));
await step('a body that isn\'t JSON is refused', () => refuses('week/edit', '{not json', 400, 'must be JSON'));
await step('a JSON array is refused', () => refuses('week/edit', '[1,2]', 400, 'JSON object'));
await step('a body over 8 MB is refused', () => refuses('lens/read', JSON.stringify({ image: 'x'.repeat(9_000_000) }), 413, 'too large'));
await step('state: PayPal and AI configured, the seeded week of six payments, $142.30', async () => {
  const s = await state();
  check(s.config.paypal && s.config.ai, `config ${JSON.stringify(s.config)}`);
  check(s.week.payments.length === 6, `${s.week.payments.length} payments`);
  check(near(s.week.payments.reduce((sum: number, p: Json) => sum + p.amount, 0), 142.3), 'not $142.30');
  check(s.week.today === -1, `today ${s.week.today}`);
});

section('Lens');
await step('read refuses a missing or non-image photo', async () => {
  await refuses('lens/read', {}, 400, 'data URL');
  await refuses('lens/read', { image: 'https://example.com/bill.jpg' }, 400, 'data URL');
  await refuses('lens/read', { image: 'data:text/html;base64,PGI+' }, 400, 'data URL');
});
await step('pay refuses an unknown scan', () => refuses('lens/pay', { scanId: 'scan_nope' }, 404));
let lensOrder = '';
await step('pay starts a real PayPal checkout for the seeded bill', async () => {
  const { approveUrl, orderId, amount } = await api('lens/pay', { scanId: 'scan_seed' });
  check(approveUrl?.startsWith('https://www.sandbox.paypal.com/'), `approveUrl ${approveUrl}`);
  check(near(amount, 64.2), `amount ${amount}`);
  const s = await state();
  check(s.scans[0].status === 'awaiting', `scan ${s.scans[0].status}`);
  check(s.checkouts[orderId]?.kind === 'scan', 'no checkout');
  lensOrder = orderId;
  return orderId;
});
await step('cancelling on PayPal puts the bill back, and comes back to /lens', async () => {
  const res = await call(`paypal/cancel?token=${lensOrder}`);
  check(res.status === 303 && res.headers.get('location')?.endsWith('/lens?checkout=cancelled'), `${res.status} ${res.headers.get('location')}`);
  check((await state()).scans[0].status === 'read', 'still awaiting');
});
await step('a return for an order Flick never made fails safely', async () => {
  const res = await call('paypal/return?token=NOTANORDER');
  check(res.status === 303 && res.headers.get('location')?.includes('checkout=failed'), `${res.status} ${res.headers.get('location')}`);
});

section('Autopilot');
const payment = (await state()).week.payments.find((p: Json) => p.payee === 'Corner Grocery');
await step('edit refuses unknown payments, bad amounts and bad days', async () => {
  await refuses('week/edit', { id: 'nope', amount: 5 }, 404);
  await refuses('week/edit', { id: payment.id, amount: -5 }, 400, 'amount');
  await refuses('week/edit', { id: payment.id, amount: 20_000 }, 400, 'amount');
  await refuses('week/edit', { id: payment.id, amount: '12' }, 400, 'amount');
  await refuses('week/edit', { id: payment.id, day: 'Funday' }, 400, 'day');
});
await step('edit changes an amount and a day, rounding to cents', async () => {
  const week = await api('week/edit', { id: payment.id, amount: 41.256, day: 'Sun' });
  const p = week.payments.find((x: Json) => x.id === payment.id);
  check(p.amount === 41.26 && p.day === 'Sun', `${p.amount} ${p.day}`);
});
await step('skip, then bring back', async () => {
  check((await api('week/edit', { id: payment.id, skip: true })).payments.find((x: Json) => x.id === payment.id).status === 'skipped', 'not skipped');
  await refuses('week/edit', { id: payment.id, amount: 5 }, 409, 'skip it instead');
  check((await api('week/edit', { id: payment.id, skip: false })).payments.find((x: Json) => x.id === payment.id).status === 'planned', 'not back');
});
let weekOrder = '';
await step('approve with Save PayPal starts one checkout for the whole week', async () => {
  const { approveUrl, orderId, amount } = await api('week/approve', { save: true });
  const s = await state();
  check(approveUrl?.includes('sandbox.paypal.com'), 'no approveUrl');
  check(s.week.approval?.status === 'awaiting' && near(s.week.approval.amount, amount), `approval ${JSON.stringify(s.week.approval)}`);
  check(s.checkouts[orderId].kind === 'week' && s.checkouts[orderId].save === true && s.checkouts[orderId].paymentIds.length === 6, 'checkout');
  weekOrder = orderId;
  return `$${amount}`;
});
await step('cancelling it clears the approval, back to /autopilot', async () => {
  const res = await call(`paypal/cancel?token=${weekOrder}`);
  check(res.headers.get('location')?.endsWith('/autopilot?checkout=cancelled'), `${res.headers.get('location')}`);
  check(!(await state()).week.approval, 'approval still there');
});
await step('autopay settings need a saved PayPal first', async () => {
  await refuses('autopay/cap', { cap: 300 }, 409, 'Save PayPal');
  await refuses('autopay/stop', {}, 409);
});
await step('three days at once are applied one at a time (no lost updates)', async () => {
  await Promise.all([api('week/tick', {}), api('week/tick', {}), api('week/tick', {})]);
  check((await state()).week.today === 2, `today ${(await state()).week.today}`);
});
await step('unapproved payments are never paid out as the days pass', async () => {
  for (let i = 0; i < 4; i++) await api('week/tick', {});
  const s = await state();
  check(s.week.today === 6 && s.week.payments.every((p: Json) => p.status === 'planned'), JSON.stringify(s.week.payments.map((p: Json) => p.status)));
  await refuses('week/tick', {}, 409, 'Sunday');
});
await step('retry with nothing failed changes nothing', async () => check((await api('week/retry', {})).payments.every((p: Json) => p.status === 'planned'), 'changed'));
await step('next week: planned from history, Sunday planning day again', async () => {
  const before = (await state()).week.starts;
  const week = await api('week/next', {});
  check(week.today === -1 && week.payments.length > 0, `today ${week.today}, ${week.payments.length}`);
  check(Date.parse(week.starts) - Date.parse(before) === 7 * 86_400_000, `${before} → ${week.starts}`);
  return `${week.payments.length} payments, week of ${week.starts}`;
});
await api('reset', {});

section('Friends');
await step('add refuses bad emails, "You", blanks and duplicates', async () => {
  await refuses('friends/add', { name: 'Sam', email: 'not-an-email' }, 400, 'email');
  await refuses('friends/add', { name: 'you', email: 'me@example.com' }, 400, "That's you");
  await refuses('friends/add', { name: '  ', email: 'sam@example.com' }, 400, 'name');
  await refuses('friends/add', { name: 'maya', email: 'maya2@example.com' }, 409, 'already');
});
let sam: Json = {};
await step('add a friend by PayPal email: a face, and a payee too', async () => {
  sam = await api('friends/add', { name: 'Sam', email: 'sam@flick.example.com' });
  const s = await state();
  check(sam.color && sam.shape, 'no face');
  check(s.payees.some((p: Json) => p.id === sam.id && p.email === 'sam@flick.example.com'), 'no payee');
});
await step('update syncs the payee; bad ids and emails refused', async () => {
  await refuses('friends/update', { id: 'nope', email: 'x@example.com' }, 404);
  await refuses('friends/update', { id: sam.id, email: 'bad' }, 400);
  await api('friends/update', { id: sam.id, email: 'sam.new@flick.example.com' });
  check((await state()).payees.find((p: Json) => p.id === sam.id)?.email === 'sam.new@flick.example.com', 'payee not synced');
});
await step('remove refuses a friend who still owes, removes one who doesn\'t', async () => {
  await refuses('friends/remove', { id: 'leo' }, 409, 'owes');
  await api('friends/remove', { id: sam.id });
  check(!(await state()).friends.some((f: Json) => f.id === sam.id), 'still there');
});

section('Splitter and Nudge');
const dinner = { merchant: 'Test Bistro', items: [{ name: 'Pizza', price: 24, people: ['you', 'maya', 'leo'] }, { name: 'Salad', price: 9.5, people: ['maya'] }], tax: 2.97, tip: 6.3 };
await step('split refuses bad bills', async () => {
  await refuses('split', { ...dinner, merchant: '' }, 400, 'merchant');
  await refuses('split', { ...dinner, items: [] }, 400, 'items');
  await refuses('split', { ...dinner, items: [{ name: 'Pizza', price: 24, people: ['stranger'] }] }, 400, 'people');
  await refuses('split', { ...dinner, items: [{ name: 'Pizza', price: 24, people: [] }] }, 400, 'Nobody');
  await refuses('split', { ...dinner, tax: -1 }, 400, 'tax');
  await refuses('split', { ...dinner, items: [{ name: 'Pizza', price: 0, people: ['you'] }] }, 400, 'price');
});
let invoiced: Json[] = [];
await step('split sends each friend a real PayPal invoice; shares add up to the bill', async () => {
  const { total, each, debts, failed } = await api('split', dinner);
  check(near(total, 24 + 9.5 + 2.97 + 6.3), `total ${total}`);
  check(near(Object.values(each as Record<string, number>).reduce((a, b) => a + b, 0), total), 'shares do not add up');
  check(debts.length === 2 && !failed?.length && debts.every((d: Json) => d.invoiceId && d.payerUrl), `${debts.length} debts, ${failed?.length} failed`);
  invoiced = debts;
  return Object.entries(each).map(([who, amount]) => `${who} $${amount}`).join(', ');
});
await step('Tick it for me: the AI turns a sentence into who had what', async () => {
  const people = [{ id: 'you', name: 'You' }, { id: 'maya', name: 'Maya' }, { id: 'leo', name: 'Leo' }];
  const { assignments } = await api('split/assign', { items: [{ name: 'Pizza', price: 24 }, { name: 'Salad', price: 9.5 }], people, text: 'Maya and I shared the pizza, Leo had the salad' });
  const of = (item: number) => new Set<string>(assignments.find((a: Json) => a.item === item)?.people ?? []);
  check(of(0).has('you') && of(0).has('maya') && !of(0).has('leo'), `pizza ${[...of(0)]}`);
  check(of(1).has('leo') && of(1).size === 1, `salad ${[...of(1)]}`);
  await refuses('split/assign', { items: [{ name: 'Pizza', price: 24 }], people, text: '' }, 400, 'text');
});
await step('Nudge drafts in every tone, and refuses unknown requests', async () => {
  await refuses('nudge/draft', { debtId: 'nope', tone: 'Friendly' }, 404);
  const drafts = [];
  for (const tone of ['Friendly', 'Funny', 'Straight']) {
    const { text } = await api('nudge/draft', { debtId: invoiced[0].id, tone });
    check(typeof text === 'string' && text.length > 10 && text.length <= 600, `${tone}: ${text}`);
    drafts.push(text);
  }
  check(new Set(drafts).size === 3, 'tones read the same');
  return `"${drafts[1].slice(0, 70)}…"`;
});
await step('Nudge sends a PayPal reminder; empty messages refused', async () => {
  await refuses('nudge/send', { debtId: invoiced[0].id, text: '  ' }, 400, 'text');
  const debt = await api('nudge/send', { debtId: invoiced[0].id, text: 'Quick reminder about Test Bistro!' });
  check(debt.reminders === 1 && debt.remindedAt, `reminders ${debt.reminders}`);
});
await step('Check who\'s paid asks PayPal about every open invoice', async () => {
  const debts = await api('debts/refresh', {});
  check(debts.filter((d: Json) => d.invoiceId).every((d: Json) => d.status === 'requested'), 'something changed unpaid');
});

section('Scout');
let view: Json = {};
await step('the view: 20 products, usuals learned, the next shop quoted everywhere', async () => {
  view = await api('scout');
  check(view.products.length === 20 && view.stores.length === 5, `${view.products.length} products`);
  check(view.products.filter((p: Json) => p.usual).length >= 6, 'too few usuals');
  check(view.basket.items.length > 0, 'nothing due');
  const totals = view.basket.quotes.filter((q: Json) => !q.missing.length).map((q: Json) => q.total);
  check(totals.join() === [...totals].sort((a, b) => a - b).join(), 'quotes not cheapest first');
  return `${view.basket.items.length} due; ${view.basket.quotes[0].storeId} $${view.basket.quotes[0].total}`;
});
await step('quote refuses unknown products and silly quantities', async () => {
  await refuses('scout/quote', { items: [] }, 400);
  await refuses('scout/quote', { items: [{ productId: 'caviar', qty: 1 }] }, 400, 'know');
  await refuses('scout/quote', { items: [{ productId: 'milk', qty: 0 }] }, 400, 'qty');
  await refuses('scout/quote', { items: [{ productId: 'milk', qty: 13 }] }, 400, 'qty');
  await refuses('scout/quote', { items: [{ productId: 'milk', qty: 1.5 }] }, 400, 'qty');
  check((await api('scout/quote', { items: [{ productId: 'milk', qty: 2 }] })).length === 5, 'not 5 quotes');
});
await step('buy refuses unknown stores, missing items and baskets over $500', async () => {
  await refuses('scout/buy', { storeId: 'nope', items: [{ productId: 'milk', qty: 1 }] }, 400);
  await refuses('scout/buy', { storeId: 'bulkbox', items: [{ productId: 'milk', qty: 1 }] }, 409, "doesn't sell");
  const big = ['coffee', 'olive-oil', 'paper-towels', 'chicken', 'butter', 'cheddar'].map((productId) => ({ productId, qty: 12 }));
  await refuses('scout/buy', { storeId: 'corner-grocery', items: big }, 409, '$500');
});
await step('buy prices the basket on the server, whatever the browser says', async () => {
  const best = view.basket.quotes[0];
  const out = await api('scout/buy', { storeId: best.storeId, items: view.basket.items, total: 0.01, price: 0.01 });
  const s = await state();
  const c = s.checkouts[out.orderId];
  check(near(out.amount, best.total) && c.kind === 'basket' && c.storeId === best.storeId, `amount ${out.amount} vs ${best.total}`);
  const res = await call(`paypal/cancel?token=${out.orderId}`);
  check(res.headers.get('location')?.endsWith('/scout?checkout=cancelled'), `${res.headers.get('location')}`);
  return `$${out.amount}`;
});
await step('read refuses non-photos; online prices need Channel3', async () => {
  await refuses('scout/read', { image: 'nope' }, 400, 'data URL');
  const online = await call('scout/online', { productId: 'cornflakes' });
  if (!process.env.CHANNEL3_API_KEY) return check(online.status === 503, `${online.status}`), 'no CHANNEL3_API_KEY: 503, as it should';
  check(online.status === 200 && online.json.offers.every((o: Json, i: number, all: Json[]) => o.url.startsWith('https://') && (i === 0 || all[i - 1].price <= o.price)), 'offers');
  return `${online.json.offers.length} live offers, from $${online.json.offers[0]?.price}`;
});

section('Inbox');
await step('lists what needs you across the agents, with this month\'s impact', async () => {
  const { items, impact } = await api('inbox');
  const kinds = new Set(items.map((i: Json) => i.id.split('-')[0]));
  for (const kind of ['week', 'debt', 'shop']) check(kinds.has(kind), `no ${kind} item in ${[...kinds]}`);
  check(typeof impact.saved === 'number' && typeof impact.paid.count === 'number', 'impact');
  check(new Set(items.map((i: Json) => i.id)).size === items.length, 'duplicate ids');
  return items.map((i: Json) => i.id).join(', ');
});
await step('acting on something gone is refused', () => refuses('inbox/act', { id: 'week-1999-01-04' }, 409));
await step('acting on the shop opens a PayPal checkout', async () => {
  const { items } = await api('inbox');
  const out = await api('inbox/act', { id: items.find((i: Json) => i.id.startsWith('shop-')).id });
  check(out.approveUrl?.includes('sandbox.paypal.com'), JSON.stringify(out));
});

section('Notifications');
await step('the public key is a P-256 point', async () => check(Buffer.from((await api('push/key')).publicKey, 'base64url').length === 65, 'not 65 bytes'));
await step('subscribe takes only real browser push services', async () => {
  await refuses('push/subscribe', {}, 400);
  await refuses('push/subscribe', { subscription: { endpoint: 'https://evil.example.com/push', keys: { p256dh: 'a', auth: 'b' } } }, 400, 'push subscription');
  await refuses('push/subscribe', { subscription: { endpoint: 'http://fcm.googleapis.com/fcm/send/x', keys: { p256dh: 'a', auth: 'b' } } }, 400, 'push subscription');
  await refuses('push/subscribe', { subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/x' } }, 400, 'keys');
  await api('push/unsubscribe', { endpoint: 'https://fcm.googleapis.com/fcm/send/x' });
});

section('Ask Flick');
await step('refuses an empty conversation', () => refuses('agent', { messages: [] }, 400));
await step('answers a question from the real data, with no actions', async () => {
  const turn = await api('agent', { messages: [{ role: 'user', content: 'How much do my payments this week come to?' }] });
  check(turn.steps.length && !turn.pending?.length, `steps ${turn.steps}, pending ${turn.pending?.length}`);
  check(/142\.30/.test(turn.reply), `reply: ${turn.reply}`);
  check(!/\*\*|^#/m.test(turn.reply), `markdown in the reply: ${turn.reply}`);
  return turn.reply.slice(0, 90);
});
await step('proposes a reminder, and does nothing when told no', async () => {
  const before = (await state()).debts.find((d: Json) => d.id === 'debt_leo').reminders;
  const turn = await api('agent', { messages: [{ role: 'user', content: 'Send Leo a friendly reminder about the cab.' }] });
  const card = turn.pending?.find((p: Json) => /Leo/.test(p.summary));
  check(card, `no card: ${turn.reply} ${JSON.stringify(turn.pending)}`);
  await api('agent/decide', { messages: turn.messages, decisions: { [card.id]: false } });
  check((await state()).debts.find((d: Json) => d.id === 'debt_leo').reminders === before, 'it sent anyway');
  return card.summary;
});
await step('proposes groceries from Scout, priced on the server', async () => {
  const turn = await api('agent', { messages: [{ role: 'user', content: 'Get my usual groceries at the cheapest store.' }] });
  const card = turn.pending?.find((p: Json) => /groceries/i.test(p.summary));
  check(card, `no grocery card: ${turn.reply}`);
  return card.summary;
});

section('Money Studio');
await step('the dashboard\'s tables, from PayPal and Flick', async () => {
  const data = await api('dashboard');
  const tables = Object.keys(data).filter((k) => Array.isArray(data[k]));
  for (const t of ['flickPayments', 'flickHistory', 'flickRequests', 'flickActivity']) check(tables.includes(t) && data[t].length, `no ${t}`);
  return `${tables.length} tables${data.warnings?.length ? `; warnings: ${data.warnings.join('; ')}` : ''}`;
});
await step('the assistant\'s models', async () => check((await api('ai/models')).length > 0, 'none'));

done();
