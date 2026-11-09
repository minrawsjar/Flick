"use client";

import type { Debt, Scan } from "@backend/model";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import type { CustomHeaderProps } from "ag-grid-react";
import { ArrowUpRight, Check, LoaderCircle, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Bot, type BotColor, type BotShape } from "@/components/bot";
import { Grid } from "@/components/grid";
import { Phone } from "@/components/phone";
import { Activity, Bubble, Primary, Speaking, Tile } from "@/components/ui";
import { usd } from "@/lib/format";
import { act, useLive } from "@/lib/live";
import { agents, friends as demoFriends, receipt, TAX, TIP, you, type Friend, type Item } from "./data";

// Splitter: tick who had what on the receipt. Each item is shared equally by the people who had
// it, and tax and tip follow in proportion. Friends get a PayPal invoice for their share. Live,
// the people are your real friends (/friends), the receipt can be one Lens just read, and the
// invoices are real (sandbox) PayPal invoices.

const cents = (n: number) => Math.round(n * 100) / 100;
const names = (list: { name: string }[]) =>
  list.length <= 1 ? (list[0]?.name ?? "nobody") : `${list.slice(0, -1).map((p) => p.name).join(", ")} and ${list.at(-1)!.name}`;

type Bill = { merchant: string; items: Item[]; tax: number; tip: number; scanned: boolean };

const demoSubtotal = receipt.reduce((sum, i) => sum + i.price, 0);
const demoBill: Bill = { merchant: "Nori Sushi", items: receipt, tax: cents(demoSubtotal * TAX), tip: cents(demoSubtotal * TIP), scanned: false };

/** A receipt Lens read: everyone starts with a tick on every item. */
const billFrom = (scan: Scan, people: Friend[]): Bill => ({
  merchant: scan.title,
  items: scan.items.map((item, i) => ({ id: `item${i}`, name: item.name, price: item.price, ...Object.fromEntries(people.map((p) => [p.id, true])) })),
  tax: scan.tax,
  tip: scan.tip,
  scanned: true,
});

const had = (item: Item, person: string) => item[person] === true;

/** Who owes what, the same way the backend works it out (backend/src/rules.ts): you take the rounding. */
function shares(items: Item[], tax: number, tip: number, people: Friend[]) {
  const nobody = items.filter((item) => !people.some((p) => had(item, p.id)));
  const subtotal = items.filter((item) => !nobody.includes(item)).reduce((sum, item) => sum + item.price, 0);
  const total = cents(subtotal + tax + tip);
  const raw: Record<string, number> = Object.fromEntries(people.map((p) => [p.id, 0]));
  for (const item of items) {
    const who = people.filter((p) => had(item, p.id));
    for (const p of who) raw[p.id] += item.price / who.length;
  }
  const each: Record<string, number> = {};
  for (const p of people) if (p.id !== "you") each[p.id] = subtotal ? cents((raw[p.id] * total) / subtotal) : 0;
  each.you = cents(total - Object.values(each).reduce((a, b) => a + b, 0));
  return { each, nobody, total };
}

function FaceHeader({ displayName, face }: CustomHeaderProps & { face: Friend }) {
  return (
    <span className="flex w-full flex-col items-center gap-0.5 text-[11px]">
      <Bot {...face} size={20} />
      <span className="max-w-full truncate">{displayName}</span>
    </span>
  );
}

type Toggle = (id: string, person: string) => void;

/** A round tick for each item, or the person's share on the pinned totals row. */
function TickCell({ value, node, data, colDef, context }: ICellRendererParams<Item, boolean | number, { toggle: Toggle }>) {
  if (node.rowPinned) return <span className="flex h-full items-center justify-center tabular-nums">{usd(Number(value ?? 0))}</span>;
  const person = colDef!.colId!;
  return (
    <span className="flex h-full items-center justify-center">
      <button
        type="button"
        role="checkbox"
        aria-checked={Boolean(value)}
        aria-label={`${colDef!.headerName} had ${data?.name}`}
        onClick={() => context.toggle(data!.id, person)}
        className={`pressable flex size-7 cursor-pointer items-center justify-center rounded-full transition-colors ${value ? "bg-ink text-on-ink" : "border-[1.5px] border-separator"}`}
      >
        {value && <Check size={14} strokeWidth={2.5} />}
      </button>
    </span>
  );
}

const columnsFor = (people: Friend[]): ColDef<Item>[] => [
  { field: "name", headerName: "Item", flex: 1, minWidth: 130, cellClass: ({ node }) => (node.rowPinned ? "font-medium" : "") },
  { field: "price", headerName: "Price", width: 84, type: "rightAligned", valueFormatter: ({ value }) => usd(Number(value ?? 0)), cellClass: "tabular-nums" },
  ...people.map(
    (p): ColDef<Item> => ({
      colId: p.id,
      headerName: p.name,
      width: 76,
      headerComponent: FaceHeader,
      headerComponentParams: { face: p },
      valueGetter: ({ data }) => data?.[p.id],
      cellRenderer: TickCell,
    }),
  ),
];

type Sending = Record<string, "sending" | "sent" | "failed">;

/** Splitter on the phone: the shares, and the requests going out. */
function SplitScreen({ merchant, people, each, total, nobody, status, onSend }: { merchant: string; people: Friend[]; each: Record<string, number>; total: number; nobody: Item[]; status: Sending; onSend: () => void }) {
  const friends = people.filter((p) => p.id !== "you");
  const asked = friends.filter((f) => each[f.id] > 0);
  const sent = asked.filter((f) => status[f.id] === "sent");
  const started = Object.keys(status).length > 0;
  const finished = started && asked.every((f) => status[f.id] === "sent" || status[f.id] === "failed");
  return (
    <div className="flex h-full flex-col bg-page">
      <Speaking agent={agents.splitter} label="Splitter" />
      <div className="flex flex-1 flex-col justify-end gap-2 overflow-hidden px-3">
        <Bubble from="you">
          Split {merchant} with {names(friends)}.
        </Bubble>
        <Bubble from="agent">
          {!friends.length
            ? "Add a friend first, with their PayPal email."
            : nobody.length
              ? `Nobody has the ${nobody.map((i) => i.name.toLowerCase()).join(" or ")} yet. Tick who had it.`
              : `${usd(total)} with tax and tip. Here's each share:`}
        </Bubble>
        <div className="max-h-[150px] divide-y divide-separator/50 overflow-y-auto rounded-card bg-fill/50 px-2.5">
          {friends.map((f) => (
            <div key={f.id} className="flex items-center gap-2 py-1.5 text-[13px]">
              <Bot {...f} size={24} mood={status[f.id] === "sent" ? "awake" : "idle"} />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="tabular-nums">{usd(each[f.id] ?? 0)}</span>
              <span className="flex w-12 justify-end text-[11px]">
                {status[f.id] === "sent" ? (
                  <span className="rise flex items-center gap-0.5 text-paid">
                    <Check size={11} strokeWidth={2.5} /> Sent
                  </span>
                ) : status[f.id] === "failed" ? (
                  <span className="flex items-center gap-0.5 text-danger">
                    <X size={11} strokeWidth={2.5} /> Failed
                  </span>
                ) : status[f.id] === "sending" ? (
                  <LoaderCircle size={12} className="spinner text-secondary" />
                ) : null}
              </span>
            </div>
          ))}
        </div>
        {finished && sent.length > 0 && (
          <Activity>
            Sent {sent.length} PayPal {sent.length === 1 ? "invoice" : "invoices"} · you paid {usd(each.you)}
          </Activity>
        )}
      </div>
      <div className="px-3 pb-5 pt-2">
        <Primary onClick={onSend} disabled={nobody.length > 0 || started || !asked.length}>
          {finished ? "Requests sent" : `Send ${asked.length} PayPal ${asked.length === 1 ? "request" : "requests"}`}
        </Primary>
      </div>
    </div>
  );
}

function SplitBill({ bill, live, people }: { bill: Bill; live: boolean; people: Friend[] }) {
  const [items, setItems] = useState(bill.items);
  const [status, setStatus] = useState<Sending>({});
  const [links, setLinks] = useState<{ name: string; url?: string; amount: number }[]>([]);
  const [error, setError] = useState<string>();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { each, nobody, total } = shares(items, bill.tax, bill.tip, people);
  const columns = useMemo(() => columnsFor(people), [people]);

  const context = useMemo(
    () => ({
      toggle: ((id, person) => {
        setItems((all) => all.map((item) => (item.id === id ? { ...item, [person]: !had(item, person) } : item)));
        // A changed share cancels requests still going out (demo), and starts a fresh split.
        timers.current.forEach(clearTimeout);
        setStatus({});
        setLinks([]);
      }) satisfies Toggle,
    }),
    [],
  );

  const asked = people.filter((p) => p.id !== "you" && each[p.id] > 0);

  const send = async () => {
    setError(undefined);
    setStatus(Object.fromEntries(asked.map((f) => [f.id, "sending"])));
    if (!live) {
      timers.current = asked.map((f, i) => setTimeout(() => setStatus((s) => ({ ...s, [f.id]: "sent" })), 500 + i * 550));
      return;
    }
    try {
      const result = await act<{ debts: Debt[]; failed: { friendId: string; error: string }[] }>("split", {
        merchant: bill.merchant,
        items: items.map((i) => ({ name: i.name, price: i.price, people: people.filter((p) => had(i, p.id)).map((p) => p.id) })),
        tax: bill.tax,
        tip: bill.tip,
      });
      setStatus(Object.fromEntries([...result.debts.map((d) => [d.friendId, "sent"]), ...result.failed.map((f) => [f.friendId, "failed"])]));
      setLinks(result.debts.map((d) => ({ name: people.find((p) => p.id === d.friendId)?.name ?? d.friendId, url: d.payerUrl, amount: d.amount })));
      if (result.failed.length) setError(result.failed[0].error);
    } catch (err) {
      setStatus({});
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const totals = useMemo(() => [{ id: "total", name: "Each pays", price: total, ...each }] as Item[], [total, each]);

  return (
    <div className="grid items-center justify-items-center gap-6 lg:grid-cols-[1fr_auto] lg:justify-items-stretch">
      <div className="order-2 grid w-full min-w-0 gap-3 lg:order-1">
        <Tile>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-secondary">
              {bill.scanned ? `${bill.merchant}, as Lens read it. Tick who had what; the shares update as you go.` : "Who had what. Tap to tick; the shares update as you go."}
            </p>
            {live && (
              <Link href="/friends" className="pressable flex items-center gap-1 rounded-full bg-raised px-3 py-1 text-[12px]">
                <UserPlus size={13} /> Add friends
              </Link>
            )}
          </div>
          <Grid<Item> rowData={items} columnDefs={columns} getRowId={({ data }) => data.id} pinnedBottomRowData={totals} context={context} headerHeight={52} />
          {error && <p className="mt-2 text-[12px] text-wait">{error}</p>}
          {links.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {links.map((l) =>
                l.url ? (
                  <a key={l.name} href={l.url} target="_blank" rel="noreferrer" className="pressable flex items-center gap-1 rounded-full bg-raised px-3 py-1 text-[12px]">
                    {l.name}&apos;s invoice, {usd(l.amount)} <ArrowUpRight size={12} />
                  </a>
                ) : (
                  <span key={l.name} className="rounded-full bg-raised px-3 py-1 text-[12px]">
                    {l.name}: invoice sent, {usd(l.amount)}
                  </span>
                ),
              )}
            </div>
          )}
        </Tile>
        <Tile className="grid gap-4 sm:grid-cols-3">
          {[
            ["Shared fairly", "Each item splits between whoever had it. Tax and tip follow each person's share."],
            ["Paid with PayPal", live ? "Every friend gets a real PayPal sandbox invoice at their PayPal email, payable with PayPal or a card." : "Every friend gets an invoice they can pay with PayPal or a card."],
            ["Followed up", "Anyone who hasn't paid is handed to Nudge after a few days."],
          ].map(([title, text]) => (
            <div key={title}>
              <p className="text-[15px]">{title}</p>
              <p className="mt-1 text-[13px] leading-5 text-secondary">{text}</p>
            </div>
          ))}
        </Tile>
      </div>
      <div className="order-1 lg:order-2">
        <Phone width={262} background="var(--color-page)">
          <SplitScreen merchant={bill.merchant} people={people} each={each} total={total} nobody={nobody} status={status} onSend={() => void send()} />
        </Phone>
      </div>
    </div>
  );
}

export function Split() {
  const live = useLive();
  const state = live.mode === "live" ? live.state : null;
  const people = useMemo<Friend[]>(
    () => [you, ...(state ? state.friends.map((f) => ({ id: f.id, name: f.name, color: f.color as BotColor, shape: f.shape as BotShape })) : demoFriends)],
    [state],
  );
  const bill = live.receipt ? billFrom(live.receipt, people) : demoBill;
  // A new receipt from Lens, or a change of friends, starts a fresh split.
  return <SplitBill key={`${live.receipt?.id ?? "demo"}|${people.map((p) => p.id).join(",")}`} bill={bill} live={live.mode === "live"} people={people} />;
}
