import type { ReactNode } from "react";
import { Bot } from "@/components/bot";
import { agents, friends } from "./data";
import { Doc } from "./lens";

// "Meet your agents": one card each, with a small looping demo of what it does.

function Stage({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[28px] bg-[var(--tile)]">
      <div className="flex h-52 items-center justify-center gap-5">{children}</div>
      <div className="px-6 pb-7">
        <h3 className="text-[21px] tracking-tight">{title}</h3>
        <p className="mt-1.5 text-[15px] leading-[1.45] text-secondary">{detail}</p>
      </div>
    </div>
  );
}

export function Agents() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stage title="Lens reads it" detail="Bills, receipts, price tags and tip jars. It pulls out who to pay, how much and by when.">
        <Bot {...agents.lens} size={64} mood="awake" />
        <div className="relative -rotate-3 rounded-md bg-[#2a2520] p-2">
          <Doc kind="bill" width={64} />
          <span className="loop-scan absolute inset-x-1 h-0.5 rounded-full bg-[#36D1DC] shadow-[0_0_10px_2px_rgba(54,209,220,0.7)]" />
        </div>
      </Stage>

      <Stage title="Autopilot runs your week" detail="It learns what you pay and when, plans the week ahead, and asks you once, on Sunday.">
        <Bot {...agents.autopilot} size={64} mood="awake" />
        <div className="flex w-[136px] flex-wrap justify-center gap-1.5" aria-hidden>
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i} className="loop-tick flex size-7 items-center justify-center rounded-lg bg-fill text-[10px]" style={{ animationDelay: `${i * 0.45}s` }}>
              {d}
            </span>
          ))}
        </div>
      </Stage>

      <Stage title="Splitter splits it" detail="Tick who had what. Everyone gets a PayPal request for their fair share, tax and tip included.">
        <Bot {...agents.splitter} size={64} mood="awake" />
        <div className="flex" aria-hidden>
          {friends.map((f, i) => (
            <span
              key={f.id}
              className={`flex h-24 w-9 flex-col items-center gap-1.5 bg-[#f2f2f7] pt-2.5 ${i === 0 ? "loop-part-left rounded-l-lg" : i === 2 ? "loop-part-right rounded-r-lg" : ""}`}
            >
              <Bot {...f} size={18} />
              {[20, 14, 18].map((w, j) => (
                <span key={j} className="h-1 rounded-full bg-[#d1d1d6]" style={{ width: w }} />
              ))}
            </span>
          ))}
        </div>
      </Stage>

      <Stage title="Nudge follows up" detail="Friendly reminders, written for each friend and what it was for, so you never have to chase.">
        <Bot {...agents.nudge} size={64} mood="speaking" />
        <div className="flex h-12 items-center gap-1" aria-hidden>
          {[0, 0.15, 0.3, 0.1, 0.25].map((d, i) => (
            <span key={i} className="loop-wave h-full w-1 rounded-full bg-ink" style={{ animationDelay: `${d}s` }} />
          ))}
        </div>
      </Stage>
    </div>
  );
}
