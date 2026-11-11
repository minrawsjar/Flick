"use client";

import type { Debt, Scan } from "@backend/model";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import type { CustomHeaderProps } from "ag-grid-react";
import { ArrowUpRight, Check, CircleCheck, Equal, LoaderCircle, MessageCircle, Plus, ScanLine, Sparkles, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Bot, type BotColor, type BotShape } from "@/components/bot";
import { Grid } from "@/components/grid";
import { Phone } from "@/components/phone";
import { Activity, Bubble, Primary, Speaking, Tile } from "@/components/ui";
import { money, usd } from "@/lib/format";
import { act, useLive } from "@/lib/live";
import { agents, friends as demoFriends, receipt, TAX, TIP, you, type Friend, type Item } from "./data";

// Splitter: tick who had what on the receipt (or split it evenly). Each item is shared equally by
// the people who had it, and tax and tip follow in proportion. Live, the people are your real
// friends (/friends) and the receipt can be one Lens just read: a friend on Flick gets their share
// in Flick Chat, with the receipt's photo, to pay with a flick (or by itself, if they allow it);
// anyone else gets a real (sandbox) PayPal invoice. Your splits list who has paid.

const cents = (n: number) => Math.round(n * 100) / 100;
const names = (list: { name: string }[]) =>
  list.length <= 1 ? (list[0]?.name ?? "nobody") : `${list.slice(0, -1).map((p) => p.name).join(", ")} and ${list.at(-1)!.name}`;

/** `converted`: the receipt wasn't in USD; Lens converted it, as PayPal requests are in USD here. */
type Bill = { merchant: string; items: Item[]; tax: number; tip: number; scanned: boolean; converted?: string; scanId?: string };

const demoSubtotal = receipt.reduce((sum, i) => sum + i.price, 0);
const demoBill: Bill = { merchant: "Nori Sushi", items: receipt, tax: cents(demoSubtotal * TAX), tip: cents(demoSubtotal * TIP), scanned: false };
/** No receipt from Lens: a bill you fill in yourself, item by item. */
const emptyBill: Bill = { merchant: "", items: [], tax: 0, tip: 0, scanned: false };

/** A receipt Lens read: everyone starts with a tick on every item. */
const billFrom = (scan: Scan, people: Friend[]): Bill => ({
  merchant: scan.title,
  items: scan.items.map((item, i) => ({ id: `item${i}`, name: item.name, price: item.price, ...Object.fromEntries(people.map((p) => [p.id, true])) })),
  tax: scan.tax,
  tip: scan.tip,
  scanned: true,
  scanId: scan.id,
  ...(scan.original && { converted: `${money(scan.original.amount, scan.original.currency)} on the receipt, in USD at today's rate` }),
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

/** sent: a PayPal invoice; chat: asked in Flick Chat; paid: in the chat, and it paid by itself. */
type Sending = Record<string, "sending" | "sent" | "chat" | "paid" | "failed">;
const gone = (s: Sending[string] | undefined) => s === "sent" || s === "chat" || s === "paid";

/** Splitter on the phone: the shares, and the requests going out. */
/** `busy`: the shares are about to change (the AI is ticking the grid), so sending waits. */
function SplitScreen({ merchant, people, each, total, nobody, status, onSend, busy = false, empty = false }: { merchant: string; people: Friend[]; each: Record<string, number>; total: number; nobody: Item[]; empty?: boolean; status: Sending; onSend: () => void; busy?: boolean }) {
  const friends = people.filter((p) => p.id !== "you");
  const asked = friends.filter((f) => each[f.id] > 0);
  const sent = asked.filter((f) => gone(status[f.id]));
  const inChat = asked.filter((f) => status[f.id] === "chat" || status[f.id] === "paid");
  const started = Object.keys(status).length > 0;
  const finished = started && asked.every((f) => gone(status[f.id]) || status[f.id] === "failed");
  return (
    <div className="flex h-full flex-col bg-page">
      <Speaking agent={agents.splitter} label="Splitter" />
      <div className="flex flex-1 flex-col justify-end gap-2 overflow-hidden px-3">
        <Bubble from="you">
          Split {merchant || "a bill"}
          {friends.length ? ` with ${names(friends)}` : ""}.
        </Bubble>
        <Bubble from="agent">
          {!friends.length
            ? "Add a friend first, with their PayPal email."
            : empty
              ? "Snap the receipt with Lens, or add what was on the bill."
              : nobody.length
              ? `Nobody has the ${nobody.map((i) => i.name.toLowerCase()).join(" or ")} yet. Tick who had it.`
              : `${usd(total)} with tax and tip. Here's each share:`}
        </Bubble>
        <div className="max-h-[150px] divide-y divide-separator/50 overflow-y-auto rounded-card bg-fill/50 px-2.5">
          {friends.map((f) => (
            <div key={f.id} className="flex items-center gap-2 py-1.5 text-[13px]">
              <Bot {...f} size={24} mood={gone(status[f.id]) ? "awake" : "idle"} />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="tabular-nums">{usd(each[f.id] ?? 0)}</span>
              <span className="flex w-12 justify-end text-[11px]">
                {status[f.id] === "sent" ? (
                  <span className="rise flex items-center gap-0.5 text-paid">
                    <Check size={11} strokeWidth={2.5} /> Sent
                  </span>
                ) : status[f.id] === "chat" ? (
                  <span className="rise flex items-center gap-0.5 text-paid">
                    <MessageCircle size={11} strokeWidth={2.5} /> Chat
                  </span>
                ) : status[f.id] === "paid" ? (
                  <span className="rise flex items-center gap-0.5 text-paid">
                    <CircleCheck size={11} strokeWidth={2.5} /> Paid
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
            {inChat.length ? `Asked ${inChat.length} in Flick Chat${sent.length > inChat.length ? `, ${sent.length - inChat.length} by invoice` : ""}` : `Sent ${sent.length} PayPal ${sent.length === 1 ? "invoice" : "invoices"}`} · you paid {usd(each.you)}
          </Activity>
        )}
      </div>
      <div className="px-3 pb-5 pt-2">
        <Primary onClick={onSend} disabled={nobody.length > 0 || started || !asked.length || busy}>
          {finished ? "Requests sent" : `Send ${asked.length} PayPal ${asked.length === 1 ? "request" : "requests"}`}
        </Primary>
      </div>
    </div>
  );
}

/** `sample`: a live page with no friends of your own yet, so this is a walkthrough with sample friends. */
function SplitBill({ bill, live, people }: { bill: Bill; live: boolean; people: Friend[] }) {
  const [items, setItems] = useState(bill.items);
  // A bill without a receipt: what it was, and the item being added.
  const [what, setWhat] = useState("");
  const [adding, setAdding] = useState({ name: "", price: "" });
  const merchant = bill.merchant || what.trim() || "A shared bill";
  const manual = live && !bill.scanned;
  const addItem = () => {
    const price = Number(adding.price);
    if (!adding.name.trim() || !(price > 0)) return;
    setItems((all) => [...all, { id: `item${Date.now()}`, name: adding.name.trim(), price: cents(price), ...Object.fromEntries(people.map((p) => [p.id, true])) }]);
    setAdding({ name: "", price: "" });
    fresh();
  };
  const [status, setStatus] = useState<Sending>({});
  const [links, setLinks] = useState<{ name: string; url?: string; amount: number; chat?: string; paid?: boolean }[]>([]);
  const [error, setError] = useState<string>();
  const [said, setSaid] = useState("");
  const [assigning, setAssigning] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { each, nobody, total } = shares(items, bill.tax, bill.tip, people);
  const columns = useMemo(() => columnsFor(people), [people]);

  // A changed share cancels requests still going out (demo), and starts a fresh split.
  const fresh = () => {
    timers.current.forEach(clearTimeout);
    setStatus({});
    setLinks([]);
  };
  const context = useMemo(
    () => ({
      toggle: ((id, person) => {
        setItems((all) => all.map((item) => (item.id === id ? { ...item, [person]: !had(item, person) } : item)));
        fresh();
      }) satisfies Toggle,
    }),
    [],
  );
  /** Everyone had everything (or, `on` false, nobody: tick from scratch). */
  const tickAll = (on: boolean) => {
    setItems((all) => all.map((item) => ({ ...item, ...Object.fromEntries(people.map((p) => [p.id, on])) })));
    fresh();
  };

  const asked = people.filter((p) => p.id !== "you" && each[p.id] > 0);

  // "Maya and I shared the salmon, we all had tea": the AI model ticks the grid from a sentence.
  const tickFromWords = async () => {
    setAssigning(true);
    setError(undefined);
    try {
      const { assignments } = await act<{ assignments: { item: number; people: string[] }[] }>("split/assign", {
        items: items.map((i) => ({ name: i.name, price: i.price })),
        people: people.map((p) => ({ id: p.id, name: p.name })),
        text: said,
      });
      setItems((all) =>
        all.map((item, i) => {
          const found = assignments.find((a) => a.item === i);
          return found ? { ...item, ...Object.fromEntries(people.map((p) => [p.id, found.people.includes(p.id)])) } : item;
        }),
      );
      fresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAssigning(false);
    }
  };

  const send = async () => {
    // Real invoices go out with the shares on screen: never the ones the AI is about to replace.
    if (assigning) return;
    setError(undefined);
    setStatus(Object.fromEntries(asked.map((f) => [f.id, "sending"])));
    if (!live) {
      timers.current = asked.map((f, i) => setTimeout(() => setStatus((s) => ({ ...s, [f.id]: "sent" })), 500 + i * 550));
      return;
    }
    try {
      const result = await act<{ debts: Debt[]; failed: { friendId: string; error: string }[] }>("split", {
        merchant,
        items: items.map((i) => ({ name: i.name, price: i.price, people: people.filter((p) => had(i, p.id)).map((p) => p.id) })),
        tax: bill.tax,
        tip: bill.tip,
        ...(bill.scanId && { scanId: bill.scanId }),
      });
      setStatus(Object.fromEntries([...result.debts.map((d) => [d.friendId, d.chat ? (d.status === "paid" ? "paid" : "chat") : "sent"]), ...result.failed.map((f) => [f.friendId, "failed"])]));
      setLinks(result.debts.map((d) => ({ name: people.find((p) => p.id === d.friendId)?.name ?? d.friendId, url: d.payerUrl, amount: d.amount, chat: d.chat?.with, paid: d.status === "paid" })));
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
              {bill.scanned ? `${bill.merchant}, as Lens read it${bill.converted ? ` (${bill.converted})` : ""}. Tick who had what; the shares update as you go.` : "Who had what. Tap to tick; the shares update as you go."}
            </p>
            <span className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => tickAll(true)} className="pressable flex cursor-pointer items-center gap-1 rounded-full bg-raised px-3 py-1 text-[12px]">
                <Equal size={13} /> Split evenly
              </button>
              <button type="button" onClick={() => tickAll(false)} className="pressable cursor-pointer rounded-full bg-raised px-3 py-1 text-[12px]">
                Clear ticks
              </button>
              {live && (
                <Link href="/friends" className="pressable flex items-center gap-1 rounded-full bg-raised px-3 py-1 text-[12px]">
                  <UserPlus size={13} /> Add friends
                </Link>
              )}
            </span>
          </div>
          {live && people.length < 2 && (
            <p className="mb-3 text-[12px] leading-4 text-secondary">
              No friends yet. Add one by their PayPal email, and they get their share in Flick Chat, or as a PayPal invoice.
            </p>
          )}
          {live && items.length > 0 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void tickFromWords();
              }}
              className="mb-3 flex gap-2"
            >
              <input
                value={said}
                onChange={(e) => setSaid(e.target.value)}
                placeholder="Or just say it: Maya and I shared the salmon, Leo had the miso, we all had tea…"
                maxLength={600}
                aria-label="Who had what, in your words"
                className="h-10 min-w-0 flex-1 rounded-full bg-raised px-4 text-[14px] outline-none ring-1 ring-separator/60 focus:ring-2 focus:ring-ink"
              />
              <button type="submit" disabled={assigning || !said.trim()} className="pressable flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] text-on-ink disabled:opacity-40">
                {assigning ? <LoaderCircle size={14} className="spinner" /> : <Sparkles size={14} />} Tick it for me
              </button>
            </form>
          )}
          {items.length > 0 ? (
            <Grid<Item> rowData={items} columnDefs={columns} getRowId={({ data }) => data.id} pinnedBottomRowData={totals} context={context} headerHeight={52} />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-raised px-6 py-8 text-center">
              <p className="max-w-md text-[14px] leading-[1.45] text-secondary">Nothing to split yet. Snap the receipt with Lens and it lands here, item by item, or add what was on the bill below.</p>
              <Link href="/lens" className="pressable flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[14px] text-on-ink">
                <ScanLine size={15} /> Snap a receipt
              </Link>
            </div>
          )}
          {manual && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addItem();
              }}
              className="mt-3 flex flex-wrap gap-2"
            >
              {items.length === 0 && (
                <input
                  value={what}
                  onChange={(e) => setWhat(e.target.value)}
                  placeholder="What was it? Dinner at Nori"
                  maxLength={80}
                  aria-label="What the bill was for"
                  className="h-10 w-full rounded-full bg-raised px-4 text-[14px] outline-none ring-1 ring-separator/60 focus:ring-2 focus:ring-ink"
                />
              )}
              <input
                value={adding.name}
                onChange={(e) => setAdding((a) => ({ ...a, name: e.target.value }))}
                placeholder="An item: Pizza"
                maxLength={80}
                aria-label="Item"
                className="h-10 min-w-0 flex-1 rounded-full bg-raised px-4 text-[14px] outline-none ring-1 ring-separator/60 focus:ring-2 focus:ring-ink"
              />
              <input
                value={adding.price}
                onChange={(e) => setAdding((a) => ({ ...a, price: e.target.value }))}
                placeholder="Price"
                inputMode="decimal"
                aria-label="Price"
                className="h-10 w-24 rounded-full bg-raised px-4 text-[14px] tabular-nums outline-none ring-1 ring-separator/60 focus:ring-2 focus:ring-ink"
              />
              <button type="submit" disabled={!adding.name.trim() || !(Number(adding.price) > 0)} className="pressable flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] text-on-ink disabled:opacity-40">
                <Plus size={14} /> Add
              </button>
            </form>
          )}
          {error && <p className="mt-2 text-[12px] text-wait">{error}</p>}
          {links.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {links.map((l) =>
                l.chat ? (
                  <Link key={l.name} href={`/chat?with=${encodeURIComponent(l.chat)}`} className="pressable flex items-center gap-1 rounded-full bg-raised px-3 py-1 text-[12px]">
                    {l.paid ? <CircleCheck size={12} className="text-paid" /> : <MessageCircle size={12} />} {l.name}
                    {l.paid ? ` paid ${usd(l.amount)}, by itself` : `, ${usd(l.amount)} in Flick Chat`}
                  </Link>
                ) : l.url ? (
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
        {live && <YourSplits />}
        <Tile className="grid gap-4 sm:grid-cols-3">
          {[
            ["Shared fairly", "Each item splits between whoever had it. Tax and tip follow each person's share."],
            ["Paid with PayPal", live ? "A friend on Flick gets their share in Flick Chat and pays it with a flick. Anyone else gets a real PayPal sandbox invoice at their PayPal email." : "A friend on Flick pays their share in Flick Chat with a flick; anyone else gets a PayPal invoice."],
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
          <SplitScreen merchant={live ? (bill.merchant || what.trim()) : bill.merchant} people={people} each={each} total={total} nobody={nobody} status={status} onSend={() => void send()} busy={assigning} empty={!items.length} />
        </Phone>
      </div>
    </div>
  );
}

/** The splits you've sent, newest first: each friend's share, and whether they've paid it. */
function YourSplits() {
  const state = useLive().state;
  const groups = useMemo(() => {
    const by = new Map<string, Debt[]>();
    // Older requests have no split id: the same bill asked for in the same minute is one split.
    for (const d of state?.debts ?? []) {
      const key = d.split ?? `${d.what}|${d.createdAt.slice(0, 16)}`;
      by.set(key, [...(by.get(key) ?? []), d]);
    }
    return [...by.values()].slice(0, 5);
  }, [state?.debts]);
  if (!state || !groups.length) return null;
  const friendOf = (id: string) => state.friends.find((f) => f.id === id);
  return (
    <Tile>
      <p className="text-[13px] text-secondary">Your splits and requests</p>
      <ul className="mt-2 divide-y divide-separator/50">
        {groups.map((debts) => {
          const paid = debts.filter((d) => d.status === "paid");
          const asked = debts.filter((d) => d.status !== "cancelled");
          return (
            <li key={debts[0].id} className="py-2.5">
              <div className="flex items-baseline justify-between gap-3 text-[14px]">
                <span className="min-w-0 truncate">
                  {debts[0].what} <span className="text-[12px] text-secondary">· {new Date(debts[0].createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-secondary">
                  {usd(paid.reduce((s, d) => s + d.amount, 0))} of {usd(asked.reduce((s, d) => s + d.amount, 0))} back
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {debts.map((d) => {
                  const f = friendOf(d.friendId);
                  const tone = d.status === "paid" ? "bg-paid/15 text-paid" : d.status === "cancelled" ? "bg-fill text-secondary" : "bg-wait/15 text-wait";
                  const word = d.status === "paid" ? "paid" : d.status === "cancelled" ? "turned down" : d.chat ? "waiting in chat" : "waiting";
                  const chip = (
                    <>
                      {f && <Bot color={f.color as BotColor} shape={f.shape as BotShape} size={16} />}
                      {f?.name ?? "A friend"} {usd(d.amount)}, {word}
                    </>
                  );
                  const className = `flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] ${tone}`;
                  return d.status === "requested" ? (
                    <Link key={d.id} href={d.chat ? `/chat?with=${encodeURIComponent(d.chat.with)}` : "/nudge"} className={`pressable ${className}`}>
                      {chip}
                    </Link>
                  ) : (
                    <span key={d.id} className={className}>
                      {chip}
                    </span>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </Tile>
  );
}

export function Split() {
  const live = useLive();
  // Your own friends and bills, even none yet. The sample bill and friends are the one-pager's, or
  // the fallback when the backend is out of reach.
  const demo = live.mode === "demo";
  const friends = live.state?.friends;
  const people = useMemo<Friend[]>(
    () => [you, ...(demo ? demoFriends : (friends ?? []).map((f) => ({ id: f.id, name: f.name, color: f.color as BotColor, shape: f.shape as BotShape })))],
    [demo, friends],
  );
  const bill = live.receipt ? billFrom(live.receipt, people) : demo ? demoBill : emptyBill;
  // A new receipt from Lens, or a change of friends, starts a fresh split.
  return <SplitBill key={`${live.receipt?.id ?? (demo ? "demo" : "own")}|${people.map((p) => p.id).join(",")}`} bill={bill} live={live.mode === "live"} people={people} />;
}
