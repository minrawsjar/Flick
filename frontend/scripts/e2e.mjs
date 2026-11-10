// `npm run e2e`: Flick in a real browser, front to back. It builds the frontend (into .next-e2e,
// pointed at a backend of its own on a throwaway state file), starts both, and drives a headless
// Chrome over the DevTools protocol:
//
// 1. Every page at phone size (light and dark) and desktop size: no console errors, uncaught
//    exceptions or failed requests, nothing wider than the screen, and its content there.
// 2. What a person does, on a phone: the tab bar and switches, the theme, Today's inbox, Lens
//    reading a sample bill and opening PayPal, Autopilot's days, Scout reading a list, Splitter's
//    sentence and requests, Nudge's tones, Friends, Ask Flick, the install page, Money Studio.
// 3. The installed app: installable, the service worker in charge, opening offline, a photo
//    shared to Flick read by Lens, and a notification through a real push service.
// 4. With SANDBOX_BUYER_EMAIL / SANDBOX_BUYER_PASSWORD in backend/.env: paying a bill on PayPal's
//    real page from the Lens screen, and back to Flick's "Paid with PayPal".
//
// Real PayPal sandbox and AI calls, with the keys in backend/.env. Needs Google Chrome (CHROME=...).

import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FRONT = 3300;
const BACK = 4300;
const SITE = `http://localhost:${FRONT}`;
const here = new URL("..", import.meta.url).pathname;
const env = Object.fromEntries(
  readFileSync(new URL("../../backend/.env", import.meta.url), "utf8")
    .split("\n")
    .flatMap((line) => (/^[A-Z_0-9]+=/.test(line) ? [[line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]] : [])),
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const children = [];
process.on("exit", () => children.forEach((c) => c.kill()));
for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, () => process.exit(1));

// --- Build and start ---------------------------------------------------------------------

console.log("Building the frontend for the test…");
const build = spawnSync("npx", ["next", "build"], { cwd: here, env: { ...process.env, NEXT_DIST_DIR: ".next-e2e", BACKEND_URL: `http://localhost:${BACK}` }, encoding: "utf8" });
if (build.status !== 0) {
  console.error(build.stdout.slice(-2000), build.stderr.slice(-2000));
  process.exit(1);
}
const backend = spawn(process.execPath, ["--env-file-if-exists=.env", "scripts/harness.ts", String(BACK), SITE], { cwd: new URL("../../backend", import.meta.url).pathname, stdio: ["ignore", "pipe", "inherit"] });
children.push(backend);
await new Promise((resolve) => backend.stdout.on("data", (d) => String(d).includes("ready") && resolve()));
// Next itself, not npx: killing a wrapper would leave the server running.
const frontend = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(FRONT)], { cwd: here, env: { ...process.env, NEXT_DIST_DIR: ".next-e2e" }, stdio: "ignore" });
children.push(frontend);
for (let i = 0; !(await fetch(SITE).then((r) => r.ok, () => false)); i++) {
  if (i > 100) throw new Error("The frontend didn't start.");
  await sleep(200);
}

// --- Chrome ---------------------------------------------------------------------------------

const debugPort = 9400 + Math.floor(Math.random() * 300);
const chrome = spawn(process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "flick-e2e-"))}`, "about:blank"], { stdio: "ignore" });
children.push(chrome);
let ws;
for (let i = 0; !ws && i < 50; i++) {
  await sleep(200);
  try {
    const tabs = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
    ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
  } catch {}
}
if (ws.readyState !== 1) await new Promise((r) => ws.addEventListener("open", r));
let seq = 0;
const waiting = new Map();
const problems = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(String(e.data));
  if (m.id && waiting.has(m.id)) return waiting.get(m.id)(m), waiting.delete(m.id);
  // What goes wrong on a page: console errors, uncaught exceptions, requests that fail.
  if (m.method === "Runtime.exceptionThrown") problems.push(`exception: ${m.params.exceptionDetails.exception?.description?.split("\n")[0] ?? m.params.exceptionDetails.text}`);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") problems.push(`console.error: ${m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200)}`);
  if (m.method === "Log.entryAdded" && m.params.entry.level === "error" && !/Failed to load resource/.test(m.params.entry.text)) problems.push(`log: ${m.params.entry.text.slice(0, 200)}`);
  if (m.method === "Network.responseReceived" && m.params.response.status >= 400 && m.params.response.url.startsWith(SITE)) problems.push(`HTTP ${m.params.response.status}: ${m.params.response.url.replace(SITE, "")}`);
  if (m.method === "Network.loadingFailed" && !m.params.canceled && m.params.type !== "EventSource") problems.push(`failed: ${m.params.errorText} (${m.params.type})`);
});
const cdp = (method, params = {}) => new Promise((r) => { const id = ++seq; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const js = async (expression) => {
  const r = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description?.split("\n")[0] ?? "script failed");
  return r.result?.result?.value;
};
await Promise.all(["Page.enable", "Runtime.enable", "Network.enable", "Log.enable"].map((m) => cdp(m)));

async function device({ width, height, mobile, dark }) {
  await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: mobile ? 3 : 1, mobile });
  await cdp("Emulation.setTouchEmulationEnabled", { enabled: mobile });
  await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: dark ? "dark" : "light" }] });
}
async function open(path, settle = 2500) {
  await cdp("Page.navigate", { url: `${SITE}${path}` });
  await waitFor("document.readyState === 'complete'", 30_000);
  await sleep(settle);
}
async function waitFor(expression, timeout = 20_000, what = expression) {
  const until = Date.now() + timeout;
  for (;;) {
    const value = await js(expression).catch(() => undefined);
    if (value) return value;
    if (Date.now() > until) throw new Error(`timed out waiting for ${what}`);
    await sleep(300);
  }
}
/** Clicks the visible button, link or option whose text starts with (or matches) `text`. */
async function click(text, scope = "document") {
  const ok = await js(`(() => {
    const want = ${JSON.stringify(text)};
    const visible = (el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed';
    const els = [...${scope}.querySelectorAll('button, a, [role=radio], [role=tab], label')].filter((el) => visible(el) && !el.disabled);
    const el = els.find((el) => (el.innerText || el.getAttribute('aria-label') || '').trim().startsWith(want)) ?? els.find((el) => (el.innerText || el.getAttribute('aria-label') || '').includes(want));
    if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    el.click();
    return true;
  })()`);
  if (!ok) throw new Error(`nothing to click that says "${text}"`);
  await sleep(400);
}
const textOf = () => js("document.body.innerText");
async function fill(selector, value) {
  await js(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.scrollIntoView({ block: 'center' }); el.focus(); el.select?.(); })()`);
  await cdp("Input.insertText", { text: value });
}
const state = () => fetch(`http://localhost:${BACK}/api/state`).then((r) => r.json());

// --- The checklist --------------------------------------------------------------------------

let passed = 0;
const failed = [];
async function step(name, work) {
  problems.length = 0;
  const started = Date.now();
  try {
    const note = await work();
    const seen = [...new Set(problems)];
    if (seen.length) throw new Error(seen.slice(0, 4).join(" | "));
    passed++;
    console.log(`✓ ${name}${note ? `: ${note}` : ""} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  } catch (err) {
    failed.push(name);
    console.log(`✗ ${name}: ${err instanceof Error ? err.message : err}`);
  }
}
const check = (ok, message) => {
  if (!ok) throw new Error(message);
};

// --- 1. Every page, three ways -----------------------------------------------------------------

const pages = [
  ["/", "Snap it."],
  ["/home", "Needs you"],
  ["/lens", "Snap something to pay."],
  ["/autopilot", "Your week, on autopilot."],
  ["/scout", "Never overpay for the usual."],
  ["/split", "Split a bill."],
  ["/nudge", "Get paid back."],
  ["/friends", "Your people, by their PayPal."],
  ["/ask", "Say what you need."],
  ["/install", "Flick, on your home screen."],
  ["/dashboard", "Money Studio"],
];
const devices = [
  ["phone", { width: 390, height: 844, mobile: true, dark: false }],
  ["phone, dark", { width: 390, height: 844, mobile: true, dark: true }],
  ["desktop", { width: 1280, height: 900, mobile: false, dark: false }],
];
console.log("\nEvery page");
for (const [name, d] of devices) {
  await device(d);
  for (const [path, says] of pages) {
    await step(`${path} on ${name}`, async () => {
      await open(path, path === "/dashboard" ? 5000 : 2500);
      await waitFor(`document.body.innerText.includes(${JSON.stringify(says)})`, 15_000, `"${says}"`);
      const { sw, iw, title } = await js("({ sw: document.documentElement.scrollWidth, iw: innerWidth, title: document.title })");
      check(sw <= iw + 1, `${sw - iw}px wider than the screen`);
      check(title && title.includes("Flick"), `title "${title}"`);
      if (d.dark) check(await js("getComputedStyle(document.body).backgroundColor !== 'rgb(255, 255, 255)'"), "not dark");
    });
  }
}

// --- 2. What a person does, on a phone -----------------------------------------------------

console.log("\nOn a phone");
await device(devices[0][1]);

await step("the tab bar and the switches under it", async () => {
  await open("/home");
  for (const [tab, path] of [["Lens", "/lens"], ["Week", "/autopilot"], ["People", "/split"], ["Ask", "/ask"], ["Today", "/home"]]) {
    await click(tab, "document.querySelector('nav[aria-label=Flick]')");
    await waitFor(`location.pathname === ${JSON.stringify(path)}`, 10_000, path);
  }
  await click("Week", "document.querySelector('nav[aria-label=Flick]')");
  await waitFor("location.pathname === '/autopilot'");
  await click("Groceries");
  await waitFor("location.pathname === '/scout'");
  await click("People", "document.querySelector('nav[aria-label=Flick]')");
  await click("Nudge");
  await waitFor("location.pathname === '/nudge'");
  await click("Friends");
  await waitFor("location.pathname === '/friends'");
});

await step("the theme toggle, remembered after a reload", async () => {
  await open("/home");
  await click("Switch between light and dark");
  check((await js("document.documentElement.dataset.theme")) === "dark", "not dark");
  await open("/home", 800);
  check((await js("document.documentElement.dataset.theme")) === "dark", "forgotten");
  await click("Switch between light and dark");
  check((await js("document.documentElement.dataset.theme")) === "light", "not light again");
});

await step("Today: the inbox reminds Leo in two taps (AI draft, PayPal sends)", async () => {
  await open("/home");
  await waitFor("document.body.innerText.includes('Leo owes you')");
  await js(`[...document.querySelectorAll('li')].find((li) => li.innerText.includes('Leo owes you')).setAttribute('data-test', 'leo')`);
  await click("Remind", "document.querySelector('[data-test=leo]')");
  check((await js("document.querySelector('[data-test=leo]').innerText")).includes("Yes, remind"), "no confirm step");
  await click("Yes, remind", "document.querySelector('[data-test=leo]')");
  await waitFor("document.querySelector('[data-test=leo]')?.innerText.includes('Reminded Leo') || !document.body.innerText.includes('Leo owes you')", 60_000, "Reminded Leo");
  const leo = (await state()).debts.find((d) => d.id === "debt_leo");
  check(leo.reminders === 1, `reminders ${leo.reminders}`);
});

await step("Lens reads the sample bill with AI, then opens PayPal's checkout", async () => {
  await open("/lens");
  await click("Electricity bill");
  await waitFor("document.body.innerText.includes('Pay $64.20') || document.body.innerText.includes('City Power')", 60_000, "what Lens read");
  await waitFor("[...document.querySelectorAll('button')].some((b) => /^Pay \\$/.test(b.innerText.trim()) && !b.disabled)", 30_000, "a Pay button");
  const read = (await state()).scans[0];
  check(read.kind === "bill" && Math.abs(read.amount - 64.2) < 0.01, `read ${read.kind} ${read.amount}`);
  await js("[...document.querySelectorAll('button')].find((b) => /^Pay \\$/.test(b.innerText.trim())).click()");
  await waitFor("location.hostname.endsWith('paypal.com')", 30_000, "PayPal's page");
  problems.length = 0; // PayPal's own page logs errors of its own
  return `${read.title}, $${read.amount.toFixed(2)}`;
});

await step("Autopilot: Next day moves the week on; the save-PayPal offer is there", async () => {
  await open("/autopilot");
  check((await textOf()).includes("Approve and save PayPal"), "no save-PayPal offer");
  await click("Next day");
  await waitFor(`fetch('/api/state').then((r) => r.json()).then((s) => s.week.today === 0)`, 15_000, "Monday");
});

await step("Scout reads a shopping list with AI, prices it, and offers to buy it", async () => {
  await open("/scout", 3500);
  await click("Try a list");
  await waitFor("[...document.querySelectorAll('button')].some((b) => /^Buy \\d+ at /.test(b.innerText.trim()))", 90_000, "a Buy button");
  // Avocados are only in the photo, and not in Scout's catalog: proof the list was read.
  const t = await textOf();
  check(/avocados/i.test(t) && t.includes("Not tracked") && /cornflakes ×2|cornflakes x2/i.test(t), "the list wasn't read item by item");
  await click("QuickCart");
  check((await textOf()).includes("Buy at QuickCart"), "store chip didn't switch the basket");
  await js(`document.querySelector('.ag-row[row-id=eggs]')?.click()`);
  await waitFor("[...document.querySelectorAll('p')].some((p) => p.innerText.startsWith('Eggs'))", 5_000, "Eggs in the detail");
});

await step("Splitter: a sentence ticks the grid (AI), then real PayPal requests go out", async () => {
  await open("/split", 3000);
  await fill("textarea, input[placeholder^='Or just say it']", "Maya and I shared everything, Leo had the tea");
  check((await textOf()).includes("Send 3 PayPal requests"), "the demo receipt isn't split three ways to start");
  await click("Tick it for me");
  // While the AI ticks, sending waits; then only Maya and Leo owe anything.
  check(await js("[...document.querySelectorAll('button')].find((b) => /^Send \\d PayPal request/.test(b.innerText.trim()))?.disabled"), "Send stays live while the AI is ticking");
  await waitFor("[...document.querySelectorAll('button')].some((b) => b.innerText.trim() === 'Send 2 PayPal requests' && !b.disabled)", 60_000, "the grid ticked: 2 requests");
  const before = new Set((await state()).debts.map((d) => d.id));
  await js("[...document.querySelectorAll('button')].find((b) => /^Send \\d PayPal request/.test(b.innerText.trim())).click()");
  await waitFor("document.body.innerText.includes('Requests sent')", 60_000, "Requests sent");
  const s = await state();
  const fresh = s.debts.filter((d) => !before.has(d.id));
  const owes = Object.fromEntries(fresh.map((d) => [d.friendId, d.amount]));
  check(fresh.length === 2 && fresh.every((d) => d.invoiceId && d.payerUrl), `${fresh.length} new requests, ${fresh.filter((d) => !d.invoiceId).length} without an invoice`);
  check(!owes.priya && owes.leo < owes.maya, `owes ${JSON.stringify(owes)}`);
  return fresh.map((d) => `${s.friends.find((f) => f.id === d.friendId)?.name} $${d.amount.toFixed(2)}`).join(", ");
});

await step("Nudge: each tone redrafts with AI, and sends through PayPal", async () => {
  await open("/nudge", 3000);
  const reminders = async () => (await state()).debts.reduce((sum, d) => sum + d.reminders, 0);
  const before = await reminders();
  await click("Funny");
  await waitFor("[...document.querySelectorAll('button')].some((b) => b.innerText.includes('Send to') && !b.disabled)", 60_000, "a draft");
  const draft = await js("document.querySelector('textarea')?.value ?? ''");
  await click("Send to");
  for (let i = 0; i < 60 && (await reminders()) === before; i++) await sleep(1000);
  check((await reminders()) === before + 1, "no reminder went out");
  return draft ? `"${draft.slice(0, 60)}…"` : undefined;
});

await step("Friends: add one by PayPal email, then remove them", async () => {
  await open("/friends");
  await fill("input[placeholder=Sam]", "Robin");
  await fill("input[placeholder='sam@example.com']", "robin@flick.example.com");
  await click("Add friend");
  await waitFor("document.body.innerText.includes('robin@flick.example.com')", 10_000, "Robin");
  await click("Remove Robin");
  await waitFor("!document.body.innerText.includes('robin@flick.example.com')", 10_000, "Robin gone");
});

await step("Ask Flick answers from the real data, in plain text", async () => {
  await open("/ask");
  await click("What's happening with my money this week?");
  await waitFor("!document.body.innerText.includes('Flick is thinking') && document.querySelectorAll('main p').length > 8", 90_000, "a reply");
  const t = await textOf();
  check(!t.includes("**"), "markdown in the reply");
  check(/\$\d/.test(t), "no amounts in the reply");
});

await step("Install: the steps for this browser", async () => {
  await open("/install");
  const t = await textOf();
  check(/Install Flick|Add to Home Screen|browser's menu|installed/.test(t), "no steps");
});

await step("Money Studio renders AG Studio with Flick's data", async () => {
  await device(devices[2][1]);
  await open("/dashboard", 8000);
  check(await js("document.querySelectorAll('[class*=ag-]').length > 20"), "no AG Studio");
  await device(devices[0][1]);
});

// --- 3. The installed app ---------------------------------------------------------------------

console.log("\nThe installed app");

await step("installable: a valid manifest, no installability errors", async () => {
  await open("/home");
  const { result: errors } = await cdp("Page.getInstallabilityErrors");
  const { result: manifest } = await cdp("Page.getAppManifest");
  check(!errors.installabilityErrors.length, JSON.stringify(errors.installabilityErrors));
  check(!manifest.errors.length && manifest.url.endsWith("/manifest.webmanifest"), JSON.stringify(manifest.errors));
});

await step("the service worker takes over, with every page cached", async () => {
  await waitFor("navigator.serviceWorker.ready.then((r) => r.active?.state === 'activated')", 20_000, "an active worker");
  await open("/home", 1500);
  check(await js("Boolean(navigator.serviceWorker.controller)"), "not controlling the page");
  const cached = await waitFor(`caches.open('flick-v1').then((c) => c.keys()).then((k) => { const p = k.map((r) => new URL(r.url).pathname); return ['/home', '/lens', '/autopilot', '/scout', '/api/state'].every((x) => p.includes(x)) && p; })`, 20_000, "the pages in the cache");
  return `${cached.filter((p) => !p.startsWith("/_next")).length} pages and data`;
});

await step("offline, Today and Autopilot still open, and say so", async () => {
  await cdp("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  try {
    await open("/home", 2000);
    await waitFor("document.body.innerText.includes(\"You're offline\") && document.body.innerText.includes('This week')", 10_000, "Today, offline");
    await open("/autopilot", 2000);
    await waitFor("document.body.innerText.includes('Your week, on autopilot.')", 10_000, "Autopilot, offline");
  } finally {
    await cdp("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  }
  problems.length = 0; // being offline fails requests, on purpose
});

await step("a photo shared to Flick (Android's share sheet) is read by Lens", async () => {
  await open("/home", 1500);
  const shared = await js(`(async () => {
    const c = document.createElement('canvas'); c.width = 600; c.height = 700;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 600, 700); g.fillStyle = '#000';
    g.font = 'bold 40px Helvetica'; g.fillText('HARBOR GAS CO', 50, 100);
    g.font = '28px Helvetica'; g.fillText('Gas bill, November', 50, 170); g.fillText('Amount due: $52.40', 50, 240); g.fillText('Due: 2026-11-27', 50, 300);
    const form = new FormData();
    form.append('photo', new File([await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9))], 'bill.jpg', { type: 'image/jpeg' }));
    const res = await fetch('/share', { method: 'POST', body: form });
    return new URL(res.url).pathname + new URL(res.url).search;
  })()`);
  check(shared === "/lens?shared=1", `the share went to ${shared}`);
  await open("/lens?shared=1", 1000);
  // The note Lens leaves for a shared photo ("Lens read … ready to pay", or what went wrong).
  const note = await waitFor("(() => { const t = document.querySelector('p[role=status]')?.innerText ?? ''; return !t.includes('reading') && t; })()", 60_000, "Lens's note on the photo");
  check(note.includes("ready to pay"), note);
  const scan = (await state()).scans[0];
  check(Math.abs(scan.amount - 52.4) < 0.01, `read $${scan.amount}`);
  check(await js("caches.open('flick-share').then((c) => c.match('/shared-photo')).then((r) => !r)"), "the photo was kept");
  return `${scan.title}, $${scan.amount.toFixed(2)}`;
});

await step("notifications: subscribed through a real push service, and the welcome one sent", async () => {
  const browser = new WebSocket((await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json()).webSocketDebuggerUrl);
  await new Promise((r) => browser.addEventListener("open", r));
  browser.send(JSON.stringify({ id: 1, method: "Browser.grantPermissions", params: { origin: SITE, permissions: ["notifications"] } }));
  await new Promise((r) => browser.addEventListener("message", r));
  // Chrome drops the granted permission when this connection closes, so it stays open until the end.
  const out = await js(`(async () => {
    const reg = await navigator.serviceWorker.ready;
    const { publicKey } = await (await fetch('/api/push/key')).json();
    const key = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (publicKey.length % 4)) % 4)), (c) => c.charCodeAt(0));
    const sub = await Promise.race([reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }), new Promise((_, no) => setTimeout(() => no(new Error('no push service in this Chrome')), 20000))]);
    const res = await (await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) })).json();
    await fetch('/api/push/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
    await sub.unsubscribe();
    return { host: new URL(sub.endpoint).hostname, ...res };
  })()`).finally(() => browser.close());
  check(out.subscribed && out.delivered === 1, JSON.stringify(out));
  return `${out.host} took it`;
});

// --- 4. Paying on PayPal's real page, from the screen -------------------------------------------

console.log("\nOn PayPal's page");
const email = env.SANDBOX_BUYER_EMAIL;
const password = env.SANDBOX_BUYER_PASSWORD;
if (!email || !password) {
  console.log("– skipped: set SANDBOX_BUYER_EMAIL and SANDBOX_BUYER_PASSWORD in backend/.env");
} else {
  await step("Lens: Pay → PayPal login → approve → back to Flick, paid", async () => {
    await device(devices[2][1]);
    await open("/lens");
    await click("Electricity bill");
    await waitFor("[...document.querySelectorAll('button')].some((b) => /^Pay \\$/.test(b.innerText.trim()) && !b.disabled)", 60_000, "a Pay button");
    await js("[...document.querySelectorAll('button')].find((b) => /^Pay \\$/.test(b.innerText.trim())).click()");
    await waitFor("location.hostname.endsWith('paypal.com')", 30_000, "PayPal");
    for (let i = 0; i < 80 && !(await js("location.href")).startsWith(SITE); i++) {
      await sleep(1500);
      const page = await js(`(() => { const v = (el) => el && el.offsetParent !== null; const e = document.querySelector('#email'), p = document.querySelector('#password');
        return { email: v(e) ? e.value : null, password: v(p) ? p.value : null, buttons: [...document.querySelectorAll('button')].filter(v).map((b) => b.innerText.trim()) }; })()`).catch(() => null);
      if (!page) continue;
      if (page.email === "") { await fill("#email", email); await js("(document.querySelector('#btnNext') || document.querySelector('#btnLogin'))?.click()"); continue; }
      if (page.password === "") { await fill("#password", password); await js("document.querySelector('#btnLogin')?.click()"); continue; }
      const pay = page.buttons.find((b) => /^(pay|agree|continue|complete)/i.test(b));
      if (pay) await js(`[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === ${JSON.stringify(pay)})?.click()`);
    }
    await waitFor(`location.href.startsWith(${JSON.stringify(SITE)})`, 30_000, "back at Flick");
    await waitFor("document.body.innerText.includes('Paid with PayPal')", 20_000, "Paid with PayPal");
    problems.length = 0; // PayPal's own page logs errors of its own
    const s = await state();
    check(s.scans[0].status === "paid", `scan is ${s.scans[0].status}`);
    check(s.activity.some((a) => a.agent === "lens" && a.text.startsWith("Paid")), "no payout");
    await device(devices[0][1]);
  });
}

console.log(`\n${passed} of ${passed + failed.length} passed.${failed.length ? ` Failed: ${failed.join("; ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
