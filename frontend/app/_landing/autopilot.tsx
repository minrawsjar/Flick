"use client";

import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { Check, Coffee, FileText, LoaderCircle, Receipt, RotateCcw, ScanLine, ShoppingBag, ShoppingCart, Smartphone, Trophy, Users, Zap, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Scan, Unusual } from "@backend/model";
import { Bot } from "@/components/bot";
import { Grid } from "@/components/grid";
import { Phone } from "@/components/phone";
import { Meter, Primary, Secondary, Tile, Title } from "@/components/ui";
import { usd } from "@/lib/format";
import { act, approveOnPayPal, refresh, useLive, type LiveState } from "@/lib/live";
import { agents, DAYS, week, WEEKLY_CAP, type Day, type PayeeIcon, type Planned } from "./data";
import { forLens, isPdf, pdfForLens } from "./lens";

// Autopilot: the week's payments, planned from what you've snapped and paid before. Edit them in
// the grid, approve once, then step through the days and watch each one get paid. Live, that's
// the backend's real week: approval is a PayPal sandbox checkout, and each day pays out for real.

const icons: Record<PayeeIcon, LucideIcon> = { power: Zap, phone: Smartphone, friend: Users, coffee: Coffee, cart: ShoppingCart, ball: Trophy, bag: ShoppingBag, bill: Receipt };

type Status = "planned" | "waiting" | "scheduled" | "paid" | "skipped" | "failed";
/** A grid row: the payment, and the status it shows. */
type Row = Planned & { shown: Status };

/** `today` is -1 on Sunday, the planning day before the week starts. */
const dayIndex = (day: Day) => DAYS.indexOf(day);
/** Live payments carry their status; demo ones follow from the day and the approval. */
function statusOf(p: Planned, approved: boolean, today: number): Status {
  if (p.status) return p.status === "planned" && dayIndex(p.day) <= today ? "waiting" : p.status;
  return dayIndex(p.day) <= today ? (approved ? "paid" : "waiting") : approved ? "scheduled" : "planned";
}

const total = (rows: Planned[]) => rows.reduce((sum, p) => sum + p.amount, 0);

function autopilotSays(rows: Planned[], approved: boolean, today: number) {
  const status = (p: Planned) => statusOf(p, approved, today);
  const active = rows.filter((p) => status(p) !== "skipped");
  const sum = total(active);
  const failed = active.filter((p) => status(p) === "failed");
  if (failed.length) return `PayPal wouldn't pay ${failed.map((p) => p.payee).join(" and ")}. Tap retry when it's sorted.`;
  if (!active.length) return "Nothing to pay this week.";
  if (!approved) {
    if (sum > WEEKLY_CAP) return `That's ${usd(sum)}, over your ${usd(WEEKLY_CAP)} weekly cap. I'll wait for you to approve it.`;
    const waiting = active.filter((p) => status(p) === "waiting").length;
    if (waiting) return `${waiting} ${waiting === 1 ? "payment is" : "payments are"} due and waiting. Nothing gets paid until you approve.`;
    const odd = active.filter((p) => p.unusual);
    if (odd.length > 1) return `${odd.map((p) => p.payee).join(" and ")} look out of the ordinary: worth a look before you approve.`;
    const flag = odd[0]?.unusual;
    if (flag) return `${flag.kind === "new-payee" ? `You haven't paid ${odd[0].payee} before` : `${odd[0].payee} is ${flag.percent}% higher than usual`}: worth a look before you approve.`;
    return `I planned ${active.length} payments for this week, ${usd(sum)}. Approve once and I'll handle the rest.`;
  }
  const paid = active.filter((p) => status(p) === "paid");
  const left = active.length - paid.length;
  if (!left) return `Week done. All ${paid.length} paid, ${usd(total(paid))} in all.`;
  if (today < 0) return "All set. I'll pay each one on its day.";
  const paidToday = paid.filter((p) => dayIndex(p.day) === today);
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
  if (status === "failed") return <span className="text-danger">Failed</span>;
  if (status === "skipped") return <span className="line-through">Skipped</span>;
  return <span>{day}</span>;
}

/** A flagged payment's warning: a chip in the grid, or `short`, a marker on the phone. */
function Flag({ unusual, short }: { unusual: Unusual; short?: boolean }) {
  const isNew = unusual.kind === "new-payee";
  return (
    <span
      title={isNew ? "Flick hasn't paid them before" : `Usually ${usd(unusual.usual)}`}
      className={`inline-block shrink-0 whitespace-nowrap rounded-full bg-wait/15 text-wait ${short ? "px-1.5 text-[10px] leading-[14px]" : "mr-1.5 px-2 text-[12px] leading-[18px]"}`}
    >
      {isNew ? (short ? "New" : "New payee") : `▲ ${unusual.percent}%${short ? "" : " above usual"}`}
    </span>
  );
}

function PayeeIconTile({ icon, size = 28 }: { icon: PayeeIcon; size?: number }) {
  const Icon = icons[icon] ?? Receipt;
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-fill" style={{ width: size, height: size }}>
      <Icon size={size * 0.5} />
    </span>
  );
}

/** "This week" on the phone. */
export function WeekScreen({ rows, approved, today, approving, onApprove, loading = false }: { rows: Planned[]; approved: boolean; today: number; approving?: boolean; onApprove?: () => void; loading?: boolean }) {
  const message = loading ? "Getting your week…" : autopilotSays(rows, approved, today);
  const sum = total(rows.filter((p) => statusOf(p, approved, today) !== "skipped"));

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
      {!rows.length && !loading && <p className="mx-3 rounded-card bg-card px-3 py-2.5 text-[12px] leading-4 text-secondary">Snap a bill with Lens: one due this week lands here.</p>}
      <div className="mx-3 divide-y divide-separator/50 rounded-card bg-card">
        {rows.map((p) => (
          <div key={p.id} className="flex items-center gap-2 px-2.5 py-1">
            <PayeeIconTile icon={p.icon} size={26} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] leading-4">{p.payee}</p>
              <p className="flex items-center gap-1 text-[11px] leading-[14px] text-secondary">
                <span className="truncate">{p.what}</span>
                {p.unusual && <Flag unusual={p.unusual} short />}
              </p>
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
      {!approved && sum > 0 && (
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

const WhyCell = ({ data }: ICellRendererParams<Planned>) =>
  data && (
    <>
      {data.unusual && <Flag unusual={data.unusual} />}
      {data.why}
    </>
  );

const pill: Record<Status, string> = {
  planned: "bg-fill text-secondary",
  waiting: "bg-wait/15 text-wait",
  scheduled: "bg-ink text-on-ink",
  paid: "bg-paid/15 text-paid",
  skipped: "bg-fill text-secondary line-through",
  failed: "bg-danger/15 text-danger",
};

const StatusCell = ({ value }: ICellRendererParams<Planned, Status>) =>
  value && (
    <div className="flex h-full items-center">
      <span className={`rounded-full px-2.5 py-0.5 text-[12px] capitalize leading-5 ${pill[value]}`}>{value}</span>
    </div>
  );

// --- The week, from demo state or from the backend ------------------------------------

type Patch = Partial<Pick<Planned, "amount" | "day">>;

type WeekDriver = {
  live: boolean;
  rows: Planned[];
  approved: boolean;
  today: number;
  busy: boolean;
  error?: string;
  edit: (id: string, patch: Patch) => void;
  approve: () => void;
  tick: () => void;
  next: () => void;
  retry: () => void;
  reset: () => void;
};

/**
 * The demo has no backend to judge an edited amount, so it applies rules.ts's `unusual` here: 25% or
 * more above the usual. Each demo payment's usual is its planned amount, bar a flagged one's.
 */
function rejudge(p: Planned): Planned {
  const planned = week.find((o) => o.id === p.id);
  if (!planned || planned.unusual?.kind === "new-payee") return p;
  const usual = planned.unusual?.kind === "above-usual" ? planned.unusual.usual : planned.amount;
  const above = p.amount / usual - 1;
  return { ...p, unusual: above >= 0.25 - 1e-9 ? { kind: "above-usual", percent: Math.round(above * 100), usual } : undefined };
}

const noop = () => {};
/** While the backend hasn't answered yet: nothing planned, nothing to press (busy). */
const LOADING_WEEK: WeekDriver = { live: false, rows: [], approved: false, today: -1, busy: true, edit: noop, approve: noop, tick: noop, next: noop, retry: noop, reset: noop };

// Copies: AG Grid writes edits into the rows it's given, and `week` must stay as planned.
const plannedWeek = () => week.map((p) => ({ ...p }));

function useDemoWeek(): WeekDriver {
  const [rows, setRows] = useState(plannedWeek);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [today, setToday] = useState(-1);
  const reset = () => {
    setRows(plannedWeek());
    setApproved(false);
    setToday(-1);
  };
  return {
    live: false,
    rows,
    approved,
    today,
    busy,
    edit: (id, patch) => setRows((all) => all.map((p) => (p.id === id ? rejudge({ ...p, ...patch }) : p))),
    approve: () => {
      setBusy(true);
      setTimeout(() => {
        setBusy(false);
        setApproved(true);
      }, 1100);
    },
    tick: () => setToday((d) => Math.min(6, d + 1)),
    next: reset,
    retry: () => {},
    reset,
  };
}

function useLiveWeek(state: LiveState | null): WeekDriver | null {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (!state) return null;

  const run = (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(undefined);
    work()
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        void refresh();
      })
      .finally(() => setBusy(false));
  };
  return {
    live: true,
    rows: state.week.payments.map((p) => ({ id: p.id, payee: p.payee, what: p.what, icon: p.icon, amount: p.amount, day: p.day, why: p.why, unusual: p.unusual, status: p.status })),
    approved: state.week.approval?.status === "approved",
    today: state.week.today,
    busy,
    error,
    edit: (id, patch) => run(() => act("week/edit", { id, ...patch })),
    // PayPal's sandbox checkout; it sends the person back to /?paid=week#autopilot.
    approve: () =>
      run(async () => {
        const { approveUrl, amount } = await act<{ approveUrl: string | null; amount: number }>("week/approve");
        await approveOnPayPal(approveUrl, { amount, to: "this week's payments" });
      }),
    tick: () => run(() => act("week/tick")),
    next: () => run(() => act("week/next")),
    retry: () => run(() => act("week/retry")),
    reset: () => run(() => act("reset")),
  };
}

const shortDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * Bills straight into the week: Lens reads each file (several at once, one after another), and a
 * bill due this week joins the plan as it's read (backend/src/lens.ts). Then it says what was added
 * and what wasn't, by the same rule the plan uses: an unpaid bill, due a day of this week. Kept in
 * Autopilot, not the button: the empty week's button goes as soon as the first bill lands.
 */
function useAddBills(starts: string | undefined) {
  const [reading, setReading] = useState<{ at: number; of: number }>();
  const [said, setSaid] = useState<string>();

  const add = async (input: HTMLInputElement) => {
    const files = Array.from(input.files ?? []);
    input.value = ""; // so picking the same files again still reads them
    if (!files.length || !starts) return;
    setSaid(undefined);
    const read: Scan[] = [];
    const notes: string[] = [];
    for (const [i, file] of files.entries()) {
      setReading({ at: i + 1, of: files.length });
      try {
        read.push(await act<Scan>("lens/read", isPdf(file) ? { pdf: await pdfForLens(file) } : await forLens(file)));
      } catch (err) {
        notes.push(`${file.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    // What joined, from the week as it is now: the backend moves a plan that's over on to this week.
    const week = await fetch("/api/state", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<LiveState>) : null))
      .then((state) => state?.week)
      .catch(() => undefined);
    const ends = week && new Date(Date.parse(`${week.starts}T00:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10);
    let added = 0;
    for (const scan of read) {
      if (scan.kind !== "bill" || scan.status === "paid") notes.push(`${scan.title} isn't a bill to pay.`);
      else if (week?.payments.some((p) => p.payeeId === scan.payeeId)) added++;
      else if (!scan.due) notes.push(`${scan.title} has no due date.`);
      else if (week && ends && (scan.due < week.starts || scan.due > ends)) notes.push(`${scan.title} is due ${shortDate(scan.due)}, not in the week of ${shortDate(week.starts)}.`);
      else notes.push(`${scan.title} didn't join this week's plan.`);
    }
    setReading(undefined);
    setSaid([`${added} ${added === 1 ? "bill" : "bills"} added to this week.`, ...notes].join(" "));
  };
  return { reading, said, add };
}

function AddBills({ bills: { reading, said, add }, center = false }: { bills: ReturnType<typeof useAddBills>; center?: boolean }) {
  return (
    <div className={`flex flex-col gap-1.5 ${center ? "items-center text-center" : "items-end text-right"}`}>
      <label
        aria-disabled={Boolean(reading)}
        className="pressable flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] text-on-ink aria-disabled:pointer-events-none aria-disabled:opacity-60"
      >
        {reading ? <LoaderCircle size={14} className="spinner" /> : <FileText size={14} />}
        {reading ? `Reading ${reading.at} of ${reading.of}…` : "Add bills"}
        <input type="file" accept="application/pdf,.pdf,image/*" multiple className="sr-only" disabled={Boolean(reading)} onChange={(e) => void add(e.currentTarget)} />
      </label>
      {said && <p className="max-w-sm text-[12px] leading-4 text-secondary">{said}</p>}
    </div>
  );
}

export function Autopilot() {
  const live = useLive();
  const demo = useDemoWeek();
  // Your own week, even an empty one: the sample week is only the one-pager's, or when the backend is out of reach.
  const real = useLiveWeek(live.mode === "live" ? live.state : null);
  // Until the backend answers, an empty week that says so: not the sample week, which would show
  // its $142.30 for a moment and then change to your own.
  const loading = live.mode === "loading";
  const w = real ?? (loading ? LOADING_WEEK : demo);
  // Each row carries the status it shows. Worked out in the grid instead, a new week could arrive
  // before the new day reached its columns, and keep the old day's statuses.
  const rows = w.rows.map((p) => ({ ...p, shown: statusOf(p, w.approved, w.today) }));
  // The Monday of your own week while bills can still join it: live, not approved, not under way.
  const planningWeek = real && !w.approved && w.today < 0 ? live.state?.week.starts : undefined;
  const bills = useAddBills(planningWeek);

  // Editable until approved: the approval covers exactly what's in the grid.
  const columns = useMemo<ColDef<Row>[]>(() => {
    const editable = ({ data }: { data?: Planned }) => (data?.status ? data.status === "planned" : !w.approved);
    return [
      { field: "payee", headerName: "Payee", cellRenderer: PayeeCell, flex: 1.3, minWidth: 180 },
      { field: "day", headerName: "Day", width: 92, editable, singleClickEdit: true, cellEditor: "agSelectCellEditor", cellEditorParams: { values: [...DAYS] } },
      {
        field: "amount",
        headerName: "Amount",
        width: 112,
        type: "rightAligned",
        editable,
        singleClickEdit: true,
        cellEditor: "agNumberCellEditor",
        cellEditorParams: { min: 0, max: 1000, precision: 2 },
        valueFormatter: ({ value }) => usd(value ?? 0),
        cellClass: "tabular-nums",
      },
      { field: "shown", headerName: "Status", width: 116, cellRenderer: StatusCell },
      // equals: its chip follows the amount, not `why`, so redraw whenever the row changes.
      { field: "why", headerName: "Autopilot's reason", cellRenderer: WhyCell, equals: () => false, flex: 2, minWidth: 220, wrapText: true, autoHeight: true, cellClass: "!py-2.5 !leading-5 text-secondary" },
    ];
  }, [w.approved]);

  const sum = total(w.rows.filter((p) => statusOf(p, w.approved, w.today) !== "skipped"));
  const failed = w.rows.some((p) => p.status === "failed");

  return (
    <div className="grid grid-cols-1 items-center justify-items-center gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:justify-items-stretch">
      <Phone width={262}>
        <WeekScreen rows={w.rows} approved={w.approved} today={w.today} approving={w.busy} onApprove={w.approve} loading={loading} />
      </Phone>

      <div className="grid w-full min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
        <Tile className="md:col-span-2">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <p className="text-[13px] text-secondary">
              {real && live.state ? `The week of ${shortDate(live.state.week.starts)}, in AG Grid.` : "The plan, in AG Grid."} Tap an amount or a day to change it, until you approve.
            </p>
            {/* Until the week is approved or under way: after that, new bills wait for next week. */}
            {planningWeek && rows.length > 0 && <AddBills bills={bills} />}
          </div>
          {loading ? (
            <p className="flex items-center justify-center gap-2 rounded-2xl bg-raised px-6 py-10 text-[14px] text-secondary">
              <LoaderCircle size={15} className="spinner" /> Loading your week…
            </p>
          ) : w.live && !rows.length ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-raised px-6 py-10 text-center">
              <Bot {...agents.autopilot} size={40} mood="idle" />
              <p className="max-w-md text-[15px] leading-[1.45]">Nothing planned this week yet.</p>
              <p className="max-w-md text-[13px] leading-[1.45] text-secondary">
                Add this week&apos;s bills (PDFs or photos, several at once) and Autopilot plans them. It also plans a bill you ask it to pay every month, and anything you pay week after week.
              </p>
              {planningWeek ? (
                <AddBills bills={bills} center />
              ) : (
                <Link href="/lens" className="pressable flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[14px] text-on-ink">
                  <ScanLine size={15} /> Snap a bill
                </Link>
              )}
            </div>
          ) : (
            <Grid<Row>
              rowData={rows}
              columnDefs={columns}
              getRowId={({ data }) => data.id}
              onCellValueChanged={({ data, colDef }) => w.edit(data.id, colDef.field === "amount" ? { amount: Number(data.amount) } : { day: data.day })}
              stopEditingWhenCellsLoseFocus
            />
          )}
          {w.error && <p className="mt-2 text-[12px] text-wait">{w.error}</p>}
        </Tile>

        <Tile className="flex flex-col">
          <p className="text-[13px] text-secondary">Approve once, on Sunday</p>
          <p className="mt-2 text-[15px] leading-[1.45]">
            One PayPal approval covers the whole week. Autopilot never pays more than you approved, and anything over your cap waits for you.
          </p>
          {w.live && !w.approved && sum > 0 && (
            <p className="mt-2 text-[12px] leading-4 text-secondary">Opens PayPal&apos;s sandbox: sign in with your sandbox personal account to approve.</p>
          )}
          <div className="mt-auto pt-4">
            {w.approved ? (
              <p className="rise flex h-10 items-center justify-center gap-1.5 rounded-full bg-paid/15 text-[13px] text-paid">
                <Check size={15} /> Approved · {usd(sum)}
              </p>
            ) : sum > 0 ? (
              <Primary onClick={w.approve} disabled={w.busy}>
                {w.busy ? (
                  <>
                    <LoaderCircle size={14} className="spinner" /> Opening PayPal…
                  </>
                ) : (
                  <>Approve with PayPal · {usd(sum)}</>
                )}
              </Primary>
            ) : (
              <p className="flex h-10 items-center justify-center rounded-full bg-fill text-[13px] text-secondary">{loading ? "Loading…" : "Nothing to approve this week"}</p>
            )}
          </div>
        </Tile>

        <Tile className="flex flex-col">
          <p className="text-[13px] text-secondary">Then watch it run{w.live ? ": each day pays out for real" : ""}</p>
          <ol className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px]">
            {DAYS.map((d, i) => (
              <li key={d} className={`rounded-lg py-1.5 transition-colors duration-300 ${i === w.today ? "bg-ink text-on-ink" : i < w.today ? "bg-fill" : "bg-raised text-secondary"}`}>
                {d}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[12px] text-secondary">{loading ? "Loading…" : w.today < 0 ? "It's Sunday: planning day." : `It's ${DAYS[w.today]}.`}</p>
          <div className="mt-auto flex gap-2 pt-4">
            {failed ? (
              <Secondary onClick={w.retry} disabled={w.busy} className="flex-1">
                Retry payouts
              </Secondary>
            ) : w.today >= 6 ? (
              <Secondary onClick={w.next} disabled={w.busy} className="flex-1">
                Plan next week →
              </Secondary>
            ) : (
              <Secondary onClick={w.tick} disabled={w.busy} className="flex-1">
                Next day →
              </Secondary>
            )}
            {/* Your own week has no reset: that would empty your whole workspace. */}
            {!w.live && (
              <Secondary onClick={w.reset} disabled={w.busy} className="w-10 px-0" label="Start the sample over">
                <RotateCcw size={15} />
              </Secondary>
            )}
          </div>
        </Tile>
      </div>
    </div>
  );
}
