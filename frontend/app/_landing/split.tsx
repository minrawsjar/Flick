"use client";

import type { ColDef, ICellRendererParams } from "ag-grid-community";
import type { CustomHeaderProps } from "ag-grid-react";
import { Check, LoaderCircle } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Bot } from "@/components/bot";
import { Grid } from "@/components/grid";
import { Phone } from "@/components/phone";
import { Activity, Bubble, Primary, Speaking, Tile } from "@/components/ui";
import { usd } from "@/lib/format";
import { agents, friends, receipt, TAX, TIP, you, type Friend, type Item } from "./data";

// Splitter: tick who had what on the receipt. Each item is shared equally by the people who
// had it, and tax and tip follow in proportion. Friends get a PayPal invoice for their share.

type Person = Friend["id"];
const people = [you, ...friends];

function split(items: Item[]) {
  const each = { you: 0, maya: 0, leo: 0, priya: 0 } satisfies Record<Person, number>;
  const nobody: Item[] = [];
  for (const item of items) {
    const who = people.filter((p) => item[p.id]);
    if (!who.length) nobody.push(item);
    for (const p of who) each[p.id] += (item.price / who.length) * (1 + TAX + TIP);
  }
  return { each, nobody };
}

function FaceHeader({ displayName, face }: CustomHeaderProps & { face: Friend }) {
  return (
    <span className="flex w-full flex-col items-center gap-0.5 text-[11px]">
      <Bot {...face} size={20} />
      {displayName}
    </span>
  );
}

type Toggle = (id: string, person: Person) => void;

/** A round tick for each item, or the person's share on the pinned totals row. */
function TickCell({ value, node, data, colDef, context }: ICellRendererParams<Item, boolean | number, { toggle: Toggle }>) {
  if (node.rowPinned) return <span className="flex h-full items-center justify-center tabular-nums">{usd(Number(value))}</span>;
  const person = colDef!.field as Person;
  return (
    <span className="flex h-full items-center justify-center">
      <button
        type="button"
        role="checkbox"
        aria-checked={Boolean(value)}
        aria-label={`${person} had ${data?.name}`}
        onClick={() => context.toggle(data!.id, person)}
        className={`pressable flex size-7 cursor-pointer items-center justify-center rounded-full transition-colors ${value ? "bg-ink text-on-ink" : "border-[1.5px] border-separator"}`}
      >
        {value && <Check size={14} strokeWidth={2.5} />}
      </button>
    </span>
  );
}

const columns: ColDef<Item>[] = [
  { field: "name", headerName: "Item", flex: 1, minWidth: 130, cellClass: ({ node }) => (node.rowPinned ? "font-medium" : "") },
  { field: "price", headerName: "Price", width: 84, type: "rightAligned", valueFormatter: ({ value }) => usd(value ?? 0), cellClass: "tabular-nums" },
  ...people.map(
    (p): ColDef<Item> => ({
      field: p.id,
      headerName: p.name,
      width: 76,
      headerComponent: FaceHeader,
      headerComponentParams: { face: p },
      cellRenderer: TickCell,
    }),
  ),
];

/** Splitter on the phone: the shares, and the requests going out. */
function SplitScreen({ each, nobody, sent, onSend }: { each: Record<Person, number>; nobody: Item[]; sent: number; onSend: () => void }) {
  const total = Object.values(each).reduce((a, b) => a + b, 0);
  return (
    <div className="flex h-full flex-col bg-page">
      <Speaking agent={agents.splitter} label="Splitter" />
      <div className="flex flex-1 flex-col justify-end gap-2 overflow-hidden px-3">
        <Bubble from="you">Split Nori Sushi with Maya, Leo and Priya.</Bubble>
        <Bubble from="agent">
          {nobody.length
            ? `Nobody has the ${nobody.map((i) => i.name.toLowerCase()).join(" or ")} yet. Tick who had it.`
            : `${usd(total)} with tax and an 18% tip. Here's each share:`}
        </Bubble>
        <div className="divide-y divide-separator/50 rounded-card bg-fill/50 px-2.5">
          {friends.map((f, i) => (
            <div key={f.id} className="flex items-center gap-2 py-1.5 text-[13px]">
              <Bot {...f} size={24} mood={sent > i ? "awake" : "idle"} />
              <span className="flex-1">{f.name}</span>
              <span className="tabular-nums">{usd(each[f.id])}</span>
              <span className="flex w-12 justify-end text-[11px]">
                {sent > i ? (
                  <span className="rise flex items-center gap-0.5 text-paid">
                    <Check size={11} strokeWidth={2.5} /> Sent
                  </span>
                ) : sent === i ? (
                  <LoaderCircle size={12} className="spinner text-secondary" />
                ) : null}
              </span>
            </div>
          ))}
        </div>
        {sent >= friends.length && <Activity>Sent 3 PayPal invoices · you paid {usd(each.you)}</Activity>}
      </div>
      <div className="px-3 pb-5 pt-2">
        <Primary onClick={onSend} disabled={nobody.length > 0 || sent >= 0}>
          {sent >= friends.length ? "Requests sent" : `Send ${friends.length} PayPal requests`}
        </Primary>
      </div>
    </div>
  );
}

export function Split() {
  const [items, setItems] = useState(receipt);
  /** -1 before sending; then how many requests have gone out. */
  const [sent, setSent] = useState(-1);
  const sending = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { each, nobody } = split(items);

  const context = useMemo(
    () => ({
      toggle: ((id, person) => {
        setItems((all) => all.map((item) => (item.id === id ? { ...item, [person]: !item[person] } : item)));
        // A changed share cancels requests still going out.
        sending.current.forEach(clearTimeout);
        setSent(-1);
      }) satisfies Toggle,
    }),
    [],
  );

  const send = () => {
    setSent(0);
    sending.current = friends.map((_, i) => setTimeout(() => setSent(i + 1), 500 + i * 550));
  };

  const totals = useMemo(
    () => [{ id: "total", name: "Each pays", price: items.reduce((sum, i) => sum + i.price, 0) * (1 + TAX + TIP), ...each }] as unknown as Item[],
    [items, each],
  );

  return (
    <div className="grid items-center justify-items-center gap-6 lg:grid-cols-[1fr_auto] lg:justify-items-stretch">
      <div className="order-2 grid w-full min-w-0 gap-3 lg:order-1">
        <Tile>
          <p className="mb-3 text-[13px] text-secondary">Who had what. Tap to tick; the shares update as you go.</p>
          <Grid<Item>
            rowData={items}
            columnDefs={columns}
            getRowId={({ data }) => data.id}
            pinnedBottomRowData={totals}
            context={context}
            headerHeight={52}
          />
        </Tile>
        <Tile className="grid gap-4 sm:grid-cols-3">
          {[
            ["Shared fairly", "Each item splits between whoever had it. Tax and tip follow each person's share."],
            ["Paid with PayPal", "Every friend gets an invoice they can pay with PayPal or a card."],
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
          <SplitScreen each={each} nobody={nobody} sent={sent} onSend={send} />
        </Phone>
      </div>
    </div>
  );
}
