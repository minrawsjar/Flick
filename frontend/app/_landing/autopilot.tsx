"use client";

import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { Check, Coffee, LoaderCircle, RotateCcw, ShoppingCart, Smartphone, Trophy, Users, Zap, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Bot } from "@/components/bot";
import { Grid } from "@/components/grid";
import { Phone } from "@/components/phone";
import { Meter, Primary, Secondary, Tile, Title } from "@/components/ui";
import { usd } from "@/lib/format";
import { agents, DAYS, week, WEEKLY_CAP, type Day, type PayeeIcon, type Planned } from "./data";

// Autopilot: the week's payments, planned from what you've snapped and paid before. Edit them in
// the grid, approve once, then step through the days and watch each one get paid.

const icons: Record<PayeeIcon, LucideIcon> = { power: Zap, phone: Smartphone, friend: Users, coffee: Coffee, cart: ShoppingCart, ball: Trophy };

type Status = "planned" | "waiting" | "scheduled" | "paid";

/** `today` is -1 on Sunday, the planning day before the week starts. */
const dayIndex = (day: Day) => DAYS.indexOf(day);
const statusOf = (p: Planned, approved: boolean, today: number): Status =>
  dayIndex(p.day) <= today ? (approved ? "paid" : "waiting") : approved ? "scheduled" : "planned";

const total = (rows: Planned[]) => rows.reduce((sum, p) => sum + p.amount, 0);

function autopilotSays(rows: Planned[], approved: boolean, today: number) {
  const sum = total(rows);
  const due = rows.filter((p) => dayIndex(p.day) <= today);
  const left = rows.length - due.length;
  if (!approved) {
    if (sum > WEEKLY_CAP) return `That's ${usd(sum)}, over your ${usd(WEEKLY_CAP)} weekly cap. I'll wait for you to approve it.`;
    if (due.length) return `${due.length} ${due.length === 1 ? "payment is" : "payments are"} due and waiting. Nothing gets paid until you approve.`;
    return `I planned ${rows.length} payments for this week, ${usd(sum)}. Approve once and I'll handle the rest.`;
  }
  if (today < 0) return "All set. I'll pay each one on its day.";
  if (!left) return `Week done. All ${rows.length} paid, ${usd(sum)} in all.`;
  const paidToday = rows.filter((p) => dayIndex(p.day) === today);
  if (!paidToday.length) return `Nothing due today. ${left} left this week.`;
  return `Paid ${paidToday.map((p) => `${p.payee}, ${usd(p.amount)}`).join(" and ")}. ${left} left this week.`;
}

function StatusText({ status, day }: { status: Status; day: Day }) {
  if (status === "paid")
    return (
      <span className="flex items-center gap-0.5 text-paid">
        <Check size={12} strokeWidth={2.5} /> Paid
      </span>
    );
  if (status === "waiting") return <span className="text-wait">Waiting</span>;
  return <span>{day}</span>;
}

function PayeeIconTile({ icon, size = 28 }: { icon: PayeeIcon; size?: number }) {
  const Icon = icons[icon];
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-fill" style={{ width: size, height: size }}>
      <Icon size={size * 0.5} />
    </span>
  );
}

/** "This week" on the phone. */
export function WeekScreen({ rows, approved, today, approving, onApprove }: { rows: Planned[]; approved: boolean; today: number; approving?: boolean; onApprove?: () => void }) {
  const message = autopilotSays(rows, approved, today);
  const sum = total(rows);

  return (
    <div className="flex h-full flex-col">
      <Title right={<span className="rounded-full bg-fill px-2 py-0.5 text-[11px]">{today < 0 ? "Sun · planning" : DAYS[today]}</span>}>This week</Title>
      <div className="mx-3 flex items-start gap-2 rounded-card bg-card p-2.5">
        <Bot {...agents.autopilot} size={30} mood={approved ? "awake" : "speaking"} />
        <p key={message} className="rise text-[12px] leading-4">
          {message}
        </p>
      </div>
      <div className="mx-3 mt-2 rounded-card bg-card px-3 py-2">
        <Meter label="Weekly cap" used={sum} of={WEEKLY_CAP} />
      </div>
      <p className="px-6 pb-1 pt-2.5 text-[10px] uppercase tracking-wide text-secondary">Planned</p>
      <div className="mx-3 divide-y divide-separator/50 rounded-card bg-card">
        {rows.map((p) => (
          <div key={p.id} className="flex items-center gap-2 px-2.5 py-1">
            <PayeeIconTile icon={p.icon} size={26} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] leading-4">{p.payee}</p>
              <p className="truncate text-[11px] leading-[14px] text-secondary">{p.what}</p>
            </div>
            <div className="text-right text-[11px] leading-[14px]">
              <p className="text-[13px] tabular-nums leading-4">{usd(p.amount)}</p>
              <span className="text-secondary">
                <StatusText status={statusOf(p, approved, today)} day={p.day} />
              </span>
            </div>
          </div>
        ))}
      </div>
      {!approved && (
        <div className="px-3 pt-2.5">
          <Primary onClick={onApprove} disabled={approving}>
            {approving ? (
              <>
                <LoaderCircle size={14} className="spinner" /> Opening PayPal…
              </>
            ) : (
              <>Approve week · {usd(sum)}</>
            )}
          </Primary>
        </div>
      )}
    </div>
  );
}

const PayeeCell = ({ data }: ICellRendererParams<Planned>) =>
  data && (
    <div className="flex h-full items-center gap-2.5">
      <PayeeIconTile icon={data.icon} />
      <div className="min-w-0 leading-[18px]">
        <p className="truncate">{data.payee}</p>
        <p className="truncate text-[12px] text-secondary">{data.what}</p>
      </div>
    </div>
  );

const pill: Record<Status, string> = {
  planned: "bg-fill text-secondary",
  waiting: "bg-[#fff4e5] text-wait",
  scheduled: "bg-ink text-white",
  paid: "bg-[#e8f8ec] text-paid",
};

const StatusCell = ({ value }: ICellRendererParams<Planned, Status>) =>
  value && (
    <div className="flex h-full items-center">
      <span className={`rounded-full px-2.5 py-0.5 text-[12px] capitalize leading-5 ${pill[value]}`}>{value}</span>
    </div>
  );

export function Autopilot() {
  const [rows, setRows] = useState(week);
  const [approved, setApproved] = useState(false);
  const [approving, setApproving] = useState(false);
  const [today, setToday] = useState(-1);

  const approve = () => {
    setApproving(true);
    setTimeout(() => {
      setApproving(false);
      setApproved(true);
    }, 1100);
  };
  const reset = () => {
    setRows(week);
    setApproved(false);
    setToday(-1);
  };

  // Editable until approved: the approval covers exactly what's in the grid.
  const columns = useMemo<ColDef<Planned>[]>(
    () => [
      { field: "payee", headerName: "Payee", cellRenderer: PayeeCell, flex: 1.3, minWidth: 180 },
      {
        field: "day",
        headerName: "Day",
        width: 92,
        editable: !approved,
        singleClickEdit: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: [...DAYS] },
      },
      {
        field: "amount",
        headerName: "Amount",
        width: 112,
        type: "rightAligned",
        editable: !approved,
        singleClickEdit: true,
        cellEditor: "agNumberCellEditor",
        cellEditorParams: { min: 0, max: 1000, precision: 2 },
        valueFormatter: ({ value }) => usd(value ?? 0),
        cellClass: "tabular-nums",
      },
      {
        colId: "status",
        headerName: "Status",
        width: 116,
        valueGetter: ({ data }) => data && statusOf(data, approved, today),
        cellRenderer: StatusCell,
      },
      { field: "why", headerName: "Autopilot's reason", flex: 2, minWidth: 220, wrapText: true, autoHeight: true, cellClass: "!py-2.5 !leading-5 text-secondary" },
    ],
    [approved, today],
  );

  const sum = total(rows);

  return (
    <div className="grid items-center justify-items-center gap-6 lg:grid-cols-[auto_1fr] lg:justify-items-stretch">
      <Phone width={262}>
        <WeekScreen rows={rows} approved={approved} today={today} approving={approving} onApprove={approve} />
      </Phone>

      <div className="grid w-full min-w-0 gap-3 md:grid-cols-2">
        <Tile className="md:col-span-2">
          <p className="mb-3 text-[13px] text-secondary">The plan, in AG Grid. Tap an amount or a day to change it, until you approve.</p>
          <Grid<Planned>
            rowData={rows}
            columnDefs={columns}
            getRowId={({ data }) => data.id}
            onCellValueChanged={({ data }) => setRows((all) => all.map((p) => (p.id === data.id ? { ...data } : p)))}
            stopEditingWhenCellsLoseFocus
          />
        </Tile>

        <Tile className="flex flex-col">
          <p className="text-[13px] text-secondary">Approve once, on Sunday</p>
          <p className="mt-2 text-[15px] leading-[1.45]">
            One PayPal approval covers the whole week. Autopilot never pays more than you approved, and anything over your cap waits for you.
          </p>
          <div className="mt-auto pt-4">
            {approved ? (
              <p className="rise flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#e8f8ec] text-[13px] text-paid">
                <Check size={15} /> Approved · {usd(sum)}
              </p>
            ) : (
              <Primary onClick={approve} disabled={approving}>
                {approving ? (
                  <>
                    <LoaderCircle size={14} className="spinner" /> Opening PayPal…
                  </>
                ) : (
                  <>Approve with PayPal · {usd(sum)}</>
                )}
              </Primary>
            )}
          </div>
        </Tile>

        <Tile className="flex flex-col">
          <p className="text-[13px] text-secondary">Then watch it run</p>
          <ol className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px]">
            {DAYS.map((d, i) => (
              <li key={d} className={`rounded-lg py-1.5 transition-colors duration-300 ${i === today ? "bg-ink text-white" : i < today ? "bg-fill" : "bg-white text-secondary"}`}>
                {d}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[12px] text-secondary">{today < 0 ? "It's Sunday: planning day." : `It's ${DAYS[today]}.`}</p>
          <div className="mt-auto flex gap-2 pt-4">
            <Secondary onClick={() => setToday((d) => Math.min(6, d + 1))} disabled={today >= 6} className="flex-1">
              Next day →
            </Secondary>
            <Secondary onClick={reset} className="w-10 px-0" label="Start over">
              <RotateCcw size={15} />
            </Secondary>
          </div>
        </Tile>
      </div>
    </div>
  );
}
