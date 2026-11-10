"use client";

import { ChevronRight, CircleCheck, Download, LoaderCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Activity } from "@backend/model";
import type { impact as impactOf, Item } from "@backend/inbox";
import { Notify } from "@/components/pwa";
import { Bot, type BotColor, type BotShape } from "@/components/bot";
import type { Face } from "@/components/ui";
import { usd } from "@/lib/format";
import { act, approveOnPayPal, daysSince, useLive, type LiveState } from "@/lib/live";
import { agents, DAYS, owed as demoOwed, week as demoWeek } from "@/app/_landing/data";
import type { ScoutView } from "@/app/_landing/scout";

// Today: where the installed app opens (app/manifest.ts). What needs you, across the agents, with a
// tap to do it (backend/src/inbox.ts); what Flick did for you this month; where the week stands, who
// owes you, the next shop, and what the agents did. Live state when the backend answers; the demo's
// week and requests otherwise.

const LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type Pay = { id: string; payee: string; what: string; amount: number; day: string; status: string };
type Owe = { id: string; name: string; face: Face; amount: number; what: string; days: number };
type View = { payments: Pay[]; approved: boolean; today: number; date: string | null; owed: Owe[]; activity: Activity[] };

function viewOf(state: LiveState | null): View {
  if (!state) {
    return {
      payments: demoWeek.map((p) => ({ ...p, status: "planned" })),
      approved: false,
      today: -1,
      date: null,
      owed: demoOwed.map((o) => ({ id: o.friend.id, name: o.friend.name, face: o.friend, amount: o.amount, what: o.what, days: o.days })),
      activity: [],
    };
  }
  const { week } = state;
  return {
    payments: [...week.payments].sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day)),
    approved: week.approval?.status === "approved",
    today: week.today,
    // Flick's own clock: the week's Monday plus the day Autopilot is on (-1 is the Sunday before).
    date: dayOf(week.starts, week.today),
    owed: state.debts
      .filter((d) => d.status === "requested")
      .map((d) => {
        const f = state.friends.find((x) => x.id === d.friendId);
        const face = { color: (f?.color ?? "blue") as BotColor, shape: (f?.shape ?? "circle") as BotShape };
        return { id: d.id, name: f?.name ?? "A friend", face, amount: d.amount, what: d.what, days: daysSince(d.createdAt) };
      }),
    activity: state.activity.slice(0, 6),
  };
}

const dayOf = (monday: string, offset: number) => new Date(Date.parse(`${monday}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
const never = () => () => {};

export function Today() {
  const { state } = useLive();
  const view = viewOf(state);
  // The visitor's own clock, so only in the browser.
  const hour = useSyncExternalStore(never, () => new Date().getHours(), () => null);
  const greeting = hour === null ? "Today" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dayName = view.today < 0 ? "Sunday" : LONG[view.today];
  const date = view.date && new Date(`${view.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-5 sm:px-6 lg:pt-10">
      <header className="mb-4 px-1">
        <p className="text-[13px] uppercase tracking-wide text-secondary">
          {dayName}
          {date && ` ${date}`}
          {view.today < 0 && " · planning day"}
        </p>
        <h1 className="text-[34px] font-semibold leading-tight tracking-tight">{greeting}</h1>
      </header>

      <InboxCard />

      <div className="grid gap-3 lg:grid-cols-2">
        <WeekCard view={view} />
        <OwedCard owed={view.owed} />
        <Actions />
        <ScoutCard />
        <ActivityCard activity={view.activity} live={Boolean(state)} />
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {state && (
          <button type="button" onClick={() => statement(state)} className="pressable flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-fill px-4 text-[13px]">
            <Download size={15} aria-hidden /> Download statement (CSV)
          </button>
        )}
        <Link href="/install" className="pressable flex h-10 items-center gap-1.5 rounded-full bg-fill px-4 text-[13px] standalone:hidden">
          Put Flick on your home screen <ChevronRight size={15} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

type Inbox = { items: Item[]; impact: ReturnType<typeof impactOf> };

/** What needs you, and this month's impact, from the backend; again whenever the live state changes. */
function useInbox() {
  const { state } = useLive();
  const [inbox, setInbox] = useState<Inbox | null>(null);
  useEffect(() => {
    if (!state) return;
    fetch("/api/inbox", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<Inbox>) : null))
      .then(setInbox)
      .catch(() => {});
  }, [state]);
  return inbox;
}

function InboxCard() {
  const inbox = useInbox();
  if (!inbox) return null;
  const { items, impact } = inbox;
  const did = [
    impact.saved > 0 && `saved you ${usd(impact.saved)} on groceries`,
    impact.paidBack > 0 && `got you ${usd(impact.paidBack)} paid back`,
    impact.paid.count > 0 && `paid ${impact.paid.count} payment${impact.paid.count === 1 ? "" : "s"}, ${usd(impact.paid.amount)}`,
    impact.read > 0 && `read ${impact.read} photo${impact.read === 1 ? "" : "s"}`,
  ].filter(Boolean);

  return (
    <section className="mb-3 rounded-[24px] bg-card p-5" aria-labelledby="needs-you">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="needs-you" className="text-[15px]">
            Needs you {items.length > 0 && <span className="text-secondary">· {items.length}</span>}
          </h2>
          {did.length > 0 && <p className="mt-0.5 text-[13px] text-secondary">This month Flick {did.join(", ")}.</p>}
        </div>
        <Notify />
      </div>
      {items.length ? (
        <ul className="mt-2 divide-y divide-separator/50">
          {items.map((item) => (
            <InboxRow key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 flex items-center gap-1.5 text-[13px] text-secondary">
          <CircleCheck size={15} className="text-paid" aria-hidden /> All done. Your agents put anything new here.
        </p>
      )}
    </section>
  );
}

/** One thing to do. The first tap asks to be sure; the second does it (and money still goes through PayPal). */
function InboxRow({ item }: { item: Item }) {
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string }>();

  const run = async () => {
    if (!sure) return setSure(true);
    setBusy(true);
    try {
      const out = await act<{ approveUrl?: string | null; done: string }>("inbox/act", { id: item.id });
      if (out.approveUrl) return void (await approveOnPayPal(out.approveUrl, { amount: item.amount ?? undefined }));
      setNote({ ok: true, text: out.done });
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
      setSure(false);
    }
  };

  return (
    <li className="flex items-center gap-3 py-2.5">
      <Bot {...agents[item.agent]} size={30} mood={busy ? "speaking" : "awake"} />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] leading-snug">{item.title}</span>
        <span className={`block text-[12px] leading-snug ${note ? (note.ok ? "text-paid" : "text-wait") : "text-secondary"}`}>{note?.text ?? item.detail}</span>
      </span>
      {item.action ? (
        <button
          type="button"
          onClick={() => void run()}
          onBlur={() => setSure(false)}
          disabled={busy}
          className={`pressable flex h-8 shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-full px-3 text-[12px] ${sure ? "bg-ink text-on-ink" : "bg-fill"}`}
        >
          {busy && <LoaderCircle size={12} className="spinner" />}
          {sure ? `Yes, ${item.action.toLowerCase()}${item.amount ? ` · ${usd(item.amount)}` : ""}` : item.action}
        </button>
      ) : (
        <Link href={item.href} className="pressable flex h-8 shrink-0 items-center rounded-full bg-fill px-3 text-[12px]">
          Open
        </Link>
      )}
    </li>
  );
}

function Card({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`pressable block rounded-[24px] bg-card p-5 ${className}`}>
      {children}
    </Link>
  );
}

function Heading({ face, children, right }: { face: Face; children: ReactNode; right?: ReactNode }) {
  return (
    <p className="flex items-center justify-between gap-2 text-[15px]">
      <span className="flex items-center gap-2">
        <Bot {...face} size={24} mood="awake" />
        {children}
      </span>
      <span className="flex items-center gap-1 text-[13px] text-secondary">
        {right}
        <ChevronRight size={15} aria-hidden />
      </span>
    </p>
  );
}

function WeekCard({ view }: { view: View }) {
  const counted = view.payments.filter((p) => p.status !== "skipped");
  const total = counted.reduce((sum, p) => sum + p.amount, 0);
  const paid = counted.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
  const failed = counted.filter((p) => p.status === "failed").length;
  const next = counted.find((p) => p.status === "planned" || p.status === "scheduled");
  const unapproved = !view.approved && counted.some((p) => p.status === "planned");

  return (
    <Card href="/autopilot">
      <Heading face={agents.autopilot} right={view.approved ? "Approved" : unapproved ? "Needs your OK" : undefined}>
        This week
      </Heading>
      <p className="mt-4 text-[34px] leading-none tracking-tight tabular-nums">
        {usd(paid)}
        <span className="text-[17px] text-secondary"> of {usd(total)} paid</span>
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-fill" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={paid} aria-label="Paid this week">
        <div className="h-full rounded-full bg-autopilot transition-[width] duration-500" style={{ width: `${total ? (paid / total) * 100 : 0}%` }} />
      </div>
      <p className="mt-3 flex justify-between gap-3 text-[13px] text-secondary">
        {next ? (
          <>
            <span className="truncate">
              Next: <span className="text-ink">{next.payee}</span> · {next.what}
            </span>
            <span className="shrink-0 tabular-nums">
              {next.day} · {usd(next.amount)}
            </span>
          </>
        ) : (
          <span>{counted.length ? "Everything this week is paid." : "Nothing planned this week."}</span>
        )}
      </p>
      {failed > 0 && <p className="mt-2 text-[13px] text-danger">{failed === 1 ? "A payment failed" : `${failed} payments failed`}: retry on This week.</p>}
      {unapproved && (
        <span className="mt-4 flex h-10 items-center justify-center rounded-full bg-ink text-[13px] text-on-ink">
          Review and approve · {usd(counted.filter((p) => p.status === "planned").reduce((sum, p) => sum + p.amount, 0))}
        </span>
      )}
    </Card>
  );
}

function OwedCard({ owed }: { owed: Owe[] }) {
  const total = owed.reduce((sum, o) => sum + o.amount, 0);
  return (
    <Card href="/nudge">
      <Heading face={agents.nudge} right={owed.length ? `${owed.length} open` : undefined}>
        Owed to you
      </Heading>
      <p className="mt-4 text-[34px] leading-none tracking-tight tabular-nums">{usd(total)}</p>
      {owed.length ? (
        <ul className="mt-3 divide-y divide-separator/50">
          {owed.slice(0, 4).map((o) => (
            <li key={o.id} className="flex items-center gap-2.5 py-2 text-[13px]">
              <Bot {...o.face} size={26} />
              <span className="min-w-0 flex-1">
                <span className="block">{o.name}</span>
                <span className="block truncate text-secondary">
                  {o.what} · {o.days === 0 ? "today" : o.days === 1 ? "1 day" : `${o.days} days`}
                </span>
              </span>
              <span className="tabular-nums">{usd(o.amount)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] text-secondary">Nobody owes you anything. Split a bill and Splitter invoices them.</p>
      )}
    </Card>
  );
}

const actions = [
  ["/lens", agents.lens, "Snap a bill", "Lens reads and pays it"],
  ["/split", agents.splitter, "Split a bill", "Invoice friends their share"],
  ["/nudge", agents.nudge, "Get paid back", "A reminder, in your tone"],
] as const;

function Actions() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-2">
      {actions.map(([href, face, title, text]) => (
        <Link key={href} href={href} className="pressable rounded-[22px] bg-card p-4">
          <Bot {...face} size={32} mood="awake" />
          <p className="mt-3 text-[15px]">{title}</p>
          <p className="text-[12px] leading-snug text-secondary">{text}</p>
        </Link>
      ))}
      <Link href="/ask" className="pressable rounded-[22px] bg-ink p-4 text-on-ink">
        <span className="flex size-8 items-center justify-center rounded-full bg-on-ink/15">
          <Sparkles size={17} aria-hidden />
        </span>
        <p className="mt-3 text-[15px]">Ask Flick</p>
        <p className="text-[12px] leading-snug opacity-70">Your agents, in one chat</p>
      </Link>
    </div>
  );
}

/** Scout's next shop: where it's cheapest, what that saves, and what's getting dearer. */
function ScoutCard() {
  const [scout, setScout] = useState<ScoutView | null>(null);
  useEffect(() => {
    fetch("/api/scout", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<ScoutView>) : null))
      .then(setScout)
      .catch(() => {});
  }, []);

  // An empty basket prices at $0.00 everywhere: that's nothing due, not a best price.
  const best = scout?.basket.items.length ? scout.basket.quotes.find((q) => !q.missing.length) : undefined;
  const learning = scout && !scout.products.some((p) => p.usual);
  const usual = scout?.basket.quotes.find((q) => q.storeId === scout.basket.usualStore);
  const store = (id: string) => scout?.stores.find((s) => s.id === id)?.name ?? id;
  const saving = best && usual && !usual.missing.length ? usual.total - best.total : 0;
  const rising = scout?.products.filter((p) => p.usual && p.forecast.verdict === "rising") ?? [];

  return (
    <Card href="/scout">
      <Heading face={agents.scout} right={scout?.basket.items.length ? `${scout.basket.items.length} due` : undefined}>
        Next shop
      </Heading>
      {best ? (
        <>
          <p className="mt-4 text-[34px] leading-none tracking-tight tabular-nums">
            {usd(best.total)}
            <span className="text-[17px] text-secondary"> at {store(best.storeId)}</span>
          </p>
          <p className="mt-3 text-[13px] text-secondary">
            {saving > 0.005 ? (
              <>
                <span className="text-paid">{usd(saving)} less</span> than at {store(scout!.basket.usualStore)}, for {best.lines.length} usuals.
              </>
            ) : (
              <>Your {best.lines.length} usuals, at the best price this week.</>
            )}
          </p>
          {rising.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
              {rising.map((p) => (
                <span key={p.id} className="rounded-full bg-wait/15 px-2 py-0.5 text-wait">
                  {p.name} ▲ {Math.round(p.forecast.change * 100)}%
                </span>
              ))}
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 text-[13px] text-secondary">
          {learning
            ? "Scout learns what you buy from your grocery receipts and lists, then finds it cheapest every week."
            : scout
              ? "Nothing's due. Scout lists your usuals the day they are."
              : "Scout prices your usuals at every store, once Flick's backend answers."}
        </p>
      )}
    </Card>
  );
}

const ago = (iso: string) => {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
};

function ActivityCard({ activity, live }: { activity: Activity[]; live: boolean }) {
  return (
    <div className="rounded-[24px] bg-card p-5">
      <p className="text-[15px]">What your agents did</p>
      {activity.length ? (
        <ul className="mt-2 divide-y divide-separator/50">
          {activity.map((a) => (
            <li key={a.id} className="flex items-center gap-2.5 py-2.5 text-[13px]">
              <Bot {...agents[a.agent]} size={24} />
              <span className="min-w-0 flex-1 leading-snug">{a.text}</span>
              {a.amount !== undefined && !a.text.includes(usd(a.amount)) && <span className="tabular-nums">{usd(a.amount)}</span>}
              <span className="w-8 shrink-0 text-right text-secondary">{ago(a.at)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[13px] text-secondary">{live ? "Nothing yet. Snap a bill to start." : "Your agents' work shows up here once Flick's backend answers."}</p>
      )}
    </div>
  );
}

/**
 * Everything Flick has paid or asked for, as a CSV for a spreadsheet: past payments (Lens's and
 * past weeks'), this week's plan, and requests to friends. Text from photos Lens read is kept from
 * being run as a spreadsheet formula.
 */
function statement(state: LiveState) {
  const name = (id: string) => state.payees.find((p) => p.id === id)?.name ?? id;
  const friend = (id: string) => state.friends.find((f) => f.id === id)?.name ?? id;
  const rows: string[][] = [
    ...state.history.map((p) => [p.date, "Paid", name(p.payeeId), p.what, p.amount.toFixed(2), "", "paid"]),
    ...state.week.payments.map((p) => [dayOf(state.week.starts, DAYS.indexOf(p.day)), "This week", p.payee, p.what, p.amount.toFixed(2), "", p.status]),
    ...state.debts.map((d) => [d.createdAt.slice(0, 10), "Requested", friend(d.friendId), d.what, "", d.amount.toFixed(2), d.status === "paid" ? "paid back" : d.status]),
  ].sort((a, b) => b[0].localeCompare(a[0]));
  const cell = (v: string) => {
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
  };
  const csv = [["Date", "Kind", "Who", "What", "Money out (USD)", "Money in (USD)", "Status"], ...rows].map((r) => r.map(cell).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = `flick-statement-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  // Safari drops the download if the file goes before it has started.
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}
