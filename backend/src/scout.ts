import { aiKey, askJson } from './ai.ts';
import { startCheckout } from './checkout.ts';
import { HttpError, need } from './http.ts';
import { addDays, cents, id, usd, ymd, type Checkout, type Purchase } from './model.ts';
import { createPayout } from './paypal.ts';
import { forecast, match, offers, PRODUCTS, quote, seedPurchases, STORES, usuals, weekOf } from './scout-rules.ts';
import { log, save, state } from './store.ts';

// Scout: learns what you buy again and again, finds where it's cheapest this week, says when a
// price is heading up, and buys the basket with one PayPal approval.
//
// - Nearby and online stores are sandbox stores (scout-rules.ts); Scout buys from them through
//   PayPal: a checkout captured into Flick's account, then a payout to the store.
// - Real online prices come from Channel3's product search (CHANNEL3_API_KEY), with buy links.
// - The AI model reads a photo of a shelf, a fridge, a cart or a shopping list into products.
// - What you buy: Scout's own history, every receipt Lens reads, and the baskets Scout buys.

/** Flick's today: the day Autopilot's week is on (-1 is the Sunday before it starts). */
const today = () => addDays(state.week.starts, state.week.today);

function bought(): Purchase[] {
  if (!state.scout) {
    state.scout = { purchases: seedPurchases(addDays(state.week.starts, -1)) };
    save();
  }
  // Receipts Lens read, line by line, for the lines that are a product Scout knows.
  const receipts = state.scans.flatMap((scan) =>
    scan.kind !== 'receipt'
      ? []
      : scan.items.flatMap((item) => {
          const productId = match(item.name);
          const store = STORES.find((s) => s.name.toLowerCase() === scan.title.toLowerCase());
          return productId && item.price > 0
            ? [{ productId, storeId: store?.id ?? null, store: scan.title, price: item.price, qty: 1, date: scan.at.slice(0, 10), from: 'receipt' as const }]
            : [];
        }),
  );
  return [...state.scout.purchases, ...receipts];
}

/** Rising, and it keeps: buy two this time. */
const stockUp = (productId: string, week: number) => !PRODUCTS.find((p) => p.id === productId)?.perishable && forecast(productId, week).verdict === 'rising';

/** Everything Scout knows: the products with this week's prices and trends, your usuals, and the next shop priced at every store. */
export function view() {
  const day = today();
  const week = weekOf(day);
  const usual = usuals(bought(), day);

  const products = PRODUCTS.map((p) => {
    const u = usual.find((x) => x.productId === p.id);
    return { ...p, offers: offers(p.id, week), forecast: forecast(p.id, week), usual: u ?? null, stockUp: stockUp(p.id, week) };
  });

  // The next shop: every usual due in the next two days, or overdue.
  const items = usual.filter((u) => u.due <= addDays(day, 2)).map((u) => ({ productId: u.productId, qty: stockUp(u.productId, week) ? 2 : 1 }));
  const counts = new Map<string, number>();
  for (const u of usual) if (u.last.storeId) counts.set(u.last.storeId, (counts.get(u.last.storeId) ?? 0) + 1);
  const usualStore = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? STORES[0].id;

  return {
    today: day,
    stores: STORES,
    products,
    basket: { items, quotes: quote(items, week), usualStore },
    config: { ai: Boolean(aiKey()), online: Boolean(process.env.CHANNEL3_API_KEY) },
  };
}

const parseItems = (raw: unknown) => {
  need(Array.isArray(raw) && raw.length > 0 && raw.length <= 30, 'items must be a list of 1 to 30 { productId, qty }.');
  return (raw as { productId?: unknown; qty?: unknown }[]).map((item) => {
    const qty = Number(item.qty ?? 1);
    need(PRODUCTS.some((p) => p.id === item.productId), `Scout doesn't know the product ${String(item.productId)}.`);
    need(Number.isInteger(qty) && qty >= 1 && qty <= 12, 'qty must be a whole number from 1 to 12.');
    return { productId: item.productId as string, qty };
  });
};

/** A basket priced at every store this week. */
export const priceBasket = (body: Record<string, unknown>) => quote(parseItems(body.items), weekOf(today()));

// --- Reading a photo -------------------------------------------------------------------

const PROMPT = `You are Scout, a shopping agent. The photo shows groceries or household products: a store shelf, a fridge, a pantry, a cart, or a shopping list (handwritten or printed).
List each distinct product you can see or read, once, with:
- seen: what it is, as on the pack, tag or list, e.g. "Whole milk, 1 gal".
- qty: how many are shown or written; 1 if unclear.
- shelfPrice: the price on a shelf tag or sticker clearly for this product, or 0 if none is visible.
- productId: the id of the catalog product that is the same kind of thing (any brand), or "" if none is.
where: "shelf", "fridge", "pantry", "cart", "list" or "other". Never invent products or prices you can't see.
Catalog: ${PRODUCTS.map((p) => `${p.id} = ${p.name} (${p.size})`).join('; ')}`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['where', 'items'],
  properties: {
    where: { type: 'string', enum: ['shelf', 'fridge', 'pantry', 'cart', 'list', 'other'] },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['seen', 'qty', 'shelfPrice', 'productId'],
        properties: { seen: { type: 'string' }, qty: { type: 'integer' }, shelfPrice: { type: 'number' }, productId: { type: 'string' } },
      },
    },
  },
};

type Seen = { where: string; items: { seen: string; qty: number; shelfPrice: number; productId: string }[] };

/** Reads every product in a photo, and prices the ones Scout knows at every store. */
export async function read(body: Record<string, unknown>) {
  const { image } = body;
  need(typeof image === 'string' && /^data:image\/(png|jpe?g|webp|gif|heic|heif);base64,/.test(image), 'image must be a data URL of a PNG, JPEG, WebP, GIF or HEIC photo.');

  const answer = await askJson<Seen>('scout_read', SCHEMA, [
    { role: 'system', content: PROMPT },
    { role: 'user', content: [{ type: 'text', text: 'What products are in this photo?' }, { type: 'image_url', image_url: { url: image } }] },
  ]);

  // The model's word is checked: known ids only, sane quantities and prices.
  const week = weekOf(today());
  const items = (Array.isArray(answer.items) ? answer.items : []).slice(0, 30).map((item) => {
    const productId = PRODUCTS.some((p) => p.id === item.productId) ? item.productId : null;
    return {
      seen: String(item.seen ?? '').slice(0, 120),
      qty: Math.min(12, Math.max(1, Math.round(Number(item.qty) || 1))),
      shelfPrice: Number(item.shelfPrice) > 0 && Number(item.shelfPrice) < 1000 ? cents(Number(item.shelfPrice)) : null,
      productId,
      offers: productId ? offers(productId, week) : [],
    };
  });
  const known = items.flatMap((i) => (i.productId ? [{ productId: i.productId, qty: i.qty }] : []));
  log('scout', `Read ${items.length} product${items.length === 1 ? '' : 's'} from a photo of a ${answer.where ?? 'shelf'}`);
  save();
  return { where: answer.where ?? 'other', items, quotes: known.length ? quote(known, week) : [] };
}

// --- Real online prices (Channel3) -------------------------------------------------------

type C3Offer = { url?: string; domain?: string; price?: { price?: number; compare_at_price?: number | null; currency?: string }; availability?: string };
type C3Product = { id?: string; title?: string; images?: { url?: string; is_main_image?: boolean }[]; offers?: C3Offer[] };

// Searches are counted against Channel3's free tier, so the same search is reused for a few hours.
// ponytail: in-memory, per process; fine for a demo.
const searches = new Map<string, { at: number; result: unknown }>();

/** Live prices for a product (or anything, by `query`) at online stores, cheapest first, from Channel3. */
export async function online(body: Record<string, unknown>) {
  const key = process.env.CHANNEL3_API_KEY;
  if (!key) throw new HttpError(503, 'Online prices are off: set CHANNEL3_API_KEY in backend/.env (free at channel3.ai).');
  const product = PRODUCTS.find((p) => p.id === body.productId);
  const query = product ? `${product.name} ${product.size}` : typeof body.query === 'string' ? body.query.trim().slice(0, 120) : '';
  need(query.length > 1, 'Send a productId Scout knows, or a query.');

  const cached = searches.get(query);
  if (cached && Date.now() - cached.at < 6 * 3_600_000) return cached.result;

  const res = await fetch('https://api.trychannel3.com/v1/search', {
    method: 'POST',
    headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit: 10, config: { country: 'US', currency: 'USD' } }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new HttpError(502, `Channel3 answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const { products = [] } = (await res.json()) as { products?: C3Product[] };

  // One row per offer: the product, the store, its price. Only in-stock offers in US dollars.
  const found = products
    .flatMap((p) =>
      (p.offers ?? []).flatMap((o) => {
        const price = Number(o.price?.price);
        const url = typeof o.url === 'string' && o.url.startsWith('https://') ? o.url : null;
        if (!url || !(price > 0) || (o.price?.currency ?? 'USD') !== 'USD' || (o.availability && o.availability !== 'InStock')) return [];
        const image = (p.images ?? []).find((i) => i.is_main_image)?.url ?? p.images?.[0]?.url ?? null;
        return [{ title: String(p.title ?? query).slice(0, 140), store: String(o.domain ?? new URL(url).hostname), price: cents(price), was: Number(o.price?.compare_at_price) > price ? cents(Number(o.price!.compare_at_price)) : null, url, image }];
      }),
    )
    .sort((a, b) => a.price - b.price)
    .slice(0, 8);

  const result = { query, offers: found, at: new Date().toISOString() };
  searches.set(query, { at: Date.now(), result });
  return result;
}

// --- Buying ------------------------------------------------------------------------------

/** Starts the PayPal checkout for a basket at one sandbox store. The price is Scout's, never the client's. */
export async function buy(body: Record<string, unknown>) {
  const store = STORES.find((s) => s.id === body.storeId);
  need(store, `No store ${String(body.storeId)}.`);
  const items = parseItems(body.items);
  const q = quote(items, weekOf(today())).find((x) => x.storeId === store.id)!;
  need(!q.missing.length, `${store.name} doesn't sell ${q.missing.map((m) => PRODUCTS.find((p) => p.id === m)!.name.toLowerCase()).join(', ')}.`, 409);
  need(q.total <= 500, 'Scout buys baskets of up to $500.', 409);

  const name = (productId: string) => PRODUCTS.find((p) => p.id === productId)!.name;
  return startCheckout(
    { kind: 'basket', storeId: store.id, items: q.lines.map(({ productId, qty, price }) => ({ productId, qty, price })) },
    `basket-${store.id}-${id('a')}`,
    `Flick: groceries at ${store.name}`,
    [
      ...q.lines.map((l) => ({ name: `${name(l.productId)}${l.qty > 1 ? ` ×${l.qty}` : ''}`, amount: cents(l.price * l.qty) })),
      ...(q.delivery ? [{ name: `Delivery from ${store.name}`, amount: q.delivery }] : []),
    ],
  );
}

/** The basket's checkout was captured: pay the store, and remember what was bought. */
export async function paid(checkout: Extract<Checkout, { kind: 'basket' }>) {
  const store = STORES.find((s) => s.id === checkout.storeId);
  if (!store) return;
  if (!state.payees.some((p) => p.id === store.id)) state.payees.push({ id: store.id, name: store.name, email: store.email, icon: 'cart' });

  const day = today();
  bought(); // starts Scout's history if this is its first purchase
  state.scout!.purchases.push(...checkout.items.map((i) => ({ productId: i.productId, storeId: store.id, store: store.name, price: i.price, qty: i.qty, date: day, from: 'scout' as const })));
  const names = checkout.items.map((i) => PRODUCTS.find((p) => p.id === i.productId)?.name ?? i.productId);
  state.history.push({ payeeId: store.id, what: `Groceries: ${names.join(', ')}`, amount: checkout.amount, date: ymd(new Date()) });

  // What the same basket costs where you usually shop, to say what Scout saved.
  const usualStore = view().basket.usualStore;
  const there = quote(checkout.items, weekOf(day)).find((q) => q.storeId === usualStore);
  const saved = there && !there.missing.length && usualStore !== store.id ? cents(there.total - checkout.amount) : 0;

  try {
    await createPayout(`basket-${checkout.orderId}`, `Flick paid you for groceries`, [
      { id: checkout.orderId, email: store.email, amount: checkout.amount, note: `Groceries: ${names.join(', ')}. Paid by Flick.` },
    ]);
    checkout.paidOut = new Date().toISOString();
    log('scout', `Bought ${names.length} item${names.length === 1 ? '' : 's'} at ${store.name}${saved > 0 ? `, ${usd(saved)} less than at ${STORES.find((s) => s.id === usualStore)?.name}` : ''}`, checkout.amount);
  } catch (err) {
    log('scout', `Took ${usd(checkout.amount)} for ${store.name}, but couldn't pay them out: ${err instanceof Error ? err.message : err}`);
  }
  save();
}
