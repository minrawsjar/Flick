import { askJson } from './ai.ts';
import { replan } from './autopilot.ts';
import { startCheckout } from './checkout.ts';
import { HttpError, need } from './http.ts';
import { cents, id, usd, ymd, type Checkout, type Payee, type Scan } from './model.ts';
import { createPayout } from './paypal.ts';
import { checkLens, type LensAnswer } from './rules.ts';
import { log, save, state } from './store.ts';

// Lens: reads a photo of something to pay (a bill, a receipt, a price tag, a tip jar) with a vision
// model, then pays it through a PayPal checkout. A receipt goes to Splitter instead (split.ts).

const PROMPT = `You are Lens, the reader inside Flick, a payments app. You get one photo of something the
person may want to pay: a bill or invoice, a restaurant receipt, a price tag or product, or a tip jar
or QR code to tip someone. Report only what you can read in the photo; never guess an amount.

- kind: "bill", "receipt", "product" or "tip"; "unknown" if it isn't something to pay.
- title: who gets paid (biller, merchant, shop or person), or the product's name.
- summary: a few words, e.g. "Electricity, November" or "6 items, with tax and tip".
- amount: the total to pay as a number (a bill's amount due, a receipt's total, a product's price); 0 if
  none is visible, and 0 for tip jars.
- currency: the ISO 4217 code of the amounts as printed (amounts stay in it; never convert). Read the
  symbol or word (₹, Rs, Rs., INR → "INR"; € → "EUR"; £ → "GBP"; ¥ → "JPY" or "CNY"), and when there's
  no symbol, or a "$" shared by several countries, go by where the shop is: its address, phone code
  (+91), tax (GST, VAT) and language. "USD" only when nothing points elsewhere.
- due: the due date as YYYY-MM-DD, or "" if none.
- repeats: "monthly" or "weekly" if it's clearly a recurring bill or subscription, else "".
- handle: a PayPal email or @handle shown (tip jars often have one), else "".
- items: for receipts, each line item with its price; [] otherwise.
- tax, tip: amounts on a receipt, 0 if none.
- fields: 3 to 8 short key/value pairs a person would want to check, e.g. account number, period.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'title', 'summary', 'amount', 'currency', 'due', 'repeats', 'handle', 'items', 'tax', 'tip', 'fields'],
  properties: {
    kind: { type: 'string', enum: ['bill', 'receipt', 'product', 'tip', 'unknown'] },
    title: { type: 'string' },
    summary: { type: 'string' },
    amount: { type: 'number' },
    currency: { type: 'string' },
    due: { type: 'string' },
    repeats: { type: 'string', enum: ['', 'weekly', 'monthly'] },
    handle: { type: 'string' },
    items: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['name', 'price'], properties: { name: { type: 'string' }, price: { type: 'number' } } },
    },
    tax: { type: 'number' },
    tip: { type: 'number' },
    fields: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['key', 'value'], properties: { key: { type: 'string' }, value: { type: 'string' } } },
    },
  },
};

// PayPal charges in USD here (a US sandbox account; PayPal takes INR only on Indian accounts), so a
// bill in another currency is converted when Lens reads it, at the day's ECB rate from Frankfurter,
// and the scan keeps what the photo said to show it.
const rates = new Map<string, { rate: number; at: number }>();
async function usdRate(currency: string) {
  const hit = rates.get(currency);
  if (hit && Date.now() - hit.at < 6 * 3_600_000) return hit.rate;
  const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${currency}&symbols=USD`, { signal: AbortSignal.timeout(8000) });
  const rate = res.ok ? Number(((await res.json()) as { rates?: { USD?: number } }).rates?.USD) : NaN;
  if (!(rate > 0)) throw new Error(`no USD rate for ${currency}`);
  rates.set(currency, { rate, at: Date.now() });
  return rate;
}

/** The scan with its amounts in USD. Left as it is if there's no rate (paying it is then refused). */
async function inUsd<T extends Omit<Scan, 'payeeId'>>(scan: T): Promise<T> {
  if (scan.currency === 'USD') return scan;
  try {
    const rate = await usdRate(scan.currency);
    const convert = (n: number) => cents(n * rate);
    const original = { currency: scan.currency, amount: scan.amount, rate };
    return { ...scan, currency: 'USD', amount: convert(scan.amount), items: scan.items.map((i) => ({ ...i, price: convert(i.price) })), tax: convert(scan.tax), tip: convert(scan.tip), original };
  } catch (err) {
    console.error('Lens currency:', err instanceof Error ? err.message : err);
    return scan;
  }
}

/** "₹801.00 ($8.53)" for a converted scan, "$64.20" otherwise. */
const shown = (scan: Scan) => {
  if (!scan.original) return scan.currency === 'USD' ? usd(scan.amount) : `${scan.amount} ${scan.currency}`;
  return `${new Intl.NumberFormat('en-US', { style: 'currency', currency: scan.original.currency }).format(scan.original.amount)} (${usd(scan.amount)})`;
};

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'payee';

/** The payee a scan pays: one Flick already knows by name, or a new one. */
function payeeFor(scan: Omit<Scan, 'payeeId'>): Payee {
  const known = state.payees.find((p) => p.name.toLowerCase() === scan.title.toLowerCase());
  if (known) return known;
  const email = scan.handle && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(scan.handle) ? scan.handle : `${slug(scan.title)}@flick.example.com`;
  const created: Payee = { id: `${slug(scan.title)}-${id('p').slice(2)}`, name: scan.title, email, icon: scan.kind === 'tip' ? 'coffee' : scan.kind === 'product' ? 'bag' : 'bill' };
  state.payees.push(created);
  return created;
}

/** Reads a photo, sent as a data URL. */
export async function read(body: Record<string, unknown>) {
  const { image } = body;
  need(typeof image === 'string' && /^data:image\/(png|jpe?g|webp|gif|heic|heif);base64,/.test(image), 'image must be a data URL of a PNG, JPEG, WebP, GIF or HEIC photo.');

  const answer = await askJson<Partial<LensAnswer>>('lens_read', SCHEMA, [
    { role: 'system', content: PROMPT },
    {
      role: 'user',
      content: [
        { type: 'text', text: `Today is ${ymd(new Date())}. What is this, and what is there to pay?` },
        { type: 'image_url', image_url: { url: image } },
      ],
    },
  ]);

  const checked = await inUsd(checkLens(answer, id('scan'), new Date().toISOString()));
  // A receipt can be paid (a restaurant's bill) or split, so it gets a payee too.
  const scan: Scan = checked.kind === 'unknown' ? checked : { ...checked, payeeId: payeeFor(checked).id };
  state.scans.unshift(scan);
  // A bill due this week goes into Autopilot's plan too, ready to approve with the rest.
  if (scan.kind === 'bill') replan();
  log('lens', checked.kind === 'unknown' ? `Couldn't find anything to pay in that photo` : `Read a ${scan.kind}: ${scan.title}${scan.amount ? `, ${shown(scan)}` : ''}`, scan.amount || undefined);
  save();
  return scan;
}

/** Starts the PayPal checkout for a bill, product or tip Lens read. Returns where to approve it. */
export async function pay(body: Record<string, unknown>) {
  const scan = state.scans.find((s) => s.id === body.scanId);
  if (!scan) throw new HttpError(404, `No scan ${String(body.scanId)}`);
  need(scan.kind !== 'unknown', "There's nothing to pay in this scan.", 409);
  need(scan.status !== 'paid', `${scan.title} is already paid.`, 409);
  // Scans read before Lens converted currencies, or paid receipts, didn't get these when read.
  if (scan.currency !== 'USD') Object.assign(scan, await inUsd(scan));
  scan.payeeId ??= payeeFor(scan).id;
  need(scan.currency === 'USD', `Flick pays in USD on the sandbox, and couldn't get today's rate for ${scan.currency}. Try again in a minute.`, 409);

  // A tip's amount is the person's choice; everything else is what Lens read.
  const amount = scan.kind === 'tip' ? Number(body.amount) : scan.amount;
  need(Number.isFinite(amount) && amount > 0 && amount <= (scan.kind === 'tip' ? 500 : 10_000), scan.kind === 'tip' ? 'amount must be a tip between $0 and $500.' : 'Lens found no amount to pay.');

  const checkout = await startCheckout(
    { kind: 'scan', scanId: scan.id, payeeId: scan.payeeId!, repeat: body.repeat === true && scan.kind === 'bill' },
    `scan-${scan.id}-${id('a')}`,
    `Flick: ${scan.title}`,
    [{ name: `${scan.title}: ${scan.summary || scan.kind}`, amount: cents(amount) }],
  );
  scan.status = 'awaiting';
  save();
  return checkout;
}

/** The checkout was captured: forward the money to the payee, and learn the bill if asked to. */
export async function paid(checkout: Extract<Checkout, { kind: 'scan' }>) {
  const scan = state.scans.find((s) => s.id === checkout.scanId);
  const to = state.payees.find((p) => p.id === checkout.payeeId);
  if (!scan || !to) return;
  scan.status = 'paid';
  state.history.push({ payeeId: to.id, what: scan.summary || scan.title, amount: checkout.amount, date: ymd(new Date()) });
  // Paid here, so Autopilot's week doesn't pay it too (before approval, the plan can still change).
  if (!state.week.approval) state.week.payments = state.week.payments.filter((p) => !(p.payeeId === to.id && p.status === 'planned'));

  try {
    await createPayout(`scan-${scan.id}-${id('b')}`, `Flick paid you for ${scan.title}`, [
      { id: scan.id, email: to.email, amount: checkout.amount, note: `${scan.summary || scan.title}, paid by Flick` },
    ]);
    checkout.paidOut = new Date().toISOString();
    log('lens', `Paid ${to.name}${scan.summary ? `: ${scan.summary}` : ''}`, checkout.amount);
  } catch (err) {
    log('lens', `Took ${usd(checkout.amount)} for ${to.name}, but couldn't pay them out: ${err instanceof Error ? err.message : err}`);
  }

  if (checkout.repeat) {
    const dayOfMonth = Number((scan.due ?? ymd(new Date())).slice(8));
    state.monthly = state.monthly.filter((m) => m.payeeId !== to.id);
    state.monthly.push({ payeeId: to.id, what: scan.summary || 'Bill', amount: checkout.amount, dayOfMonth, since: ymd(new Date()) });
    log('autopilot', `Learned ${to.name}: ${usd(checkout.amount)} every month on day ${dayOfMonth}`);
  }
  save();
}
