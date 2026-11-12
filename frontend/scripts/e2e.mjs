// `npm run e2e`: Flick in a real browser, front to back. It builds the frontend (into .next-e2e,
// pointed at a backend of its own on a throwaway state file), starts both, and drives a headless
// Chrome over the DevTools protocol:
//
// 1. Every page at phone size (light and dark) and desktop size: no console errors, uncaught
//    exceptions or failed requests, nothing wider than the screen, and its content there.
// 2. What a person does, on a phone: the tab bar and switches, the theme, Today's inbox, a new
//    Flick with nothing made up in it, Lens reading a bill and opening PayPal, Autopilot's days,
//    Scout reading a list, Splitter's items, sentence and requests, Nudge's tones, Friends, Ask
//    Flick, the install page, Money Studio.
// 3. The installed app: installable, the service worker in charge, opening offline, a photo
//    shared to Flick read by Lens, and a notification through a real push service.
// 4. With SANDBOX_BUYER_EMAIL / SANDBOX_BUYER_PASSWORD in backend/.env: paying a bill on PayPal's
//    real page from the Lens screen, and back to Flick's "Paid with PayPal".
//
// Real PayPal sandbox and AI calls, with the keys in backend/.env. Needs Google Chrome (CHROME=...).

import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
// The backend's workspaces live here, so Flick Chat's step can add a friend who's signed in.
const stateDir = mkdtempSync(join(tmpdir(), "flick-e2e-state-"));
const backend = spawn(process.execPath, ["--env-file-if-exists=.env", "scripts/harness.ts", String(BACK), SITE], { cwd: new URL("../../backend", import.meta.url).pathname, env: { ...process.env, STATE_FILE: join(stateDir, "state.json") }, stdio: ["ignore", "pipe", "inherit"] });
children.push(backend);
await new Promise((resolve) => backend.stdout.on("data", (d) => String(d).includes("ready") && resolve()));
// Next itself, not npx: killing a wrapper would leave the server running. BACKEND_URL again: server
// components (Money Studio) read it per request, not from the build.
const frontend = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(FRONT)], { cwd: here, env: { ...process.env, NEXT_DIST_DIR: ".next-e2e", BACKEND_URL: `http://localhost:${BACK}` }, stdio: "ignore" });
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
/** This browser's own workspace (the cookie the frontend's proxy.ts gave it), straight from the backend. */
async function state() {
  const { cookies } = (await cdp("Network.getCookies", { urls: [SITE] })).result;
  const workspace = cookies.find((c) => c.name === "flick")?.value;
  if (!workspace) throw new Error("this browser has no workspace cookie");
  return fetch(`http://localhost:${BACK}/api/state`, { headers: { cookie: `flick=${workspace}` } }).then((r) => r.json());
}
/** This browser's API, from the page: what the person's own taps would do. */
const asMe = (path, body) => js(`fetch('/api/${path}', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: ${JSON.stringify(JSON.stringify(body))} }).then((r) => r.json())`);
/** A photo drawn from `lines` ([text, px]), snapped with Lens's "Snap your own". */
async function snap(lines) {
  await js(`(async () => {
    const lines = ${JSON.stringify(lines)};
    const c = document.createElement('canvas'); c.width = 640; c.height = 140 + lines.length * 58;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#000';
    lines.forEach(([text, px], i) => { g.font = (px >= 30 ? 'bold ' : '') + px + 'px Helvetica'; g.fillText(text, 30, 80 + i * 58); });
    const input = document.querySelector('input[type=file]');
    const dt = new DataTransfer();
    dt.items.add(new File([await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9))], 'photo.jpg', { type: 'image/jpeg' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
}
/**
 * A front camera for "Flick to pay": a face in a dim room; at 1 s a hand goes past sideways (not a
 * flick); at 2.5 s one finger flicks up, from the bottom of the frame to the top, in 300 ms.
 */
const fakeCamera = () =>
  js(`(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const c = document.createElement('canvas'); c.width = 320; c.height = 240;
      const g = c.getContext('2d'); const start = performance.now();
      const draw = () => {
        const t = performance.now() - start;
        g.fillStyle = '#2a2622'; g.fillRect(0, 0, 320, 240);
        g.fillStyle = '#8a6a50'; g.beginPath(); g.ellipse(160, 110, 50, 62, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#e8c4a0';
        const past = (t - 1000) / 400;
        if (past >= 0 && past <= 1) g.fillRect(-90 + past * 410, 70, 90, 100);
        const up = (t - 2500) / 300;
        if (up >= 0 && up <= 1) g.fillRect(200, 240 - up * 350, 36, 110);
        requestAnimationFrame(draw);
      };
      draw();
      return c.captureStream(30);
    };
  })()`);
/** Past "Flick to pay" with its button: the test browser has no camera. */
async function tapToPay() {
  await waitFor("document.querySelector('[role=dialog]')?.innerText.includes('Flick to pay')", 15_000, "the Flick to pay sheet");
  // A guest's button opens PayPal; signed in, it pays from the saved PayPal.
  const label = await js("[...document.querySelectorAll('[role=dialog] button')].map((b) => b.innerText.trim()).find((t) => t === 'Pay on PayPal' || t === 'Pay now')");
  await click(label ?? "Pay on PayPal", "document.querySelector('[role=dialog]')");
}
/** On PayPal's own pages: logs in as the sandbox buyer and approves (paying, or saving PayPal with Flick), until PayPal sends the browser back. */
async function throughPayPal(email, password) {
  await waitFor("location.hostname.endsWith('paypal.com')", 30_000, "PayPal");
  for (let i = 0; i < 80 && !String(await js("location.href")).startsWith(SITE); i++) {
    await sleep(1500);
    const page = await js(`(() => { const v = (el) => el && el.offsetParent !== null; const e = document.querySelector('#email'), p = document.querySelector('#password');
      return { email: v(e) ? e.value : null, password: v(p) ? p.value : null, buttons: [...document.querySelectorAll('button')].filter(v).map((b) => b.innerText.trim()) }; })()`).catch(() => null);
    if (!page) continue;
    if (page.email === "") { await fill("#email", email); await js("(document.querySelector('#btnNext') || document.querySelector('#btnLogin'))?.click()"); continue; }
    if (page.password === "") { await fill("#password", password); await js("document.querySelector('#btnLogin')?.click()"); continue; }
    const yes = page.buttons.find((b) => /^(pay|agree|continue|complete|save)/i.test(b));
    if (yes) await js(`[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === ${JSON.stringify(yes)})?.click()`);
  }
  await waitFor(`location.href.startsWith(${JSON.stringify(SITE)})`, 30_000, "back at Flick");
  problems.length = 0; // PayPal's own pages log errors of their own
}
/**
 * Snaps a bill and waits until Lens has read it and offers to pay `amount` ("$0.42"): not the Pay
 * button of a bill read before, which shows until the new one is in. Returns the new scan.
 */
async function snapToPay(lines, amount) {
  const before = (await state()).scans.length;
  await snap(lines);
  for (let i = 0; i < 300 && (await state()).scans.length <= before; i++) await sleep(300);
  await waitFor(`[...document.querySelectorAll('button')].some((b) => b.innerText.trim().startsWith(${JSON.stringify(`Pay ${amount}`)}) && !b.disabled)`, 30_000, `a Pay ${amount} button`);
  return (await state()).scans[0];
}
/** Adds an item to a bill on Splitter, as typed in its form. */
async function addItem(name, price) {
  await fill("input[aria-label='Item']", name);
  await fill("input[aria-label='Price']", price);
  await js("[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Add').click()");
  await waitFor(`document.body.innerText.includes(${JSON.stringify(name)})`, 5_000, `${name} on the bill`);
}
const clickPay = (amount) => js(`[...document.querySelectorAll('button')].find((b) => b.innerText.trim().startsWith(${JSON.stringify(`Pay ${amount}`)})).click()`);
/** This browser's session cookie: its workspace. */
const session = async () => (await cdp("Network.getCookies", { urls: [SITE] })).result.cookies.find((c) => c.name === "flick")?.value;
const daysAfter = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

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
  ["/chat", "Flick Chat"],
  ["/business", "Get paid when Flick pays your bills."],
  ["/nudge", "Get paid back."],
  ["/safe", "Money for one thing."],
  ["/friends", "Your people, by their PayPal."],
  ["/ask", "Say what you need."],
  ["/install", "Flick, on your home screen."],
  ["/login", "Sign in to Flick"],
  ["/profile", "You're a guest."],
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

await step("a new browser has its own Flick: an empty workspace, and Today says so", async () => {
  await open("/home");
  const s = await state();
  check(!s.friends.length && !s.scans.length && !s.debts.length && !s.week.payments.length && !Object.keys(s.checkouts).length, "the new workspace isn't empty");
  await waitFor("document.body.innerText.includes('Nothing planned this week') && document.body.innerText.includes('Scout learns what you buy')", 10_000, "Today, empty");
});

await step("Lens: a new Flick shows nothing made up: no sample bills, just how to start", async () => {
  await open("/lens");
  const t = await textOf();
  check(t.includes("Nothing read yet") && t.includes("Upload an e-bill"), "no empty state");
  check(!t.includes("Electricity bill") && !t.includes("Or watch a sample") && !t.includes("$64.20"), "a sample bill is on the page");
  const s = await state();
  check(!s.scans.length && !Object.keys(s.checkouts).length, "the page made a scan or a checkout");
});

await step("Lens: a restaurant bill in rupees shows ₹, pays its USD through PayPal, or splits", async () => {
  await open("/lens");
  await snap([
    ["SPICE ROUTE RESTAURANT", 36],
    ["Indiranagar, Bengaluru · Table 4", 22],
    ["Paneer Tikka                         ₹320.00", 24],
    ["Dal Makhani                          ₹280.00", 24],
    ["Butter Naan x2                       ₹120.00", 24],
    ["GST 5%                                 ₹36.00", 24],
    ["TOTAL                    ₹756.00", 30],
  ]);
  await waitFor("document.body.innerText.includes('Split it with friends')", 60_000, "what Lens read");
  const scan = (await state()).scans[0];
  check(scan.original?.currency === "INR" && Math.abs(scan.original.amount - 756) < 0.01, `read ${JSON.stringify(scan.original ?? { amount: scan.amount, currency: scan.currency })}`);
  check(scan.currency === "USD" && scan.amount > 5 && scan.amount < 15, `$${scan.amount} for ₹756`);
  const text = await textOf();
  check(text.includes("₹756.00"), "the card doesn't show ₹756.00");
  check(text.includes(`Pay $${scan.amount.toFixed(2)} with PayPal`), "no Pay button in USD");
  // Split goes to Splitter with the items, in USD, saying so.
  await click("Split it with friends");
  await waitFor("location.pathname === '/split' && document.body.innerText.includes('₹756.00 on the receipt')", 15_000, "Splitter, with the receipt converted");
  check((await textOf()).includes("No friends yet") && !(await textOf()).includes("Maya"), "no friends of your own, but Splitter shows some");
  // Back on Lens, the newest scan is the receipt, ready to pay.
  await open("/lens");
  // Pay opens "Flick to pay"; Not now cancels the PayPal checkout, and the bill is ready to pay again.
  await click(`Pay $${scan.amount.toFixed(2)} with PayPal`);
  await waitFor("document.querySelector('[role=dialog]')?.innerText.includes('Flick to pay')", 15_000, "the Flick to pay sheet");
  check((await js("document.querySelector('[role=dialog]').innerText")).includes(`Pay $${scan.amount.toFixed(2)}`), "the sheet doesn't say the amount");
  await click("Not now", "document.querySelector('[role=dialog]')");
  await waitFor("!document.querySelector('[role=dialog]') && document.body.innerText.includes('Split it with friends')", 15_000, "the sheet closed, the bill back");
  const back = await state();
  check(back.scans[0].status === "read" && Object.values(back.checkouts).some((c) => c.kind === "scan" && c.status === "cancelled"), `after Not now: scan ${back.scans[0].status}`);
  // Then the fake front camera: a hand going past sideways doesn't pay; one finger flicked up does.
  await fakeCamera();
  await click(`Pay $${scan.amount.toFixed(2)} with PayPal`);
  await waitFor("document.querySelector('[role=dialog]')?.innerText.includes('Flick one finger up, in front of the camera')", 15_000, "the camera, waiting for a flick");
  check(!(await js("document.querySelector('[role=dialog] video')?.offsetWidth > 1")), "the camera is on screen");
  await sleep(1800);
  check((await js("location.origin")) === SITE && (await js("Boolean(document.querySelector('[role=dialog]'))")), "a hand going past sideways paid");
  await waitFor("location.hostname.endsWith('paypal.com')", 30_000, "PayPal's page, after the flick up");
  problems.length = 0; // PayPal's own page logs errors of its own
  check((await state()).scans[0].status === "awaiting", "not awaiting PayPal");
  return `${scan.title}: ₹756.00 → $${scan.amount.toFixed(2)}, flicked to PayPal`;
});

await step("Autopilot: a new Flick's week is empty, and says how to fill it", async () => {
  await open("/autopilot");
  const t = await textOf();
  check(t.includes("Nothing planned this week yet") && t.includes("Nothing to approve this week"), "no empty week");
  check(!t.includes("City Power") && !t.includes("This is a sample week") && !t.includes("Approve with PayPal"), "a sample week is on the page");
});

await step("Autopilot: a bill you snap that's due this week makes your own week, approved on PayPal", async () => {
  const due = daysAfter((await state()).week.starts, 6);
  await open("/lens");
  await snap([["NORTHWIND WATER", 36], ["Water bill, November", 24], ["Account 7731-22", 22], ["Amount due: $41.75", 28], [`Due date: ${due}`, 24]]);
  await waitFor("document.body.innerText.includes('Pay $41.75 with PayPal')", 60_000, "what Lens read");
  const planned = (await state()).week.payments;
  check(planned.length === 1 && /northwind/i.test(planned[0].payee) && Math.abs(planned[0].amount - 41.75) < 0.01, `the week: ${JSON.stringify(planned.map((p) => [p.payee, p.amount, p.day]))}`);
  await open("/autopilot");
  const t = await textOf();
  check(t.includes("Northwind") && !t.includes("This is a sample week") && t.includes("Approve and save PayPal"), "the page still shows the sample week");
  await click("Approve with PayPal");
  // No camera here, so the sheet offers a tap instead.
  await waitFor("document.querySelector('[role=dialog]')?.innerText.includes('No camera to flick at')", 15_000, "the sheet saying there's no camera");
  await tapToPay();
  await waitFor("location.hostname.endsWith('paypal.com')", 30_000, "PayPal's page");
  problems.length = 0; // PayPal's own page logs errors of its own
  check((await state()).week.approval?.status === "awaiting", "not awaiting PayPal");
  return `${planned[0].payee} $${planned[0].amount.toFixed(2)} on ${planned[0].day}`;
});

await step("Scout: no usuals yet says so; a list you snap is read with AI, priced at every store", async () => {
  await open("/scout", 3500);
  let t = await textOf();
  check(t.includes("No usuals yet") && !t.includes("A sample shop") && !t.includes("Try a list"), "a sample shop or list is on the page");
  await snap([["Shopping", 38], ["- milk", 32], ["- cornflakes x2", 32], ["- eggs", 32], ["- coffee beans", 32], ["- bananas", 32], ["- avocados", 32]]);
  await waitFor("[...document.querySelectorAll('button')].some((b) => /^Buy \\d+ at /.test(b.innerText.trim()))", 90_000, "a Buy button");
  // Avocados are only in the photo, and not in Scout's catalog: proof the list was read.
  t = await textOf();
  check(/avocados/i.test(t) && t.includes("Not tracked") && /cornflakes ×2|cornflakes x2/i.test(t), "the list wasn't read item by item");
  check(!Object.values((await state()).checkouts).some((c) => c.kind === "basket"), "reading the list bought it");
  await js(`document.querySelector('.ag-row[row-id=eggs]')?.click()`);
  await waitFor("[...document.querySelectorAll('p')].some((p) => p.innerText.startsWith('Eggs'))", 5_000, "Eggs in the detail");
});

await step("Splitter: a new Flick has no made-up bill or friends; what was on the bill goes in by hand", async () => {
  await open("/split", 3000);
  const t = await textOf();
  check(t.includes("Nothing to split yet") && t.includes("No friends yet"), "no empty bill");
  check(!t.includes("Nori Sushi") && !t.includes("Salmon roll") && !t.includes("Maya"), "a sample bill or friends are on the page");
  await addItem("Pizza", "24");
  check((await textOf()).includes("Pizza") && (await textOf()).includes("Add a friend first"), "the item didn't go in, or Splitter would send with no friends");
  check(!(await state()).debts.length, "something was sent");
});

await step("Splitter: with your own friends, a sentence ticks the grid (AI), then real PayPal requests go out", async () => {
  for (const name of ["Maya", "Leo", "Priya"]) await asMe("friends/add", { name, email: `${name.toLowerCase()}@flick.example.com` });
  await open("/split", 3000);
  check(!(await textOf()).includes("No friends yet"), "your friends aren't in the grid");
  await fill("input[aria-label='What the bill was for']", "Dinner at Nori");
  await addItem("Salmon roll", "14");
  await addItem("Miso soup", "7");
  await addItem("Green tea", "16");
  await fill("textarea, input[placeholder^='Or just say it']", "Maya and I shared everything, Leo had the tea");
  check((await textOf()).includes("Send 3 PayPal requests"), "the bill isn't split three ways to start");
  await click("Tick it for me");
  // While the AI ticks, sending waits; then only Maya and Leo owe anything.
  check(await js("[...document.querySelectorAll('button')].find((b) => /^Send \\d PayPal request/.test(b.innerText.trim()))?.disabled"), "Send stays live while the AI is ticking");
  await waitFor("[...document.querySelectorAll('button')].some((b) => b.innerText.trim() === 'Send 2 PayPal requests' && !b.disabled)", 60_000, "the grid ticked: 2 requests");
  const before = new Set((await state()).debts.map((d) => d.id));
  await js("[...document.querySelectorAll('button')].find((b) => /^Send \\d PayPal request/.test(b.innerText.trim())).click()");
  await waitFor("document.body.innerText.includes('Requests sent')", 60_000, "Requests sent");
  const s = await state();
  const fresh = s.debts.filter((d) => !before.has(d.id));
  const owes = Object.fromEntries(fresh.map((d) => [s.friends.find((f) => f.id === d.friendId)?.name, d.amount]));
  check(fresh.length === 2 && fresh.every((d) => d.invoiceId && d.payerUrl), `${fresh.length} new requests, ${fresh.filter((d) => !d.invoiceId).length} without an invoice`);
  // Maya halves the salmon and the miso with you ($21), and Leo had the tea ($16); no tax or tip.
  check(!owes.Priya && Math.abs(owes.Maya - 10.5) < 0.01 && Math.abs(owes.Leo - 16) < 0.01, `owes ${JSON.stringify(owes)}`);
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

await step("Money Studio: your own payments, each at its stage, not the sample", async () => {
  await device(devices[2][1]);
  await open("/dashboard", 8000);
  check(await js("document.querySelectorAll('[class*=ag-]').length > 20"), "no AG Studio");
  check(!(await textOf()).includes("This is sample data"), "still the sample, after paying and splitting");
  const data = await js("fetch('/api/dashboard').then((r) => r.json())");
  check(Array.isArray(data?.flickCheckouts), `/api/dashboard: ${data?.error?.message ?? JSON.stringify(data).slice(0, 200)}`);
  const stages = data.flickCheckouts.map((c) => `${c.agent}: ${c.stage}`);
  // The rupee bill's first checkout, backed out of at "Flick to pay"; its second; and the week's.
  const want = ["Autopilot: Waiting for your approval", "Lens: Cancelled on PayPal", "Lens: Waiting for your approval"];
  check(JSON.stringify([...stages].sort()) === JSON.stringify(want), `payments: ${JSON.stringify(stages)}`);
  // The sandbox account has everyone's invoices; this browser sees only its own two (fewer while PayPal's list catches up).
  check(data.flickRequests.length === 2 && data.invoices.length <= 2, `${data.flickRequests.length} requests, ${data.invoices.length} PayPal invoices shown`);
  await device(devices[0][1]);
  return stages.join("; ");
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
  // The cache is this build's: flick-<build>, the ?v= the worker was registered with.
  const cache = `flick-${await js("new URL(navigator.serviceWorker.controller.scriptURL).searchParams.get('v')")}`;
  const cached = await waitFor(`caches.open('${cache}').then((c) => c.keys()).then((k) => { const p = k.map((r) => new URL(r.url).pathname); return ['/home', '/lens', '/autopilot', '/scout', '/api/state'].every((x) => p.includes(x)) && p; })`, 20_000, "the pages in the cache");
  return `${cached.filter((p) => !p.startsWith("/_next")).length} pages and data, in ${cache}`;
});

await step("a new deploy replaces an installed app's old pages, and the open app reloads onto it", async () => {
  // An app installed from an older deploy: that deploy's worker in charge, with its own cache.
  const build = await js("new URL(navigator.serviceWorker.controller.scriptURL).searchParams.get('v')");
  await js("navigator.serviceWorker.register('/sw.js?v=older', { scope: '/', updateViaCache: 'none' }).then(() => true)");
  await waitFor("navigator.serviceWorker.controller?.scriptURL.endsWith('v=older') && caches.keys().then((k) => k.includes('flick-older'))", 20_000, "the older deploy in charge");
  // Count page loads: the reload below, then the app's own reload when this deploy's worker takes over.
  const { result } = await cdp("Page.addScriptToEvaluateOnNewDocument", { source: "sessionStorage.loads = String(Number(sessionStorage.loads || 0) + 1)" });
  await js("sessionStorage.loads = '0'");
  await cdp("Page.reload");
  const reloaded = Date.now();
  // A fresh browser takes over in about a second. Late in this long session the new worker installs
  // at once but then waits about 30s to take over (seen with a timeline of the takeover), so: 60s.
  await waitFor(`document.readyState === 'complete' && navigator.serviceWorker.controller?.scriptURL.endsWith('v=${build}')`, 60_000, "this deploy's worker in charge").catch(async (err) => {
    // Where the update got stuck: which worker controls the page, and which are active, waiting or installing.
    const where = await js(`navigator.serviceWorker.getRegistration().then((r) => { const v = (w) => (w ? new URL(w.scriptURL).searchParams.get('v') + ' ' + w.state : 'none'); return 'controller ' + v(navigator.serviceWorker.controller) + ', active ' + v(r?.active) + ', waiting ' + v(r?.waiting) + ', installing ' + v(r?.installing) + ', on ' + location.pathname; })`).catch((e) => String(e));
    throw new Error(`${err.message} (${where})`);
  });
  await waitFor("sessionStorage.loads === '2'", 15_000, "the app reloading itself onto this deploy");
  await cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: result.identifier });
  const caches = await js("caches.keys()");
  check(!caches.includes("flick-older") && caches.includes(`flick-${build}`), `caches: ${caches.join(", ")}`);
  return `took over ${((Date.now() - reloaded) / 1000).toFixed(1)}s after the reload`;
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

await step("an e-bill shared to Flick, as a PDF or as an e-mail's text, is read by Lens", async () => {
  const { pdfOf } = await import("../../backend/scripts/harness.ts");
  const pdf = pdfOf(["NORTHWIND MOBILE", "Account 77-1203", "Statement: November 2026", "Amount due: $31.75", "Due date: 2026-11-28"]).split(",")[1];
  const share = (fill) => js(`(async () => {
    const form = new FormData();
    ${fill}
    const res = await fetch('/share', { method: 'POST', body: form });
    return new URL(res.url).pathname + new URL(res.url).search;
  })()`);
  const readShared = async (what, amount) => {
    await open("/lens?shared=1", 1000);
    const note = await waitFor("(() => { const t = document.querySelector('p[role=status]')?.innerText ?? ''; return !t.includes('reading') && t; })()", 60_000, `Lens's note on ${what}`);
    check(note.includes("ready to pay"), `${what}: ${note}`);
    const scan = (await state()).scans[0];
    check(Math.abs(scan.amount - amount) < 0.01, `${what}: read $${scan.amount}`);
    return scan;
  };
  const went = await share(`form.append('photo', new File([Uint8Array.from(atob(${JSON.stringify(pdf)}), (c) => c.charCodeAt(0))], 'statement.pdf', { type: 'application/pdf' }));`);
  check(went === "/lens?shared=1", `the PDF went to ${went}`);
  const fromPdf = await readShared("the PDF", 31.75);
  const sent = await share(`form.append('title', 'Your Harbor Water bill is ready'); form.append('text', 'Hi! Your Harbor Water bill for November: amount due $27.30, due by November 29, 2026. Account 4410.');`);
  check(sent === "/lens?shared=1", `the e-mail went to ${sent}`);
  const fromText = await readShared("the e-mail", 27.3);
  check(await js("caches.open('flick-share').then((c) => Promise.all([c.match('/shared-photo'), c.match('/shared-text')])).then((r) => r.every((x) => !x))"), "what was shared was kept");
  return `${fromPdf.title}, $${fromPdf.amount.toFixed(2)}; ${fromText.title}, $${fromText.amount.toFixed(2)}`;
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
    // A fresh browser first registers with Google's push service: up to half a minute, at busy times.
    const sub = await Promise.race([reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }), new Promise((_, no) => setTimeout(() => no(new Error('no push service in this Chrome')), 60000))]);
    const res = await (await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) })).json();
    await fetch('/api/push/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
    await sub.unsubscribe();
    return { host: new URL(sub.endpoint).hostname, ...res };
  })()`).finally(() => browser.close());
  check(out.subscribed && out.delivered === 1, JSON.stringify(out));
  return `${out.host} took it`;
});

await step("the Flick logo goes to the top of the one-pager, from another page or from far down it", async () => {
  const landed = [];
  for (const from of ["/lens", "/"]) {
    await open(from, 1500);
    await js("window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })");
    await sleep(500);
    const { x, y } = await js("(() => { const b = document.querySelector('header a[href=\"/\"]').getBoundingClientRect(); return { x: b.x + 10, y: b.y + b.height / 2 }; })()");
    for (const type of ["mousePressed", "mouseReleased"]) await cdp("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
    await sleep(2000);
    landed.push(`${from} → ${await js("location.pathname")} at ${await js("Math.round(scrollY)")}`);
  }
  check(landed.every((l) => l.endsWith("→ / at 0")), landed.join("; "));
});

await step("Sign in: /login opens PayPal's own page to save PayPal with Flick; cancelling comes back", async () => {
  await device(devices[0][1]);
  await open("/login");
  check(await js("[...document.querySelectorAll('header a')].some((a) => a.innerText.trim() === 'Sign in')"), "the nav doesn't offer Sign in");
  await click("Sign in with PayPal");
  await waitFor("location.hostname === 'www.sandbox.paypal.com'", 30_000, "PayPal's page");
  await cdp("Page.navigate", { url: `${SITE}/api/auth/paypal/cancel` });
  await waitFor("location.pathname === '/login' && document.body.innerText.includes('Sign-in cancelled')", 20_000, "back on /login, cancelled");
  problems.length = 0; // PayPal's page logs errors of its own
  // The backend's session cookie gets through the frontend's /api rewrite: signing in depends on it.
  const res = await fetch(`${SITE}/api/auth/signout`, { method: "POST", headers: { cookie: "flick=e2e-cookie-check-01" } });
  check(/^flick=;.*Max-Age=0/.test(res.headers.get("set-cookie") ?? ""), `set-cookie: ${res.headers.get("set-cookie")}`);
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
    const bill = await snapToPay([["CITY POWER", 36], ["Electricity, November", 24], ["Account •••• 4821", 22], ["Amount due: $0.31", 28], ["Due date: 2026-12-02", 24]], "$0.31");
    await clickPay("$0.31");
    await tapToPay();
    await throughPayPal(email, password);
    await waitFor("location.search.includes('paid=scan') || document.querySelector('[role=status]')?.innerText.includes('Paid with PayPal')", 20_000, "back on Lens, paid");
    problems.length = 0;
    const s = await state();
    check(s.scans.find((x) => x.id === bill.id)?.status === "paid", `the bill is ${s.scans.find((x) => x.id === bill.id)?.status}`);
    check(s.activity.some((a) => a.agent === "lens" && a.text.startsWith(`Paid ${bill.title}`)), "no payout");
    await device(devices[0][1]);
  });

  // Signing in with that PayPal (backend/src/account.ts): one approval on PayPal saves it with Flick.
  let guestFriends = 0;
  await step("Sign in with PayPal: back on Flick, signed in, with what you did as a guest", async () => {
    const guest = await session();
    guestFriends = (await state()).friends.length;
    await open("/login");
    await click("Sign in with PayPal");
    await throughPayPal(email, password);
    await waitFor("document.body.innerText.includes('Signed in with PayPal')", 20_000, "Signed in with PayPal");
    problems.length = 0;
    const s = await state();
    check(s.profile?.email && s.profile.savedId === "", `profile ${JSON.stringify(s.profile)}`);
    check((await session()) !== guest, "still the guest's workspace");
    check(s.friends.length === guestFriends, `${s.friends.length} friends, not the guest's ${guestFriends}`);
    check(await js("Boolean(document.querySelector('header a[href=\"/profile\"]'))"), "the nav doesn't show who's signed in");
    return `as ${s.profile.name} (${s.profile.email})`;
  });
  await step("Signed in, a flick pays at once from the saved PayPal: no PayPal page", async () => {
    await open("/lens");
    const bill = await snapToPay([["HARBOR GAS CO", 36], ["Gas bill, November", 24], ["Amount due: $0.42", 28], ["Due date: 2026-12-02", 24]], "$0.42");
    await clickPay("$0.42");
    await waitFor("document.querySelector('[role=dialog]')?.innerText.includes('from your PayPal')", 15_000, "the sheet paying from your PayPal");
    // Never PayPal's page: note every place the browser goes until it's back on Lens, paid.
    // (Lens tidies ?paid= out of the address bar as it loads, so it's the navigation that says it.)
    const went = [];
    const watch = (e) => { const m = JSON.parse(String(e.data)); if (m.method === "Page.frameNavigated" && !m.params.frame.parentId) went.push(new URL(m.params.frame.url)); };
    ws.addEventListener("message", watch);
    await tapToPay();
    for (let i = 0; i < 100 && !went.some((u) => u.pathname === "/lens" && u.search.includes("paid=scan")); i++) await sleep(300);
    ws.removeEventListener("message", watch);
    check(went.some((u) => u.pathname === "/lens" && u.search.includes("paid=scan")), `not back on Lens, paid: went to ${went.map((u) => u.pathname + u.search).join(", ") || "nowhere"}`);
    check(!went.some((u) => u.hostname.endsWith("paypal.com")), `went to PayPal: ${went.map((u) => u.hostname).join(", ")}`);
    const s = await state();
    check(s.scans.find((x) => x.id === bill.id)?.status === "paid", `the bill is ${s.scans.find((x) => x.id === bill.id)?.status}`);
    const paid = Object.values(s.checkouts).find((c) => c.kind === "scan" && c.scanId === bill.id && c.status === "captured");
    check(paid?.captureId, "no captured checkout for the bill");
    check(s.activity.some((a) => a.agent === "lens" && a.text.startsWith(`Paid ${bill.title}`)), "no payout");
  });
  // Flick Chat (backend/src/chat.ts): Robin, a friend signed in too, asks for money. Robin's saved
  // PayPal is made up, but Robin only asks: the one paying is this browser's real sandbox buyer.
  await step("Flick Chat: a friend's request, paid with a flick from your saved PayPal, reaches their PayPal; then one pays by itself", async () => {
    const me = (await state()).profile.email;
    const ROBIN = "robin.e2e@flick.example.com";
    const robinWs = "e2e-robin-00000000001";
    const { blank } = await import(new URL("../../backend/src/seed.ts", import.meta.url).href);
    mkdirSync(join(stateDir, "workspaces"), { recursive: true });
    const friend = { id: "you-on-flick", name: "My friend", email: me, color: "green", shape: "drop" };
    writeFileSync(join(stateDir, "workspaces", `${robinWs}.json`), JSON.stringify({ ...blank(), friends: [friend], profile: { name: "Robin", email: ROBIN, savedId: "not-a-real-vault-id", since: new Date().toISOString(), named: true } }));
    const robin = (path, body) =>
      fetch(`http://localhost:${BACK}/api/${path}`, { method: body ? "POST" : "GET", headers: { cookie: `flick=${robinWs}`, ...(body && { "Content-Type": "application/json" }) }, body: body && JSON.stringify(body) }).then(async (r) => ({ status: r.status, json: await r.json() }));

    const asked = await robin("chat/request", { with: me, amount: 0.37, what: "Coffee" });
    check(asked.status === 200 && asked.json.message?.status === "open", `Robin couldn't ask: ${JSON.stringify(asked.json).slice(0, 200)}`);
    await open(`/chat?with=${encodeURIComponent(ROBIN)}`);
    await waitFor("document.body.innerText.includes('Waiting for you')", 20_000, "Robin's request, in the chat");
    await click("Pay $0.37");
    await waitFor("document.querySelector('[role=dialog]')?.innerText.includes('To Robin, from your PayPal')", 10_000, "the sheet paying Robin from your PayPal");
    await tapToPay();
    await waitFor("document.body.innerText.includes('You paid $0.37 for Coffee')", 30_000, "paid, in the chat");
    problems.length = 0;
    const theirs = (await robin("state")).json;
    check(theirs.debts.find((d) => d.chat?.message === asked.json.message.id)?.status === "paid", "not paid in Robin's Flick");
    check(theirs.activity.some((a) => a.text.includes("paid you $0.37 for Coffee")), "Robin's Flick doesn't say so");
    const sent = (await robin(`chat/thread?with=${encodeURIComponent(me)}`)).json.messages.find((m) => m.id === asked.json.message.id);
    check(sent?.status === "paid" && sent.payout !== "failed", `not paid out to Robin's PayPal: ${JSON.stringify(sent)}`);

    // Robin's requests up to $10 pay by themselves: the next one is paid as it arrives, no tap.
    // On a phone the button says just "Off": it's named in full for screen readers.
    await js(`document.querySelector('button[aria-label="Pays by itself: off"]').click()`);
    await sleep(300);
    await click("$10.00");
    await waitFor("document.body.innerText.includes('pays Robin\\'s requests up to $10.00 by itself')", 10_000, "the limit, in the chat");
    const auto = await robin("chat/request", { with: me, amount: 0.23, what: "Gum" });
    check(auto.json.message?.status === "paid" && auto.json.message.auto, `didn't pay by itself: ${JSON.stringify(auto.json.message)}`);
    await waitFor("document.body.innerText.includes('You paid $0.23 for Gum, by itself')", 15_000, "paid by itself, in the chat");
    check((await asMe("chat/allow", { with: ROBIN, cap: 0 })).mine === 0, "couldn't turn it off");
    return "paid $0.37 with a flick, and $0.23 by itself";
  });
  // Flick Safe (backend/src/safe.ts): this browser's real sandbox buyer gives Robin $1.00 for
  // chocolates with a flick. Robin's receipt (read by the real AI) pays back only the chocolates; the
  // gum waits for you, and you don't allow it; the same receipt again is refused; closing the Safe
  // refunds what's left from your real payment.
  await step("Flick Safe: $1.00 for chocolates with a flick; the receipt pays only the chocolates, once; closing refunds the rest", async () => {
    const me = (await state()).profile.email;
    const ROBIN = "robin.e2e@flick.example.com";
    const robinWs = "e2e-robin-00000000001";
    const robin = (path, body) =>
      fetch(`http://localhost:${BACK}/api/${path}`, { method: body ? "POST" : "GET", headers: { cookie: `flick=${robinWs}`, ...(body && { "Content-Type": "application/json" }) }, body: body && JSON.stringify(body) }).then(async (r) => ({ status: r.status, json: await r.json() }));
    const safeOf = async (id) => (await robin(`chat/thread?with=${encodeURIComponent(me)}`)).json.safes.find((s) => (id ? s.id === id : s.purpose === "chocolates" && s.status === "open"));

    await open(`/chat?with=${encodeURIComponent(ROBIN)}`);
    await click("Give money for one thing, in a Safe");
    await fill('input[placeholder="20.00"]', "1.00");
    await fill(`input[aria-label="What it's for"]`, "chocolates");
    await click("Give $1.00 for chocolates");
    await waitFor("document.querySelector('[role=dialog]')?.innerText.includes('To Robin, in a Safe')", 10_000, "the sheet giving Robin a Safe");
    await tapToPay();
    await waitFor("document.body.innerText.includes('Safe · for chocolates')", 30_000, "the Safe, in the chat");
    problems.length = 0;
    const safe = await safeOf();
    check(safe?.left === 1 && safe.captureId, `no Safe in Robin's chat: ${JSON.stringify(safe)}`);

    const receipt = `CORNER SWEETS\nRECEIPT\nDate: ${new Date().toISOString().slice(0, 10)}\nMilk chocolate bar 0.40\nChewing gum 0.30\nTOTAL 0.70\nPaid by card. Thank you!`;
    const { json } = await robin("safe/spend", { with: me, safe: safe.id, text: receipt });
    const spend = json.spend;
    check(spend?.paid === 0.4 && spend.to?.email === ROBIN && spend.payout !== "failed", `the receipt: ${JSON.stringify(json).slice(0, 300)}`);
    check(spend.ask?.status === "open" && spend.ask.amount === 0.3, `the gum: ${JSON.stringify(spend.ask)}`);
    await waitFor("document.body.innerText.includes('Safe paid Robin back $0.40')", 15_000, "the receipt, in your chat");
    await click("Don't allow");
    await waitFor("document.body.innerText.includes('Not allowed: $0.30')", 15_000, "the gum, not allowed");
    const again = (await robin("safe/spend", { with: me, safe: safe.id, text: receipt })).json.spend;
    check(again?.refused?.includes("already used") && again.paid === 0, `the same receipt again: ${JSON.stringify(again).slice(0, 200)}`);

    await click("Close it and get $0.60 back");
    await waitFor("document.body.innerText.includes('$0.60 went back to your PayPal')", 30_000, "the rest, refunded");
    problems.length = 0;
    const closed = await safeOf(safe.id);
    check(closed?.status === "closed" && closed.closed?.returned === 0.6, `closed: ${JSON.stringify(closed?.closed)}`);
    return "gave $1.00; $0.40 back to Robin; $0.30 not allowed; the reused receipt refused; $0.60 refunded";
  });
  await step("Signing out: a new guest Flick; signing in again brings yours back", async () => {
    const mine = await session();
    await open("/profile");
    await click("Sign out");
    await waitFor("location.pathname === '/login' && document.body.innerText.includes('Signed out')", 20_000, "signed out, on /login");
    await open("/home");
    const guest = await state();
    check(!guest.profile && !guest.friends.length, "still signed in, or the guest Flick isn't new");
    await open("/login");
    await click("Sign in with PayPal");
    await throughPayPal(email, password);
    await waitFor("document.body.innerText.includes('Signed in with PayPal')", 20_000, "Signed in with PayPal");
    problems.length = 0;
    check((await session()) === mine, "a different workspace from last time");
    check((await state()).friends.length === guestFriends, "your friends didn't come back");
  });
}

console.log(`\n${passed} of ${passed + failed.length} passed.${failed.length ? ` Failed: ${failed.join("; ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
