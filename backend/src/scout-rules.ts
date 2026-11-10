// Scout's rules: pure, so they're tested (scout-rules.test.ts). scout.ts puts them to work.
//
// - The market: what each store charges for each product, week by week. The stores are sandbox
//   stores, like PayPal's sandbox accounts: their shelf prices are generated from each product's
//   real-world trend (eggs and coffee climbing, olive oil easing), how each store prices, a little
//   noise and the odd promotion. Real online prices come from Channel3 (scout.ts).
// - Usuals: what you buy again and again, and when it's next due, learned from what you bought.
// - Quotes: what a basket costs at each store, delivery included.
// - Forecasts: whether a price is heading up, from the last 12 weeks.

import { addDays, cents, weekday, type Purchase } from './model.ts';

export type Store = { id: string; name: string; kind: 'nearby' | 'online'; miles: number | null; delivery: number; freeOver: number | null; email: string };
export type Product = { id: string; name: string; size: string; perishable: boolean };

export const STORES: Store[] = [
  { id: 'corner-grocery', name: 'Corner Grocery', kind: 'nearby', miles: 0.2, delivery: 0, freeOver: null, email: 'shop@cornergrocery.example.com' },
  { id: 'freshmart', name: 'FreshMart', kind: 'nearby', miles: 1.1, delivery: 0, freeOver: null, email: 'orders@freshmart.example.com' },
  { id: 'valuebasket', name: 'ValueBasket', kind: 'nearby', miles: 2.6, delivery: 0, freeOver: null, email: 'pay@valuebasket.example.com' },
  { id: 'quickcart', name: 'QuickCart', kind: 'online', miles: null, delivery: 3.99, freeOver: 35, email: 'checkout@quickcart.example.com' },
  { id: 'bulkbox', name: 'BulkBox', kind: 'online', miles: null, delivery: 5.99, freeOver: 50, email: 'orders@bulkbox.example.com' },
];

// How each store prices against the market, and whether it sells fresh food.
const PRICING: Record<string, { factor: number; fresh: boolean }> = {
  'corner-grocery': { factor: 1.12, fresh: true },
  freshmart: { factor: 1, fresh: true },
  valuebasket: { factor: 0.9, fresh: true },
  quickcart: { factor: 0.95, fresh: true },
  bulkbox: { factor: 0.86, fresh: false },
};

// id, name, size, market price at week 0, weekly trend, perishable, words that name it on a receipt.
const CATALOG: [string, string, string, number, number, boolean, string[]][] = [
  ['cornflakes', 'Cornflakes', '18 oz box', 4.29, 0, false, ['corn flakes', 'cornflakes']],
  ['milk', 'Whole milk', '1 gallon', 4.19, 0.003, true, ['whole milk', 'milk']],
  ['eggs', 'Eggs', '12 large', 3.89, 0.016, true, ['eggs', 'egg']],
  ['bananas', 'Bananas', '2 lb', 1.38, 0, true, ['banana']],
  ['coffee', 'Coffee beans', '12 oz bag', 9.99, 0.012, false, ['coffee']],
  ['bread', 'Sandwich bread', '20 oz loaf', 3.49, 0.002, true, ['bread', 'loaf']],
  ['yogurt', 'Greek yogurt', '32 oz tub', 5.79, 0, true, ['yogurt', 'yoghurt']],
  ['olive-oil', 'Olive oil', '500 ml', 8.49, -0.009, false, ['olive oil']],
  ['rice', 'Basmati rice', '2 lb bag', 4.99, 0.004, false, ['rice']],
  ['pasta', 'Spaghetti', '1 lb', 1.79, 0, false, ['spaghetti', 'pasta']],
  ['chocolate', 'Dark chocolate', '3.5 oz bar', 3.29, 0.014, false, ['chocolate']],
  ['orange-juice', 'Orange juice', '52 oz', 4.49, 0.008, true, ['orange juice']],
  ['cheddar', 'Cheddar', '8 oz block', 3.99, 0.002, true, ['cheddar', 'cheese']],
  ['apples', 'Apples', '3 lb bag', 4.99, -0.005, true, ['apple']],
  ['butter', 'Butter', '1 lb', 5.49, 0.006, true, ['butter']],
  ['oat-milk', 'Oat milk', '64 oz', 4.79, 0, true, ['oat milk', 'oatmilk']],
  ['chicken', 'Chicken breast', '1 lb', 4.99, 0.003, true, ['chicken']],
  ['paper-towels', 'Paper towels', '6 rolls', 8.99, 0.005, false, ['paper towel']],
  ['dish-soap', 'Dish soap', '20 oz', 3.49, 0, false, ['dish soap']],
  ['toothpaste', 'Toothpaste', '4 oz', 3.99, 0, false, ['toothpaste']],
];

export const PRODUCTS: Product[] = CATALOG.map(([id, name, size, , , perishable]) => ({ id, name, size, perishable }));
const market = new Map(CATALOG.map(([id, , , base, trend, perishable, words]) => [id, { base, trend, perishable, words }]));

// --- Prices ---------------------------------------------------------------------------

/** Week 0 is the week of Monday 9 November 2026; prices move on a week at a time. */
const ANCHOR = Date.parse('2026-11-09T00:00:00Z');
/** The week a date falls in (Monday to Sunday), counted from the anchor. */
export const weekOf = (date: string) => Math.floor((Date.parse(`${date}T00:00:00Z`) - ANCHOR) / (7 * 86_400_000));

// FNV-1a: the same store, product and week always get the same price.
function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** A store's shelf price for a product in a week, and whether it's on promotion; null if the store doesn't sell it. */
export function shelf(productId: string, storeId: string, week: number): { price: number; promo: boolean } | null {
  const p = market.get(productId);
  const store = PRICING[storeId];
  if (!p || !store || (p.perishable && !store.fresh)) return null;
  const h = hash(`${productId}:${storeId}:${week}`);
  const noise = ((h % 1000) / 1000 - 0.5) * 0.04;
  const promo = (h >>> 12) % 8 === 0; // about one week in eight: 15% off
  const raw = p.base * store.factor * (1 + p.trend) ** week * (1 + noise) * (promo ? 0.85 : 1);
  // Shelf prices end in 9: $4.29.
  return { price: Math.max(0.49, cents(Math.round(raw * 10) / 10 - 0.01)), promo };
}

/** Every store's price for a product this week, cheapest first. */
export function offers(productId: string, week: number) {
  return STORES.flatMap((store) => {
    const s = shelf(productId, store.id, week);
    return s ? [{ storeId: store.id, ...s }] : [];
  }).sort((a, b) => a.price - b.price);
}

// --- What you buy ----------------------------------------------------------------------

/**
 * Scout's starting history: eight weeks of the demo household's shopping, mostly at Corner Grocery
 * (the nearest). Sunday is the big shop; milk runs out by Wednesday; coffee every other week;
 * chocolate now and then, which isn't a habit. `today` is a Sunday, Flick's planning day.
 */
export function seedPurchases(today: string): Purchase[] {
  // product, days after Sunday, which weeks back (1 is last week)
  const shops: [string, number, number[]][] = [
    ['cornflakes', 0, [1, 2, 3, 4, 6, 7, 8]],
    ['milk', 0, [1, 2, 3, 4, 5, 6, 7, 8]],
    ['milk', 3, [1, 2, 3, 4, 5, 6, 7, 8]],
    ['eggs', 0, [1, 2, 4, 5, 6, 7, 8]],
    ['bread', 0, [1, 2, 3, 4, 5, 6, 7, 8]],
    ['yogurt', 0, [1, 2, 3, 5, 6, 8]],
    ['coffee', 0, [2, 4, 6, 8]],
    ['bananas', 6, [1, 2, 3, 4, 5, 6, 7, 8]],
    ['chocolate', 0, [3, 7]],
  ];
  const out: Purchase[] = [];
  for (const [productId, after, weeks] of shops) {
    for (const back of weeks) {
      const date = addDays(today, after - 7 * back);
      if (date >= today) continue;
      const store = back % 4 === 3 ? STORES[1] : STORES[0]; // now and then at FreshMart
      const price = shelf(productId, store.id, weekOf(date))!.price;
      out.push({ productId, storeId: store.id, store: store.name, price, qty: 1, date, from: 'history' });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** The catalog product a receipt line is, by the longest word for one it contains ("oat milk" beats "milk"); null if none. */
export function match(line: string): string | null {
  const text = ` ${line.toLowerCase().replace(/[^a-z]+/g, ' ')} `;
  let best: [string, number] | null = null;
  for (const [id, { words }] of market) {
    for (const word of words) {
      if ((text.includes(` ${word} `) || text.includes(` ${word}s `)) && word.length > (best?.[1] ?? 0)) best = [id, word.length];
    }
  }
  return best?.[0] ?? null;
}

const LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export type Usual = {
  productId: string;
  /** How often, in days, and in words: "every Sunday", "twice a week", "every other Sunday". */
  every: number;
  label: string;
  times: number;
  last: Purchase;
  /** When it's next due, YYYY-MM-DD. */
  due: string;
};

/** What you buy again and again: bought at least 3 times in the last 8 weeks, at a steady pace. */
export function usuals(purchases: Purchase[], today: string): Usual[] {
  const since = addDays(today, -56);
  const byProduct = new Map<string, Purchase[]>();
  for (const p of purchases) if (p.date >= since && p.date <= today) byProduct.set(p.productId, [...(byProduct.get(p.productId) ?? []), p]);

  const found: Usual[] = [];
  for (const [productId, list] of byProduct) {
    const dates = [...new Set(list.map((p) => p.date))].sort();
    if (dates.length < 3) continue;
    const gaps = dates.slice(1).map((d, i) => (Date.parse(d) - Date.parse(dates[i])) / 86_400_000).sort((a, b) => a - b);
    const every = gaps[Math.floor(gaps.length / 2)] / 2 + gaps[Math.ceil(gaps.length / 2) - 1] / 2; // the median
    // Steady: most gaps within a few days of the median (a missed week counts as two).
    const steady = gaps.filter((g) => Math.abs(g - every) <= 2 || Math.abs(g - 2 * every) <= 2).length >= gaps.length * 0.75;
    if (!steady || every > 31) continue;

    const days = dates.map(weekday);
    const usualDay = [...Array(7).keys()].sort((a, b) => days.filter((d) => d === b).length - days.filter((d) => d === a).length)[0];
    const label =
      every <= 4.5
        ? `${Math.round(7 / every) === 2 ? 'twice' : `${Math.round(7 / every)} times`} a week`
        : every <= 8
          ? `every ${LONG[usualDay]}`
          : every <= 15
            ? `every other ${LONG[usualDay]}`
            : `every ${Math.round(every)} days`;
    const last = list.filter((p) => p.date === dates.at(-1)).at(-1)!;
    found.push({ productId, every, label, times: dates.length, last, due: addDays(last.date, Math.round(every)) });
  }
  return found.sort((a, b) => a.due.localeCompare(b.due) || a.productId.localeCompare(b.productId));
}

// --- Baskets ---------------------------------------------------------------------------

export type Line = { productId: string; qty: number; price: number; promo: boolean };
export type Quote = { storeId: string; lines: Line[]; missing: string[]; subtotal: number; delivery: number; total: number };

/** What a basket costs at each store: stores with everything first, cheapest first. */
export function quote(items: { productId: string; qty: number }[], week: number): Quote[] {
  return STORES.map((store) => {
    const lines: Line[] = [];
    const missing: string[] = [];
    for (const { productId, qty } of items) {
      const s = shelf(productId, store.id, week);
      if (s) lines.push({ productId, qty, ...s });
      else missing.push(productId);
    }
    const subtotal = cents(lines.reduce((sum, l) => sum + l.price * l.qty, 0));
    const delivery = store.kind === 'online' && subtotal < (store.freeOver ?? Infinity) ? store.delivery : 0;
    return { storeId: store.id, lines, missing, subtotal, delivery, total: cents(subtotal + delivery) };
  }).sort((a, b) => a.missing.length - b.missing.length || a.total - b.total);
}

// --- Forecasts -------------------------------------------------------------------------

export type Forecast = {
  /** The market price (the middle of the stores' prices) for each of the last 12 weeks, oldest first. */
  history: number[];
  /** Where it's heading over the next 4 weeks, as a fraction: 0.05 is 5% up. */
  change: number;
  /** How well a steady trend fits those weeks, 0 to 1. */
  fit: number;
  verdict: 'rising' | 'falling' | 'steady';
};

/** A straight line through the log of the last 12 weeks' prices, carried 4 weeks on. A trend, not a promise. */
export function forecast(productId: string, week: number): Forecast {
  const history = [...Array(12).keys()].map((i) => {
    const prices = STORES.flatMap((s) => shelf(productId, s.id, week - 11 + i)?.price ?? []).sort((a, b) => a - b);
    return prices.length ? prices[Math.floor(prices.length / 2)] : 0;
  });
  const ys = history.map(Math.log);
  const n = ys.length;
  const mx = (n - 1) / 2;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const sxy = ys.reduce((sum, y, x) => sum + (x - mx) * (y - my), 0);
  const sxx = ys.reduce((sum, _, x) => sum + (x - mx) ** 2, 0);
  const syy = ys.reduce((sum, y) => sum + (y - my) ** 2, 0);
  const slope = sxy / sxx;
  const fit = syy ? (sxy * sxy) / (sxx * syy) : 0;
  const change = Math.exp(4 * slope) - 1;
  const verdict = fit >= 0.4 && change >= 0.03 ? 'rising' : fit >= 0.4 && change <= -0.03 ? 'falling' : 'steady';
  return { history, change: Math.round(change * 1000) / 1000, fit: Math.round(fit * 100) / 100, verdict };
}
