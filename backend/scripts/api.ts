// `npm run api`: every route of Flick's API, the way it's meant to be used and the ways it isn't, on
// its own backend (port 4200, a throwaway state file). Real calls to the PayPal sandbox and the AI
// model; no money moves without a buyer's approval, so checkouts are created and then cancelled.
// The approval page itself is `npm run loop`'s job.

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { workspaceFor } from '../src/account.ts';
import { seed } from '../src/seed.ts';
import { check, checklist, client, startBackend, type Json } from './harness.ts';

// Our own state folder, so a signed-in person's workspace can be put there (Signing in, below).
const dir = mkdtempSync(join(tmpdir(), 'flick-api-'));
// A made-up webhook id: PayPal's check of a webhook's signature runs for real, and must say no.
const base = await startBackend(4200, { STATE_FILE: join(dir, 'state.json'), PAYPAL_WEBHOOK_ID: 'WH-FLICK-API-TEST' });
const { call, api, refuses } = client(base);
const { step, section, done } = checklist();
const state = () => api('state');
const near = (a: number, b: number) => Math.abs(a - b) < 0.005;

section('Basics');
await step('health', async () => check((await api('health')).ok === true, 'not ok'));
await step('an unknown route is a 404 in JSON', () => refuses('nope', undefined, 404, 'No route'));
await step('a body that isn\'t JSON is refused', () => refuses('week/edit', '{not json', 400, 'must be JSON'));
await step('a JSON array is refused', () => refuses('week/edit', '[1,2]', 400, 'JSON object'));
await step('a POST with no body, as the browser sends it (Content-Length: 0), counts as {}', async () => {
  const res = await call('week/edit', undefined, { method: 'POST', headers: { 'Content-Length': '0' } });
  check(!/must be JSON/.test(res.json?.error?.message ?? ''), `answered ${res.status}: ${res.json?.error?.message}`);
});
await step('a body over 8 MB is refused', () => refuses('lens/read', JSON.stringify({ image: 'x'.repeat(9_000_000) }), 413, 'too large'));
await step('state: PayPal and AI configured, the seeded week of six payments, $142.30', async () => {
  const s = await state();
  check(s.config.paypal && s.config.ai, `config ${JSON.stringify(s.config)}`);
  check(s.week.payments.length === 6, `${s.week.payments.length} payments`);
  check(near(s.week.payments.reduce((sum: number, p: Json) => sum + p.amount, 0), 142.3), 'not $142.30');
  check(s.week.today === -1, `today ${s.week.today}`);
});

await step('each browser has its own workspace: empty to start, and private to it', async () => {
  const as = (workspace: string) => (path: string, body?: unknown) =>
    fetch(`${base}/api/${path}`, { method: body ? 'POST' : 'GET', headers: { cookie: `flick=${workspace}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json() as Promise<Json>);
  const [mine, theirs] = [as(`test-${crypto.randomUUID()}`), as(`test-${crypto.randomUUID()}`)];
  const fresh = await mine('state');
  check(!fresh.friends.length && !fresh.scans.length && !fresh.debts.length && !fresh.week.payments.length, 'a new workspace isn\'t empty');
  await mine('friends/add', { name: 'Robin', email: 'robin@flick.example.com' });
  check((await mine('state')).friends.some((f: Json) => f.name === 'Robin'), 'my friend is missing');
  check(!(await theirs('state')).friends.length, 'another browser sees my friend');
  check(!(await state()).friends.some((f: Json) => f.name === 'Robin'), 'the local workspace sees my friend');
  const sample = await theirs('dashboard');
  check(sample.warnings[0]?.startsWith('This is sample data') && sample.flickPayments.length === 6, 'a new workspace\'s Money Studio isn\'t the sample');
  check(!(await mine('inbox')).items.length, 'a new workspace has inbox items');
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

section('PayPal webhooks');
// A real webhook needs PayPal's signature, which only PayPal can make; webhooks.test.ts and
// webhooks-route.test.ts apply signed events. Here: what anyone else sends changes nothing.
const paid = () => ({ id: `WH-API-${crypto.randomUUID()}`, event_type: 'INVOICING.INVOICE.PAID', resource: { id: invoiced[0].invoiceId, status: 'PAID' } });
const stillOwed = async () => (await state()).debts.find((d: Json) => d.id === invoiced[0].id)?.status === 'requested';
await step('an "invoice paid" with no PayPal signature is turned away', async () => {
  const res = await call('paypal/webhook', paid());
  check(res.status === 200 && res.json.ok === false && res.json.reason === 'invalid signature', `${res.status} ${JSON.stringify(res.json)}`);
  check(await stillOwed(), 'the request was marked paid');
});
await step('a forged signature is checked with PayPal, which says no', async () => {
  const res = await call('paypal/webhook', paid(), {
    headers: {
      'Content-Type': 'application/json',
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-360caa42-fca2a594-a5cafa77',
      'paypal-transmission-id': crypto.randomUUID(),
      'paypal-transmission-sig': Buffer.from('not PayPal').toString('base64'),
      'paypal-transmission-time': new Date().toISOString(),
    },
  });
  check(res.json.ok === false && res.json.reason === 'invalid signature', JSON.stringify(res.json));
  check(await stillOwed(), 'the request was marked paid');
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

section('Signing in');
// A browser's requests, with its session cookie.
const as = (workspace: string) => (path: string, body?: unknown) =>
  call(path, body, { headers: { cookie: `flick=${workspace}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) } });
const guest = as('signin-guest-0000001');
const where = (res: { headers: Headers }) => res.headers.get('location') ?? '';
await step('signing in starts on PayPal, on a page that saves PayPal with Flick', async () => {
  const res = await guest('auth/paypal/start?next=/lens');
  const to = new URL(where(res));
  check(res.status === 303 && to.hostname === 'www.sandbox.paypal.com' && to.pathname.startsWith('/agreements/approve'), `${res.status} to ${to.href}`);
});
await step('a sign-in another browser started, or a made-up one, signs no one in', async () => {
  const other = await as('signin-other-0000001')('auth/paypal/return?approval_token_id=NOT-THIS-ONE');
  const wrong = await guest('auth/paypal/return?approval_token_id=NOT-THIS-ONE');
  for (const res of [other, wrong]) check(res.status === 303 && where(res).endsWith('/login?signin=failed') && !res.headers.get('set-cookie'), `${res.status} to ${where(res)}`);
});
await step('cancelling on PayPal comes back to /login', async () => {
  const res = await guest('auth/paypal/cancel');
  check(res.status === 303 && where(res).endsWith('/login?signin=cancelled'), `${res.status} to ${where(res)}`);
});
// Someone signed in: their workspace as account.ts leaves it (here the demo seed), with a saved
// PayPal that PayPal won't know.
const signedIn = workspaceFor('api-test@flick.example.com');
mkdirSync(join(dir, 'workspaces'), { recursive: true });
writeFileSync(
  join(dir, 'workspaces', `${signedIn}.json`),
  JSON.stringify({ ...seed(), profile: { name: 'Api Test', email: 'api-test@flick.example.com', savedId: 'not-a-real-vault-id', since: new Date().toISOString() } }),
);
const me = as(signedIn);
await step("state says who's signed in, never their saved PayPal's vault id", async () => {
  const { json } = await me('state');
  check(json.profile?.name === 'Api Test' && json.profile.savedId === '' && !json.signingIn, JSON.stringify(json.profile));
  check(!JSON.stringify(json).includes('not-a-real-vault-id'), 'the vault id is in the state');
});
await step('a signed-in person changes the name Flick calls them; a guest, or a blank name, is refused', async () => {
  check((await guest('profile', { name: 'Robin' })).status === 409, 'a guest renamed themselves');
  check((await me('profile', { name: '   ' })).status === 400, 'a blank name was taken');
  const { json } = await me('profile', { name: '  Swarnim   Raj ' });
  check(json.name === 'Swarnim Raj' && json.named === true && json.savedId === '', JSON.stringify(json));
  check((await me('state')).json.profile?.name === 'Swarnim Raj', 'state still has the old name');
});
await step("a guest's flick is refused: paying with a flick needs a saved PayPal", async () => {
  const { orderId } = await api('lens/pay', { scanId: 'scan_seed' });
  await refuses('paypal/flick', { orderId }, 409, 'Sign in with PayPal');
  await call(`paypal/cancel?token=${orderId}`);
});
await step('a flick PayPal turns down pays nothing, and the bill waits', async () => {
  const { json: started } = await me('lens/pay', { scanId: 'scan_seed' });
  const res = await me('paypal/flick', { orderId: started.orderId });
  const after = (await me('state')).json;
  check(res.status >= 400, `answered ${res.status}`);
  check(after.checkouts[started.orderId]?.status === 'awaiting' && after.scans.find((s: Json) => s.id === 'scan_seed')?.status === 'awaiting', 'it counts as paid');
  await me(`paypal/cancel?token=${started.orderId}`);
  return `${res.status}: ${String(res.json.error?.message ?? '').slice(0, 90)}`;
});
await step('signing out ends the session', async () => {
  const res = await me('auth/signout', {});
  const cookie = res.headers.get('set-cookie') ?? '';
  check(res.status === 200 && cookie.startsWith('flick=;') && cookie.includes('Max-Age=0'), cookie);
});

section('Flick Chat');
// A second person signed in, Robin, with a saved PayPal PayPal won't know either: chatting with them
// works, paying fails safely. (scripts/../frontend e2e pays a request for real.)
const ME = 'api-test@flick.example.com';
const ROBIN = 'api-robin@flick.example.com';
const robinWs = workspaceFor(ROBIN);
writeFileSync(
  join(dir, 'workspaces', `${robinWs}.json`),
  JSON.stringify({ ...seed(), friends: [], debts: [], profile: { name: 'Robin', email: ROBIN, savedId: 'not-a-real-vault-id-2', since: new Date().toISOString() } }),
);
const robin = as(robinWs);
const PHOTO = `data:image/jpeg;base64,${Buffer.from('a small jpeg, as Lens keeps').toString('base64')}`;
const thread = async (who: typeof me, other: string) => (await who(`chat/thread?with=${encodeURIComponent(other)}`)).json;
let asked = '';
await step('a guest has no chats: Flick Chat needs signing in', async () => {
  const res = await guest('chat');
  check(res.status === 401 && /Sign in with PayPal/.test(res.json.error?.message), `${res.status}`);
});
await step("friends are in your chats; one who hasn't signed in isn't on Flick, so only a request reaches them", async () => {
  await robin('state'); // Robin's first visit puts them on Flick.
  const { json } = await me('chat');
  const maya = json.chats.find((c: Json) => c.peer.name === 'Maya');
  check(maya && !maya.peer.onFlick && json.me.email === ME, JSON.stringify(json).slice(0, 200));
  const res = await me('chat/send', { with: maya.peer.email, text: 'Hi Maya' });
  check(res.status === 409 && /isn't on Flick yet/.test(res.json.error?.message), `${res.status}`);
  check((await me('chat/send', { with: ME, text: 'Me?' })).status === 400, 'chatted with myself');
});
await step('a message reaches a friend on Flick, and their chats show who started it', async () => {
  const { json } = await me('chat/send', { with: ROBIN, text: 'Dinner was fun!' });
  check(json.kind === 'text' && json.from === ME, JSON.stringify(json));
  const theirs = (await robin('chat')).json.chats.find((c: Json) => c.peer.email === ME);
  check(theirs?.peer.onFlick && theirs.peer.name === 'Swarnim Raj' && theirs.unread === 1 && theirs.last.text === 'Dinner was fun!', JSON.stringify(theirs));
});
await step("Robin's unread: a count and the newest message, gone once read; a guest has none", async () => {
  const { json: before } = await robin('chat/unread');
  check(before.count >= 1 && before.latest?.peer.email === ME && before.latest.text === 'Dinner was fun!', JSON.stringify(before));
  await thread(robin, ME);
  check((await robin('chat/unread')).json.count === 0, 'still unread after reading');
  const { status, json } = await guest('chat/unread');
  check(status === 200 && json.count === 0 && !json.latest, `${status} ${JSON.stringify(json)}`);
});
await step('a request with the bill\'s photo: in the chat, and in your Flick as a request Nudge follows', async () => {
  check((await me('chat/request', { with: ROBIN, amount: 12.5, what: 'Dinner', photo: 'data:image/png;base64,AAAA' })).status === 400, 'took a PNG');
  check((await me('chat/request', { with: ROBIN, amount: 0, what: 'Dinner' })).status === 400, 'took $0');
  const { json } = await me('chat/request', { with: ROBIN, amount: 12.5, what: 'Dinner', photo: PHOTO });
  check(json.message?.status === 'open' && json.message.photo === PHOTO && json.debt?.chat?.with === ROBIN, JSON.stringify(json).slice(0, 200));
  asked = json.message.id;
  const debt = (await me('state')).json.debts.find((d: Json) => d.id === json.debt.id);
  check(debt?.status === 'requested' && !debt.invoiceId, JSON.stringify(debt));
  check((await me('state')).json.friends.some((f: Json) => f.email === ROBIN), 'Robin isn\'t a friend now');
});
await step('Robin sees it with its photo, and Today asks them to pay it', async () => {
  const t = await thread(robin, ME);
  check(t.messages.some((m: Json) => m.id === asked && m.photo === PHOTO), 'not in the chat');
  check((await robin('chat')).json.chats.find((c: Json) => c.peer.email === ME)?.youOwe === 12.5, 'not owed');
  const items = (await robin('inbox')).json.items;
  check(items.some((i: Json) => i.title === 'Swarnim Raj asked you for $12.50' && i.action === 'Pay now'), JSON.stringify(items.map((i: Json) => i.title)));
  const again = await thread(robin, ME);
  check((await thread(robin, ME)).v === again.v && (await robin(`chat/thread?with=${ME}&v=${again.v}`)).json.same === true, 'polling sends it all again');
});
await step('only Robin pays it, and PayPal turning down their saved PayPal pays nothing', async () => {
  check((await me('chat/pay', { with: ROBIN, id: asked })).status === 409, 'I paid my own request');
  const res = await robin('chat/pay', { with: ME, id: asked });
  check(res.status === 402 && /PayPal turned it down/.test(res.json.error?.message), `${res.status}: ${res.json.error?.message}`);
  check((await thread(robin, ME)).messages.find((m: Json) => m.id === asked)?.status === 'open', 'not open again');
  return `${res.status}: ${res.json.error?.message}`;
});
await step('a reminder from Nudge goes into the chat', async () => {
  const { json } = await me('chat/remind', { with: ROBIN, id: asked, tone: 'Funny' });
  check(json.reminders === 1, JSON.stringify(json));
  const reminder = (await thread(robin, ME)).messages.find((m: Json) => m.kind === 'reminder' && m.about === asked);
  check(reminder?.text, 'no reminder');
  check((await robin('chat/remind', { with: ME, id: asked })).status === 409, 'Robin reminded themselves');
  return reminder.text;
});
await step('Robin turns it down: it closes in your Flick too', async () => {
  check((await robin('chat/decline', { with: ME, id: asked })).json.status === 'declined', 'not declined');
  check((await robin('chat/decline', { with: ME, id: asked })).status === 409, 'declined twice');
  check((await robin('chat/pay', { with: ME, id: asked })).status === 409, 'paid after declining');
  const debt = (await me('state')).json.debts.find((d: Json) => d.chat?.message === asked);
  check(debt?.status === 'cancelled', JSON.stringify(debt));
});
await step('pays by itself up to the limit Robin set: over it, a request waits for them', async () => {
  check((await robin('chat/allow', { with: ME, cap: 600 })).status === 400, 'took $600');
  check((await robin('chat/allow', { with: ME, cap: 20 })).json.mine === 20, 'no limit');
  check((await thread(me, ROBIN)).autopay.theirs === 20, "I can't see Robin's limit");
  const over = (await me('chat/request', { with: ROBIN, amount: 25, what: 'Tickets' })).json;
  check(over.message.status === 'open' && !over.message.tries, 'tried to pay it');
  // Under it: Flick tries Robin's saved PayPal at once. PayPal says no to this one, so it waits for them.
  const under = await me('chat/request', { with: ROBIN, amount: 8, what: 'Coffee' });
  check(under.status === 200 && under.json.message.status === 'open' && under.json.message.tries === 1, JSON.stringify(under.json.message));
  check((await robin('chat/allow', { with: ME, cap: 0 })).json.mine === 0, 'still on');
});
await step('Split asks a friend on Flick in the chat, not with an invoice', async () => {
  const id = (await me('state')).json.friends.find((f: Json) => f.email === ROBIN).id;
  const { json } = await me('split', { merchant: 'Taco Night', items: [{ name: 'Tacos', price: 20, people: ['you', id] }] });
  check(json.debts.length === 1 && json.debts[0].chat?.with === ROBIN && !json.debts[0].invoiceId && json.debts[0].split, JSON.stringify(json.debts));
  check((await thread(robin, ME)).messages.some((m: Json) => m.kind === 'request' && m.what === 'Taco Night' && m.amount === 10 && /Tacos/.test(m.text)), 'not in the chat');
});

await step("the profile's money adds up your Flick afresh: what you're owed, and what you owe in Chat", async () => {
  const { json: mine } = await me('profile/money');
  const s = (await me('state')).json;
  const open = s.debts.filter((d: Json) => d.status === 'requested');
  check(near(mine.owedToYou.amount, open.reduce((t: number, d: Json) => t + d.amount, 0)) && mine.owedToYou.count === open.length, JSON.stringify(mine.owedToYou));
  const captured = Object.values(s.checkouts as Record<string, Json>).filter((c) => c.status === 'captured');
  check(near(mine.where.bills + mine.where.groceries, captured.filter((c) => c.kind !== 'week').reduce((t: number, c) => t + c.amount, 0)), JSON.stringify(mine.where));
  const { json: theirs } = await robin('profile/money');
  const youOwe = (await robin('chat')).json.chats.find((c: Json) => c.peer.email === ME)?.youOwe ?? 0;
  check(near(theirs.youOwe.amount, youOwe), `Robin owes ${theirs.youOwe.amount}, the chat says ${youOwe}`);
  check((await guest('profile/money')).status === 409, 'a guest has money');
  return `owed to you ${mine.owedToYou.amount} (${mine.owedToYou.count}), Robin owes ${theirs.youOwe.amount}`;
});

section('Businesses');
// Kai has a KFC bill Lens read before KFC was on Flick: its payee is a placeholder.
const kaiWs = 'api-kai-000000000001';
writeFileSync(
  join(dir, 'workspaces', `${kaiWs}.json`),
  JSON.stringify({
    ...seed(),
    payees: [{ id: 'kfc-1', name: 'KFC Koramangala', email: 'kfc-koramangala@flick.example.com', icon: 'bill' }],
    scans: [{ id: 'scan_kfc', at: new Date().toISOString(), kind: 'bill', title: 'KFC Koramangala', summary: 'Dinner', amount: 7.5, currency: 'USD', due: null, repeats: null, handle: null, items: [], tax: 0, tip: 0, fields: [], status: 'read', payeeId: 'kfc-1' }],
  }),
);
const kai = as(kaiWs);
await step('a business registers with the PayPal it signed in with; a guest, a blank or a taken name is refused', async () => {
  check((await guest('business', { name: 'KFC' })).status === 409, 'a guest registered a business');
  check((await me('business', { name: ' ' })).status === 400, 'a blank name was taken');
  const { json } = await me('business', { name: 'KFC', names: 'Kentucky Fried Chicken' });
  check(json.yours?.email === ME && json.yours.names.join() === 'KFC,Kentucky Fried Chicken', JSON.stringify(json.yours));
  const taken = await robin('business', { name: 'Fried Things', names: ['kfc'] });
  check(taken.status === 409 && /already on Flick/.test(taken.json.error?.message), `${taken.status}`);
  check((await guest('business')).json.all.some((b: Json) => b.name === 'KFC' && !('email' in b)), 'the directory shows emails, or not KFC');
});
await step("a bill from a registered business pays its PayPal, even one read before it registered", async () => {
  const { json: started } = await kai('lens/pay', { scanId: 'scan_kfc' });
  check(Boolean(started.orderId), JSON.stringify(started));
  const payee = (await kai('state')).json.payees.find((p: Json) => p.id === 'kfc-1');
  check(payee.email === ME && payee.business, JSON.stringify(payee));
  await kai(`paypal/cancel?token=${started.orderId}`);
});
await step('taking the business off Flick: its names are free again', async () => {
  check((await me('business/remove', {})).json.yours === null, 'still registered');
  check(!(await guest('business')).json.all.some((b: Json) => b.name === 'KFC'), 'KFC still listed');
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
