import { ArrowUpRight, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { Bot } from "@/components/bot";
import { usd } from "@/lib/format";
import { agents, DAYS, owed, week } from "./data";

// Money Studio: every payment, request and reminder lands in AG Studio at /dashboard, where an
// agent builds the dashboards. This is a picture of it, with the way in.

const paid = week.reduce((sum, p) => sum + p.amount, 0);
const owedToYou = owed.reduce((sum, o) => sum + o.amount, 0);
const bars = DAYS.map((d) => week.filter((p) => p.day === d).reduce((sum, p) => sum + p.amount, 0));
const tallest = Math.max(...bars);

export function Studio() {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.4fr]">
      <div className="text-center lg:text-left">
        <p className="text-[19px] leading-[1.45] text-secondary">
          Ask for a Sunday recap and the Studio agent picks the data, builds the charts and lays out the page. Change anything by hand, or just ask again.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3 lg:justify-start">
          <Link href="/dashboard" className="pressable flex h-12 items-center gap-1.5 rounded-full bg-ink px-6 text-[17px] text-white">
            Open Money Studio <ArrowUpRight size={18} aria-hidden />
          </Link>
        </div>
        <p className="mt-3 text-[13px] text-secondary">Built on AG Studio, over live PayPal sandbox data.</p>
      </div>

      <div className="rounded-[28px] bg-[var(--tile)] p-4 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.25)]" aria-hidden>
        <div className="flex items-center gap-2 px-1 pb-3 text-[13px]">
          <span className="flex size-6 items-center justify-center rounded-[7px] bg-ink text-white">
            <LayoutGrid size={13} />
          </span>
          Sunday recap
          <span className="ml-auto flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-2.5 rounded-full bg-fill" />
            ))}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-3">
              {[
                ["Paid this week", usd(paid)],
                ["Owed to you", usd(owedToYou)],
                ["Bills learned", "7"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-white p-3">
                  <p className="text-[11px] text-secondary">{label}</p>
                  <p className="mt-1 text-[18px] tabular-nums tracking-tight">{value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl bg-white p-3">
              <p className="text-[11px] text-secondary">Paid by day</p>
              <div className="mt-2 flex h-28 items-end gap-2">
                {bars.map((v, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <span className="w-full rounded-md bg-ink" style={{ height: `${Math.max(4, (v / tallest) * 92)}px`, opacity: v ? 1 : 0.15 }} />
                    <span className="text-[10px] text-secondary">{"MTWTFSS"[i]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl bg-white p-3">
            <p className="flex items-center gap-1.5 text-[11px] text-secondary">
              <Bot {...agents.autopilot} size={16} /> Studio agent
            </p>
            <p className="ml-auto max-w-[90%] rounded-[15px] bg-ink px-2.5 py-1.5 text-[12px] leading-4 text-white">Build my Sunday recap</p>
            <p className="mx-auto w-fit rounded-full bg-[#f2f2f7] px-2 py-0.5 text-[10px] text-secondary">Read 4 data sources</p>
            <p className="mx-auto w-fit rounded-full bg-[#f2f2f7] px-2 py-0.5 text-[10px] text-secondary">Added 4 widgets</p>
            <p className="mr-auto max-w-[90%] rounded-[15px] bg-fill px-2.5 py-1.5 text-[12px] leading-4">
              Done. Bills were your biggest spend, and Leo is the longest open request.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
