import type { ReactNode } from "react";
import { Bot, botColors } from "@/components/bot";
import { agents, friends } from "./data";
import { Doc } from "./lens";

// "Meet your agents": one card each, with a small looping demo of what it does.

function Stage({ title, detail, tint, className = "", children }: { title: string; detail: string; tint: string; className?: string; children: ReactNode }) {
  return (
    <div className={`overflow-hidden rounded-[28px] bg-[var(--tile)] ${className}`}>
      <div
        className="flex h-52 items-center justify-center gap-5"
        style={{ backgroundImage: `radial-gradient(circle at 50% 45%, color-mix(in srgb, ${tint} 28%, transparent), transparent 70%)` }}
      >
        {children}
      </div>
      <div className="px-6 pb-7">
        <h3 className="text-[21px] tracking-tight">{title}</h3>
        <p className="mt-1.5 text-[15px] leading-[1.45] text-secondary">{detail}</p>
      </div>
    </div>
  );
}

export function Agents() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
      <Stage tint={botColors.cyan} className="lg:col-span-3" title="Lens reads it" detail="Bills, receipts, price tags and tip jars. It pulls out who to pay, how much and by when.">
        <Bot {...agents.lens} size={64} mood="awake" />
        <div className="relative -rotate-3 rounded-md bg-[#2a2520] p-2">
          <Doc kind="bill" width={64} />
          <span className="loop-scan absolute inset-x-1 h-0.5 rounded-full bg-[#36D1DC] shadow-[0_0_10px_2px_rgba(54,209,220,0.7)]" />
        </div>
      </Stage>

      <Stage tint={botColors.green} className="lg:col-span-3" title="Autopilot runs your week" detail="It learns what you pay and when, plans the week ahead, and asks you once, on Sunday.">
        <Bot {...agents.autopilot} size={64} mood="awake" />
        <div className="flex w-[136px] flex-wrap justify-center gap-1.5" aria-hidden>
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i} className="loop-tick flex size-7 items-center justify-center rounded-lg bg-fill text-[10px]" style={{ animationDelay: `${i * 0.45}s` }}>
              {d}
            </span>
          ))}
        </div>
      </Stage>

      <Stage tint={botColors.yellow} className="lg:col-span-2" title="Splitter splits it" detail="Tick who had what. Everyone gets a PayPal request for their fair share, tax and tip included.">
        <Bot {...agents.splitter} size={64} mood="awake" />
        <div className="flex" aria-hidden>
          {friends.map((f, i) => (
            <span
              key={f.id}
              className={`flex h-24 w-9 flex-col items-center gap-1.5 bg-fill/50 pt-2.5 ${i === 0 ? "loop-part-left rounded-l-lg" : i === 2 ? "loop-part-right rounded-r-lg" : ""}`}
            >
              <Bot {...f} size={18} />
              {[20, 14, 18].map((w, j) => (
                <span key={j} className="h-1 rounded-full bg-separator" style={{ width: w }} />
              ))}
            </span>
          ))}
        </div>
      </Stage>

      <Stage tint={botColors.pink} className="lg:col-span-2" title="Nudge follows up" detail="Friendly reminders, written for each friend and what it was for, so you never have to chase.">
        <Bot {...agents.nudge} size={64} mood="speaking" />
        <div className="flex h-12 items-center gap-1" aria-hidden>
          {[0, 0.15, 0.3, 0.1, 0.25].map((d, i) => (
            <span key={i} className="loop-wave h-full w-1 rounded-full bg-ink" style={{ animationDelay: `${d}s` }} />
          ))}
        </div>
      </Stage>

      <Stage tint={botColors.orange} className="sm:col-span-2 lg:col-span-2" title="Scout shops smarter" detail="It learns what you buy every week, finds it cheapest nearby or online, and buys before prices rise.">
        <Bot {...agents.scout} size={64} mood="awake" />
        <div className="flex flex-col gap-1.5 text-[12px] tabular-nums" aria-hidden>
          {[["$4.89", false], ["$4.19", false], ["$3.89", true]].map(([price, best], i) => (
            <span
              key={i}
              className={`rounded-full px-3 py-1 ${best ? "loop-bob bg-ink text-on-ink" : "bg-fill/70 text-secondary line-through"}`}
            >
              {price as string}
            </span>
          ))}
        </div>
      </Stage>

      <Stage tint={botColors.blue} className="sm:col-span-2 lg:col-span-6" title="Safe keeps money for its purpose" detail="Give a friend money for one thing. They snap the receipt to spend it, and only what's for that thing comes out, once. The rest comes back to you.">
        <Bot {...agents.safe} size={64} mood="awake" />
        <div className="flex w-[180px] flex-col gap-1.5 rounded-xl bg-[var(--color-raised)] p-3 text-[12px] shadow-sm" aria-hidden>
          {[["Dairy Milk", "$4.20", true], ["Dark chocolate", "$4.20", true], ["Phone charger", "$12.00", false]].map(([name, price, fits]) => (
            <span key={name as string} className={`flex justify-between gap-2 ${fits ? "" : "text-secondary line-through"}`}>
              <span>{fits ? "✓" : "✗"} {name as string}</span>
              <span className="tabular-nums">{price as string}</span>
            </span>
          ))}
          <span className="loop-bob mt-1 rounded-full bg-ink px-2 py-0.5 text-center text-on-ink">Paid $8.40</span>
        </div>
      </Stage>
    </div>
  );
}
