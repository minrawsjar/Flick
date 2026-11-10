// `npm run loop`: the whole money loop, end to end, on the PayPal sandbox, with your own keys.
//
// It starts its own backend (port 4100, a throwaway state file, so your data is untouched), then
// walks every flow through the API, and drives a headless Chrome through PayPal's real approval
// page wherever money moves, logged in as a sandbox *personal* account:
//
//   SANDBOX_BUYER_EMAIL=...      in backend/.env (a US sandbox personal test account)
//   SANDBOX_BUYER_PASSWORD=...
//
// Lens reads a bill and pays it · Autopilot's week is approved with PayPal saved, paid out day by
// day, and the next week pays itself · Scout buys the usuals · Splitter invoices, Nudge reminds ·
// the inbox acts · Ask Flick buys groceries after approval · Autopilot stops and forgets PayPal.
// Needs Google Chrome (CHROME=/path/to/chrome elsewhere) and the AI key for Lens and Ask Flick.

import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 4100;
const BASE = `http://localhost:${PORT}`;
const email = process.env.SANDBOX_BUYER_EMAIL;
const password = process.env.SANDBOX_BUYER_PASSWORD;
if (!email || !password) {
  console.error('Set SANDBOX_BUYER_EMAIL and SANDBOX_BUYER_PASSWORD (a US sandbox personal account) in backend/.env.');
  process.exit(1);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const results: string[] = [];
async function step(name: string, work: () => Promise<string | void>) {
  const started = Date.now();
  try {
    const note = await work();
    results.push(`✓ ${name}${note ? `: ${note}` : ''} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  } catch (err) {
    failures++;
    results.push(`✗ ${name}: ${err instanceof Error ? err.message : String(err)}`);
  }
  console.log(results.at(-1));
}
function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}

// --- The backend ----------------------------------------------------------------------------

const dir = mkdtempSync(join(tmpdir(), 'flick-loop-'));
const server = spawn(process.execPath, ['src/server.ts'], {
  env: { ...process.env, PORT: String(PORT), STATE_FILE: join(dir, 'state.json'), FRONTEND_URL: BASE, PUSH_DELAY_MS: '0', AI_HOURLY_LIMIT: '1000' },
  stdio: ['ignore', 'ignore', 'inherit'],
});
process.on('exit', () => server.kill());

type Json = Record<string, any>;
async function api(path: string, body?: unknown): Promise<Json> {
  const res = await fetch(`${BASE}/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok) throw new Error(`${path}: ${res.status} ${data?.error?.message ?? ''}`);
  return data;
}
for (let i = 0; ; i++) {
  if (await fetch(`${BASE}/api/health`).then((r) => r.ok, () => false)) break;
  if (i > 50) throw new Error('The backend did not start.');
  await sleep(200);
}

// --- Chrome, over the DevTools protocol ---------------------------------------------------

const chromePath = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const debugPort = 9600 + Math.floor(Math.random() * 300);
const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'flick-chrome-'))}`, '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => chrome.kill());

let ws: WebSocket | undefined;
for (let i = 0; !ws && i < 50; i++) {
  await sleep(200);
  try {
    const tabs = (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()) as { type: string; webSocketDebuggerUrl: string }[];
    ws = new WebSocket(tabs.find((t) => t.type === 'page')!.webSocketDebuggerUrl);
  } catch {}
}
await new Promise((r) => ws!.addEventListener('open', r));
let seq = 0;
const waiting = new Map<number, (m: Json) => void>();
ws!.addEventListener('message', (e) => {
  const m = JSON.parse(String(e.data));
  if (m.id && waiting.has(m.id)) waiting.get(m.id)!(m), waiting.delete(m.id);
});
const cdp = (method: string, params: Json = {}) => new Promise<Json>((r) => { const id = ++seq; waiting.set(id, r); ws!.send(JSON.stringify({ id, method, params })); });
const js = async (expression: string) => (await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
await cdp('Page.enable');

/** A photo of a bill, drawn in the browser, for Lens to read. */
async function billPhoto() {
  const html = `<body style="margin:0;background:#2a241d;display:grid;place-items:center;height:100vh"><div style="background:#fff;width:420px;padding:28px;font:16px Helvetica;transform:rotate(-1deg)"><b style="font-size:24px">NORTHSIDE INTERNET</b><br>Broadband, monthly statement<br><br>Account 7734-21<br>Period: 1 Nov – 30 Nov 2026<br><br><b style="font-size:22px">Amount due: $39.99</b><br>Due by: 2026-11-24</div></body>`;
  await cdp('Page.navigate', { url: `data:text/html,${encodeURIComponent(html)}` });
  await sleep(600);
  const shot = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
  return `data:image/jpeg;base64,${shot.result.data}`;
}

/** Approves a checkout on PayPal's sandbox page as the buyer, and follows it back to Flick. */
async function approveOnPayPal(approveUrl: string) {
  await cdp('Page.navigate', { url: approveUrl });
  const type = async (selector: string, text: string) => {
    await js(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.select?.(); })()`);
    await cdp('Input.insertText', { text });
  };
  for (let i = 0; i < 90; i++) {
    await sleep(1500);
    const page = await js(`(() => {
      const visible = (el) => el && el.offsetParent !== null && !el.disabled;
      const email = document.querySelector('#email'), pass = document.querySelector('#password');
      const buttons = [...document.querySelectorAll('button, input[type=submit]')].filter(visible).map((b) => (b.innerText || b.value || '').trim());
      return { url: location.href, email: visible(email) ? email.value : null, password: visible(pass) ? pass.value : null, buttons };
    })()`) as { url: string; email: string | null; password: string | null; buttons: string[] } | undefined;
    if (!page) continue;
    if (page.url.startsWith(BASE)) return page.url;
    if (page.email === '') {
      await type('#email', email!);
      await js(`(document.querySelector('#btnNext') || document.querySelector('#btnLogin'))?.click()`);
      continue;
    }
    if (page.password === '') {
      await type('#password', password!);
      await js(`document.querySelector('#btnLogin')?.click()`);
      continue;
    }
    const pay = page.buttons.find((b) => /^(pay|agree|continue|complete|review order|save and continue)/i.test(b));
    if (pay) await js(`[...document.querySelectorAll('button, input[type=submit]')].find((b) => (b.innerText || b.value || '').trim() === ${JSON.stringify(pay)})?.click()`);
  }
  throw new Error(`PayPal's page never sent the buyer back (stuck at ${(await js('location.href')) ?? '?'})`);
}

/** Approves on PayPal and checks Flick captured it. */
async function approveAndCheck(approveUrl: string, kind: string) {
  const back = await approveOnPayPal(approveUrl);
  check(back.includes(`paid=${kind}`), `came back to ${back.replace(BASE, '')}, not ?paid=${kind}`);
}

// --- The loop -------------------------------------------------------------------------------

await api('reset', {});
const config = (await api('state')).config;
console.log(`Flick loop on ${BASE}: PayPal ${config.paypal ? 'on' : 'OFF'}, AI ${config.ai ? 'on' : 'off'}\n`);

await step('Lens reads a bill from a photo', async () => {
  const scan = await api('lens/read', { image: await billPhoto() });
  check(scan.kind === 'bill' && Math.abs(scan.amount - 39.99) < 0.01, `read ${scan.kind} ${scan.amount}`);
  (globalThis as Json).scan = scan;
  return `${scan.title}, $${scan.amount}`;
});

await step('Lens pays it through PayPal (checkout, capture, payout)', async () => {
  const scan = (globalThis as Json).scan;
  check(scan, 'no scan from the step before');
  const { approveUrl } = await api('lens/pay', { scanId: scan.id, repeat: true });
  await approveAndCheck(approveUrl, 'scan');
  const state = await api('state');
  const paid = state.scans.find((s: Json) => s.id === scan.id);
  check(paid?.status === 'paid', `scan is ${paid?.status}`);
  check(state.activity.some((a: Json) => a.agent === 'lens' && a.text.startsWith('Paid')), 'no payout logged');
  check(state.monthly.some((m: Json) => m.payeeId === scan.payeeId), 'not learned as monthly');
});

await step('Autopilot: approve the week with Save PayPal', async () => {
  const { approveUrl } = await api('week/approve', { save: true });
  await approveAndCheck(approveUrl, 'week');
  const state = await api('state');
  check(state.week.approval?.status === 'approved', `approval is ${state.week.approval?.status}`);
  return state.autopay ? `PayPal saved (${state.autopay.email ?? 'vaulted'})` : "approved, but PayPal didn't save the account (turn on Save payment methods in the sandbox app)";
});

await step('Autopilot pays each day out (Payouts)', async () => {
  let week: Json = {};
  for (let d = 0; d < 7; d++) week = await api('week/tick', {});
  const paid = week.payments.filter((p: Json) => p.status === 'paid').length;
  const failed = week.payments.filter((p: Json) => p.status === 'failed');
  check(!failed.length, `${failed.length} failed: ${failed[0]?.error ?? ''}`);
  return `${paid} of ${week.payments.length} paid`;
});

await step('Next week pays itself with the saved PayPal', async () => {
  const before = await api('state');
  if (!before.autopay) return 'skipped: no saved PayPal';
  const week = await api('week/next', {});
  const state = await api('state');
  check(state.week.approval?.status === 'approved', `next week is ${state.week.approval?.status ?? 'not approved'}: ${state.activity[0]?.text}`);
  return `week of ${week.starts}, $${state.week.approval.amount}, no approval page`;
});

await step('Scout buys the usuals at the cheapest store', async () => {
  const scout = await api('scout');
  const best = scout.basket.quotes.find((q: Json) => !q.missing.length);
  check(best, 'no store has the basket');
  const { approveUrl } = await api('scout/buy', { storeId: best.storeId, items: scout.basket.items });
  await approveAndCheck(approveUrl, 'basket');
  const state = await api('state');
  check(state.scout.purchases.some((p: Json) => p.from === 'scout'), 'no purchase recorded');
  check(state.activity.some((a: Json) => a.agent === 'scout' && a.text.startsWith('Bought')), 'no payout logged');
  return `${best.storeId}, $${best.total}`;
});

await step('Splitter invoices friends, Nudge reminds one', async () => {
  const { debts, failed } = await api('split', { merchant: 'Loop Diner', items: [{ name: 'Pizza', price: 24, people: ['you', 'maya', 'leo'] }, { name: 'Salad', price: 9, people: ['maya'] }], tax: 2.9, tip: 6 });
  check(debts.length === 2 && !failed?.length, `${debts.length} invoices, ${failed?.length ?? 0} failed`);
  const { text } = await api('nudge/draft', { debtId: debts[0].id, tone: 'Funny' });
  await api('nudge/send', { debtId: debts[0].id, text });
  await api('debts/refresh', {});
  return `invoiced ${debts.map((d: Json) => `$${d.amount}`).join(' and ')}; reminded`;
});

await step('The inbox lists what needs you, and acts', async () => {
  const { items, impact } = await api('inbox');
  const remind = items.find((i: Json) => i.id.startsWith('debt-'));
  check(remind, `no reminder among ${items.map((i: Json) => i.id).join(', ')}`);
  const out = await api('inbox/act', { id: remind.id });
  const again = await api('inbox');
  check(!again.items.some((i: Json) => i.id === remind.id), 'the item is still there');
  return `${items.length} items; "${out.done}"; this month: saved $${impact.saved}, paid ${impact.paid.count}`;
});

await step('Ask Flick buys groceries, after approval', async () => {
  const messages = [{ role: 'user', content: 'Buy two bags of coffee beans at the cheapest store that has them.' }];
  const turn = await api('agent', { messages });
  const buy = turn.pending?.find((p: Json) => /groceries/i.test(p.summary));
  check(buy, `no grocery action proposed: ${turn.reply ?? JSON.stringify(turn.pending)}`);
  const done = await api('agent/decide', { messages: turn.messages, decisions: Object.fromEntries(turn.pending.map((p: Json) => [p.id, p.id === buy.id])) });
  const link = done.links?.[0];
  check(link?.url, `no PayPal link: ${done.reply}`);
  await approveAndCheck(link.url, 'basket');
  return buy.summary;
});

await step('Autopilot stops paying by itself, and PayPal forgets the account', async () => {
  const state = await api('state');
  if (!state.autopay) return 'skipped: no saved PayPal';
  await api('autopay/stop', {});
  check(!(await api('state')).autopay, 'still saved');
});

console.log(`\n${results.length - failures} of ${results.length} steps passed.`);
process.exit(failures ? 1 : 0);
