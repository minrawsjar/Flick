"use client";

import type { ColDef, ICellRendererParams } from "ag-grid-community";
import {
  Apple,
  Banana,
  Camera,
  Candy,
  Citrus,
  Coffee,
  Croissant,
  CupSoda,
  Drumstick,
  Droplet,
  Egg,
  ExternalLink,
  Globe,
  LoaderCircle,
  MapPin,
  Milk,
  ShoppingBasket,
  Truck,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { view } from "@backend/scout";
import { Bot } from "@/components/bot";
import { Grid } from "@/components/grid";
import { Phone } from "@/components/phone";
import { Primary, Tile } from "@/components/ui";
import { usd } from "@/lib/format";
import { approveOnPayPal, useLive } from "@/lib/live";
import { agents } from "./data";
import { shrink } from "./lens";

// Scout (/scout): what you buy again and again, where it's cheapest this week, whether its price is
// heading up, and buying it all with one PayPal approval. The backend does the thinking
// (backend/src/scout.ts); this shows it. Without the backend, the phone plays a fixed example.

export type ScoutView = ReturnType<typeof view>;
type Product = ScoutView["products"][number];
type Quote = ScoutView["basket"]["quotes"][number];
type Item = { productId: string; qty: number };

const icons: Record<string, LucideIcon> = {
  cornflakes: Wheat,
  milk: Milk,
  "oat-milk": Milk,
  eggs: Egg,
  bananas: Banana,
  coffee: Coffee,
  bread: Croissant,
  yogurt: CupSoda,
  "olive-oil": Droplet,
  rice: Wheat,
  pasta: Wheat,
  chocolate: Candy,
  "orange-juice": Citrus,
  apples: Apple,
  chicken: Drumstick,
  "dish-soap": Droplet,
};
const Icon = ({ id, size = 16 }: { id: string; size?: number }) => {
  const I = icons[id] ?? ShoppingBasket;
  return <I size={size} strokeWidth={1.75} aria-hidden />;
};

const pct = (n: number) => `${Math.abs(Math.round(n * 100))}%`;
const LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const dayName = (date: string) => LONG[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7];

/** A price line over the last 12 weeks. */
function Spark({ values, verdict, width = 72, height = 22 }: { values: number[]; verdict: string; width?: number; height?: number }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - 2 - ((v - min) / (max - min || 1)) * (height - 4)}`).join(" ");
  const color = verdict === "rising" ? "var(--color-wait)" : verdict === "falling" ? "var(--color-paid)" : "var(--color-secondary)";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="shrink-0 overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Trend({ forecast }: { forecast: Product["forecast"] }) {
  if (forecast.verdict === "steady") return <span className="text-secondary">Steady</span>;
  return (
    <span className={forecast.verdict === "rising" ? "text-wait" : "text-paid"}>
      {forecast.verdict === "rising" ? "▲" : "▼"} {pct(forecast.change)} in 4 weeks
    </span>
  );
}

// --- The phone -------------------------------------------------------------------------

type Screen = {
  day: string;
  lines: { productId: string; name: string; qty: number; price: number; promo: boolean; usual: number | null }[];
  store: { name: string; where: string };
  total: number;
  usualTotal: number | null;
  usualName: string;
  rising: string | null;
};

export function ScoutScreen({ screen, onBuy, buying, quotes, chosen, onChoose, stores }: {
  screen: Screen;
  onBuy?: () => void;
  buying?: boolean;
  quotes?: Quote[];
  chosen?: string;
  onChoose?: (storeId: string) => void;
  stores?: ScoutView["stores"];
}) {
  const saving = screen.usualTotal !== null ? screen.usualTotal - screen.total : 0;
  return (
    <div className="flex h-full flex-col px-3 pb-3">
      <div className="flex items-center justify-between px-1 pb-2 pt-1">
        <h4 className="text-[26px] font-semibold tracking-tight">Shop</h4>
        <span className="rounded-full bg-fill px-2.5 py-1 text-[11px]">
          {screen.day.slice(0, 3)} · {screen.lines.length} due
        </span>
      </div>
      <div className="flex gap-2 rounded-[18px] bg-card p-2.5 text-[12px] leading-4">
        <Bot {...agents.scout} size={26} mood="awake" />
        <p>
          {saving > 0.005 ? (
            <>
              Your usuals are <b className="font-medium">{usd(saving)} less</b> at {screen.store.name} ({screen.store.where}) than at {screen.usualName}.
            </>
          ) : (
            <>Your usuals, at the best price I can find this week.</>
          )}
          {screen.rising && <> {screen.rising}</>}
        </p>
      </div>

      {quotes && onChoose && stores && (
        <div className="-mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3 pb-0.5 text-[11px]" role="radiogroup" aria-label="Store">
          {quotes.map((q) => {
            const store = stores.find((s) => s.id === q.storeId)!;
            const on = q.storeId === chosen;
            return (
              <button
                key={q.storeId}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={q.missing.length > 0}
                onClick={() => onChoose(q.storeId)}
                className={`pressable shrink-0 cursor-pointer rounded-full px-2.5 py-1 disabled:cursor-default disabled:opacity-40 ${on ? "bg-ink text-on-ink" : "bg-card"}`}
              >
                {store.name} {q.missing.length ? "· missing items" : usd(q.total)}
              </button>
            );
          })}
        </div>
      )}

      <ul className="mt-2 min-h-0 flex-1 divide-y divide-separator/50 overflow-y-auto rounded-[18px] bg-card px-2.5">
        {screen.lines.map((l) => (
          <li key={l.productId} className="flex items-center gap-2 py-1.5 text-[12px]">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-fill">
              <Icon id={l.productId} size={14} />
            </span>
            <span className="min-w-0 flex-1 truncate">
              {l.name}
              {l.qty > 1 && <span className="text-secondary"> ×{l.qty}</span>}
              {l.promo && <span className="ml-1 rounded bg-paid/15 px-1 text-[10px] text-paid">deal</span>}
            </span>
            {l.usual !== null && l.usual > l.price && <s className="text-[11px] text-secondary">{usd(l.usual * l.qty)}</s>}
            <span className="tabular-nums">{usd(l.price * l.qty)}</span>
          </li>
        ))}
      </ul>
      <Primary onClick={onBuy} disabled={!onBuy || buying} className="mt-2">
        {buying ? <LoaderCircle size={14} className="spinner" /> : <ShoppingBasket size={14} />}
        Buy at {screen.store.name} · {usd(screen.total)}
      </Primary>
    </div>
  );
}

/** The one-pager's (and the offline page's) example: last Sunday's numbers from the sandbox stores. */
export const demoScreen: Screen = {
  day: "Sunday",
  lines: [
    { productId: "milk", name: "Whole milk", qty: 1, price: 3.79, promo: false, usual: 4.59 },
    { productId: "bread", name: "Sandwich bread", qty: 1, price: 3.09, promo: false, usual: 3.29 },
    { productId: "coffee", name: "Coffee beans", qty: 2, price: 8.89, promo: false, usual: 11.09 },
    { productId: "cornflakes", name: "Cornflakes", qty: 1, price: 3.89, promo: false, usual: 4.89 },
    { productId: "eggs", name: "Eggs", qty: 1, price: 3.49, promo: false, usual: 3.59 },
    { productId: "yogurt", name: "Greek yogurt", qty: 1, price: 5.29, promo: false, usual: 6.59 },
  ],
  store: { name: "ValueBasket", where: "2.6 mi" },
  total: 37.33,
  usualTotal: 45.13,
  usualName: "Corner Grocery",
  rising: "Coffee's heading up 5%, so I put in a second bag.",
};

const tour = [
  ["Learns your usuals", "From what you've bought and every receipt Lens reads: cornflakes every Sunday, milk twice a week, coffee every other week."],
  ["Prices every store", "This week's price at stores nearby and online, delivery included, against what you pay now."],
  ["Sees prices coming", "Twelve weeks of prices, and where they're heading. If something keeps and it's climbing, Scout buys two."],
  ["Reads a shelf or a list", "Snap a shelf, your fridge or a shopping list: every product, priced everywhere, with live online prices from Channel3."],
] as const;

/** The one-pager's Scout: last Sunday's shop, and what Scout does. */
export function ScoutDemo() {
  return (
    <div className="grid grid-cols-1 items-center justify-items-center gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:justify-items-stretch">
      <Phone width={262} background="var(--color-phone)">
        <ScoutScreen screen={demoScreen} />
      </Phone>
      <ul className="grid w-full gap-3 sm:grid-cols-2">
        {tour.map(([title, text]) => (
          <li key={title}>
            <Tile className="h-full">
              <p className="text-[17px] tracking-tight">{title}</p>
              <p className="mt-1 text-[14px] leading-[1.45] text-secondary">{text}</p>
            </Tile>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- The page --------------------------------------------------------------------------

function screenOf(data: ScoutView, items: Item[], storeId: string): Screen | null {
  const quote = data.basket.quotes.find((q) => q.storeId === storeId);
  const store = data.stores.find((s) => s.id === storeId);
  if (!quote || !store || !items.length) return null;
  const usualQuote = data.basket.quotes.find((q) => q.storeId === data.basket.usualStore);
  const product = (id: string) => data.products.find((p) => p.id === id)!;
  const stocked = items.filter((i) => i.qty > 1).map((i) => product(i.productId));
  return {
    day: dayName(data.today),
    lines: quote.lines.map((l) => ({
      productId: l.productId,
      name: product(l.productId).name,
      qty: l.qty,
      price: l.price,
      promo: l.promo,
      usual: usualQuote?.lines.find((u) => u.productId === l.productId)?.price ?? null,
    })),
    store: { name: store.name, where: store.kind === "online" ? (quote.delivery ? `online, ${usd(quote.delivery)} delivery` : "online, free delivery") : `${store.miles} mi` },
    total: quote.total,
    usualTotal: usualQuote && !usualQuote.missing.length && usualQuote.storeId !== storeId ? usualQuote.total : null,
    usualName: data.stores.find((s) => s.id === data.basket.usualStore)?.name ?? "your usual store",
    rising: stocked.length
      ? `${stocked.map((p) => p.name).join(" and ")} ${stocked.length > 1 ? "are" : "is"} heading up ${pct(stocked[0].forecast.change)}, so I put in a second.`
      : null,
  };
}

function useScout() {
  const [data, setData] = useState<ScoutView | null>(null);
  const load = useCallback(
    () =>
      fetch("/api/scout", { cache: "no-store" })
        .then((res) => (res.ok ? (res.json() as Promise<ScoutView>) : null))
        .then(setData)
        .catch(() => setData(null)),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  return { data, load };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/scout/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out?.error?.message ?? `Flick's backend answered ${res.status}.`);
  return out as T;
}

const firstComplete = (quotes: Quote[]) => quotes.find((q) => !q.missing.length)?.storeId ?? quotes[0]?.storeId ?? "";

export function Scout() {
  const live = useLive();
  const { data } = useScout();
  const [chosen, setChosen] = useState<string>();
  const [selected, setSelected] = useState<string>();
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string>();

  const storeId = chosen ?? (data ? firstComplete(data.basket.quotes) : "");
  const screen = data ? screenOf(data, data.basket.items, storeId) : null;
  const product = data?.products.find((p) => p.id === (selected ?? data.basket.items[0]?.productId ?? "coffee"));

  const buy = async (store: string, items: Item[]) => {
    setBuying(true);
    setError(undefined);
    try {
      const { approveUrl } = await post<{ approveUrl: string }>("buy", { storeId: store, items });
      approveOnPayPal(approveUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBuying(false);
    }
  };

  return (
    <div className="grid grid-cols-1 items-start justify-items-center gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:justify-items-stretch">
      <div className="grid w-full grid-cols-1 justify-items-center gap-2 lg:w-auto">
        <Phone width={262} background="var(--color-phone)">
          {screen ? (
            <ScoutScreen
              screen={screen}
              quotes={data!.basket.quotes}
              stores={data!.stores}
              chosen={storeId}
              onChoose={setChosen}
              buying={buying}
              onBuy={live.mode === "live" ? () => void buy(storeId, data!.basket.items) : undefined}
            />
          ) : data?.products.some((p) => p.usual) ? (
            <p className="px-6 pt-24 text-center text-[13px] text-secondary">Nothing&apos;s due. Scout lists your usuals here the day they are.</p>
          ) : (
            // No usuals of your own yet: last Sunday's example, as a walkthrough.
            <ScoutScreen screen={demoScreen} />
          )}
        </Phone>
        {data && !screen && !data.products.some((p) => p.usual) && (
          <p className="max-w-[262px] text-center text-[12px] leading-4 text-secondary">
            A sample shop: nothing is bought. Snap a shopping list, or a grocery receipt with Lens, and Scout learns your usuals.
          </p>
        )}
        {error && <p className="max-w-[262px] text-center text-[12px] leading-4 text-wait">{error}</p>}
      </div>

      <div className="grid w-full min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
        {data ? (
          <>
            <Tile className="md:col-span-2 !p-3">
              <p className="px-2 pb-2 pt-1 text-[13px] text-secondary">
                This week at {data.stores.length} stores, against what you pay now, and the last 12 weeks. Tap a product for every store, and real online prices.
              </p>
              <Prices data={data} selected={product?.id} onSelect={setSelected} />
            </Tile>
            {product && <Detail data={data} product={product} />}
            <Snap data={data} live={live.mode === "live"} onBuy={buy} buying={buying} />
          </>
        ) : (
          <Tile className="md:col-span-2">
            <p className="text-[13px] text-secondary">
              {live.mode === "loading" ? "Loading this week's prices…" : "Scout needs Flick's backend: this is last Sunday's example."}
            </p>
          </Tile>
        )}
      </div>
    </div>
  );
}

// --- Every product, this week ------------------------------------------------------------

type Row = Product & { best: number; bestStore: string; promo: boolean };

function ProductCell({ data }: ICellRendererParams<Row>) {
  if (!data) return null;
  return (
    <span className="flex h-full items-center gap-2.5 leading-tight">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fill">
        <Icon id={data.id} />
      </span>
      <span className="min-w-0">
        <span className="block truncate">{data.name}</span>
        <span className="block truncate text-[12px] text-secondary">{data.usual ? data.usual.label : data.size}</span>
      </span>
    </span>
  );
}

function BestCell({ data }: ICellRendererParams<Row>) {
  if (!data) return null;
  const paid = data.usual?.last.price;
  return (
    <span className="flex h-full flex-col justify-center leading-tight">
      <span className="tabular-nums">
        {usd(data.best)}
        {paid !== undefined && paid > data.best && <s className="ml-1 text-[12px] text-secondary">{usd(paid)}</s>}
        {data.promo && <span className="ml-1 rounded bg-paid/15 px-1 text-[10px] text-paid">deal</span>}
      </span>
      <span className="truncate text-[12px] text-secondary">{data.bestStore}</span>
    </span>
  );
}

function TrendCell({ data }: ICellRendererParams<Row>) {
  if (!data) return null;
  const { verdict, change } = data.forecast;
  return (
    <span className="flex h-full items-center gap-2 text-[12px]" title={verdict === "steady" ? "Steady" : `${verdict === "rising" ? "Up" : "Down"} ${pct(change)} in the next 4 weeks, if the trend holds`}>
      <Spark values={data.forecast.history} verdict={verdict} width={48} />
      <span className={verdict === "rising" ? "text-wait" : verdict === "falling" ? "text-paid" : "text-secondary"}>
        {verdict === "steady" ? "Steady" : `${verdict === "rising" ? "▲" : "▼"} ${pct(change)}`}
      </span>
    </span>
  );
}

const rank = (p: Product) => (p.usual ? 0 : p.forecast.verdict !== "steady" ? 1 : 2);

function Prices({ data, selected, onSelect }: { data: ScoutView; selected?: string; onSelect: (id: string) => void }) {
  // Your usuals and anything whose price is moving; the rest of the catalog on request.
  const [all, setAll] = useState(false);
  const rows = useMemo<Row[]>(() => {
    const name = (id: string) => data.stores.find((s) => s.id === id)?.name ?? id;
    return data.products
      .filter((p) => all || rank(p) < 2)
      .map((p) => ({ ...p, best: p.offers[0].price, bestStore: name(p.offers[0].storeId), promo: p.offers[0].promo }))
      .sort((a, b) => rank(a) - rank(b));
  }, [data, all]);
  const columns = useMemo<ColDef<Row>[]>(
    () => [
      { field: "name", headerName: "Product", cellRenderer: ProductCell, flex: 1.5, minWidth: 124 },
      { colId: "best", headerName: "Best this week", cellRenderer: BestCell, flex: 1, minWidth: 104, valueGetter: ({ data }) => data?.best },
      { colId: "trend", headerName: "Next 4 weeks", cellRenderer: TrendCell, flex: 0.8, minWidth: 118, valueGetter: ({ data }) => data?.forecast.change },
    ],
    [],
  );
  const hidden = data.products.length - rows.length;
  return (
    <>
      <Grid<Row>
        rowData={rows}
        columnDefs={columns}
        getRowId={({ data }) => data.id}
        rowHeight={56}
        onRowClicked={({ data }) => data && onSelect(data.id)}
        rowClassRules={{ "!bg-fill/50": ({ data }) => data?.id === selected }}
        rowStyle={{ cursor: "pointer" }}
      />
      {(hidden > 0 || all) && (
        <button type="button" onClick={() => setAll(!all)} className="pressable mx-auto mt-2 block cursor-pointer rounded-full bg-raised px-4 py-1.5 text-[12px]">
          {all ? "Just my usuals and what's moving" : `Show all ${data.products.length} products`}
        </button>
      )}
    </>
  );
}

// --- One product, everywhere ---------------------------------------------------------------

type Online = { query: string; offers: { title: string; store: string; price: number; was: number | null; url: string }[] };

function Detail({ data, product }: { data: ScoutView; product: Product }) {
  const [online, setOnline] = useState<{ id: string; result?: Online; error?: string; busy?: boolean }>();
  const shown = online?.id === product.id ? online : undefined;

  const check = async () => {
    setOnline({ id: product.id, busy: true });
    try {
      setOnline({ id: product.id, result: await post<Online>("online", { productId: product.id }) });
    } catch (err) {
      setOnline({ id: product.id, error: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <Tile>
      <p className="flex items-center justify-between gap-2 text-[15px]">
        <span className="flex items-center gap-2">
          <Icon id={product.id} size={18} />
          {product.name} <span className="text-[13px] text-secondary">{product.size}</span>
        </span>
        <span className="text-[12px]">
          <Trend forecast={product.forecast} />
        </span>
      </p>
      {product.stockUp && <p className="mt-1 text-[12px] text-wait">It keeps, and it&apos;s heading up: Scout buys two this week.</p>}
      <ul className="mt-3 divide-y divide-separator/50 text-[13px]">
        {product.offers.map((o) => {
          const store = data.stores.find((s) => s.id === o.storeId)!;
          return (
            <li key={o.storeId} className="flex items-center justify-between gap-2 py-1.5">
              <span className="flex items-center gap-1.5">
                {store.kind === "online" ? <Truck size={13} className="text-secondary" aria-hidden /> : <MapPin size={13} className="text-secondary" aria-hidden />}
                {store.name}
                <span className="text-[11px] text-secondary">{store.kind === "online" ? `online, free over ${usd(store.freeOver ?? 0)}` : `${store.miles} mi`}</span>
              </span>
              <span className="tabular-nums">
                {o.promo && <span className="mr-1 rounded bg-paid/15 px-1 text-[10px] text-paid">15% off</span>}
                {usd(o.price)}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 border-t border-separator/50 pt-3">
        <button
          type="button"
          onClick={() => void check()}
          disabled={!data.config.online || shown?.busy}
          className="pressable flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-ink text-[13px] text-on-ink disabled:cursor-default disabled:opacity-40"
        >
          {shown?.busy ? <LoaderCircle size={14} className="spinner" /> : <Globe size={14} />} Real prices at online stores
        </button>
        {!data.config.online && <p className="mt-1.5 text-center text-[11px] text-secondary">Needs a Channel3 key in the backend (CHANNEL3_API_KEY).</p>}
        {shown?.error && <p className="mt-2 text-[12px] text-wait">{shown.error}</p>}
        {shown?.result && (
          <ul className="mt-2 divide-y divide-separator/50 text-[12px]">
            {shown.result.offers.length === 0 && <li className="py-1.5 text-secondary">No offers in stock right now.</li>}
            {shown.result.offers.map((o) => (
              <li key={o.url} className="flex items-center gap-2 py-1.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{o.title}</span>
                  <span className="text-secondary">{o.store}</span>
                </span>
                <span className="text-right tabular-nums">
                  {o.was && <s className="mr-1 text-secondary">{usd(o.was)}</s>}
                  {usd(o.price)}
                </span>
                <a href={o.url} target="_blank" rel="noopener noreferrer nofollow" aria-label={`Open at ${o.store}`} className="text-secondary hover:text-ink">
                  <ExternalLink size={13} />
                </a>
              </li>
            ))}
            <li className="pt-1.5 text-[11px] text-secondary">Live from Channel3&apos;s product search. Buy these on the store&apos;s own site.</li>
          </ul>
        )}
      </div>
    </Tile>
  );
}

// --- A photo of a shelf, a fridge or a list ------------------------------------------------

type Read = {
  where: string;
  items: { seen: string; qty: number; shelfPrice: number | null; productId: string | null; offers: Product["offers"] }[];
  quotes: Quote[];
};

/** A shopping list, written out, for trying Scout without a photo. */
async function sampleList(): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 760;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#e9e1cf";
  g.fillRect(0, 0, 600, 760);
  g.translate(300, 380);
  g.rotate(-0.03);
  g.fillStyle = "#fffef6";
  g.fillRect(-220, -330, 440, 660);
  g.fillStyle = "#1d3a8a";
  g.font = "38px 'Marker Felt', 'Comic Sans MS', 'Segoe Print', cursive";
  ["Shopping", "– milk", "– cornflakes x2", "– eggs", "– coffee beans", "– bananas", "– olive oil", "– avocados"].forEach((line, i) => g.fillText(line, -180, -250 + i * 72));
  return canvas.toDataURL("image/jpeg", 0.9);
}

function Snap({ data, live, onBuy, buying }: { data: ScoutView; live: boolean; onBuy: (store: string, items: Item[]) => void; buying: boolean }) {
  const [read, setRead] = useState<Read>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // "Try a list" reads a sample list for real, but buying it is a walkthrough: nothing is bought.
  const [sample, setSample] = useState(false);
  const [mockBought, setMockBought] = useState(false);
  const ready = live && data.config.ai;

  const send = async (image: string, isSample = false) => {
    setBusy(true);
    setError(undefined);
    setSample(isSample);
    setMockBought(false);
    try {
      setRead(await post<Read>("read", { image }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const best = read && read.quotes.find((q) => !q.missing.length);
  const store = (id: string) => data.stores.find((s) => s.id === id)!;

  return (
    <Tile>
      <p className="flex items-center gap-1.5 text-[13px] text-secondary">
        <Bot {...agents.scout} size={18} mood={busy ? "speaking" : "idle"} /> Snap a shelf, your fridge, a cart or a list
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className={`pressable flex h-10 items-center justify-center gap-1.5 rounded-full bg-ink text-[13px] text-on-ink ${ready && !busy ? "cursor-pointer" : "pointer-events-none opacity-40"}`}>
          <Camera size={15} /> Snap
          <input type="file" accept="image/*" className="sr-only" disabled={!ready || busy} onChange={(e) => e.target.files?.[0] && void shrink(e.target.files[0]).then((image) => send(image))} />
        </label>
        <button type="button" disabled={!ready || busy} onClick={() => void sampleList().then((image) => send(image, true))} className="pressable h-10 cursor-pointer rounded-full bg-raised text-[13px] disabled:cursor-default disabled:opacity-40">
          Try a list
        </button>
      </div>
      {!ready && <p className="mt-2 text-[12px] text-secondary">Reading photos needs the live backend with AI on.</p>}
      {busy && (
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-secondary">
          <LoaderCircle size={13} className="spinner" /> Scout is reading every product…
        </p>
      )}
      {error && <p className="mt-2 text-[12px] text-wait">{error}</p>}
      {read && !busy && (
        <>
          <ul className="mt-3 divide-y divide-separator/50 text-[12px]">
            {read.items.map((item, i) => {
              const top = item.offers[0];
              return (
                <li key={`${item.seen}-${i}`} className="flex items-center gap-2 py-1.5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-fill">
                    <Icon id={item.productId ?? ""} size={12} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {item.seen}
                      {item.qty > 1 && <span className="text-secondary"> ×{item.qty}</span>}
                    </span>
                    {item.shelfPrice && top && (
                      <span className={item.shelfPrice > top.price ? "text-wait" : "text-paid"}>
                        Here {usd(item.shelfPrice)}
                        {item.shelfPrice > top.price ? `: ${usd(item.shelfPrice - top.price)} less at ${store(top.storeId).name}` : ": a good price"}
                      </span>
                    )}
                  </span>
                  {top ? (
                    <span className="text-right leading-tight">
                      <span className="block tabular-nums">{usd(top.price)}</span>
                      <span className="text-[11px] text-secondary">{store(top.storeId).name}</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-secondary">Not tracked</span>
                  )}
                </li>
              );
            })}
          </ul>
          {best && (
            <Primary
              className="mt-3"
              disabled={buying || mockBought}
              onClick={() => (sample ? setMockBought(true) : onBuy(best.storeId, best.lines.map((l) => ({ productId: l.productId, qty: l.qty }))))}
            >
              <ShoppingBasket size={14} /> Buy {best.lines.length} at {store(best.storeId).name} · {usd(best.total)}
            </Primary>
          )}
          {mockBought && (
            <p className="rise mt-1.5 text-center text-[12px] leading-4 text-paid">A sample list, so nothing is bought. Snap your own list, and Scout buys it through PayPal.</p>
          )}
          {best && read.items.some((i) => !i.productId) && (
            <p className="mt-1.5 text-center text-[11px] text-secondary">
              Without {read.items.filter((i) => !i.productId).map((i) => i.seen.toLowerCase()).join(", ")}, which Scout doesn&apos;t track yet.
            </p>
          )}
        </>
      )}
    </Tile>
  );
}
