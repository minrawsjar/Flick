"use client";

import { AudioLines, Mic } from "lucide-react";
import { useEffect, useEffectEvent, useId, useRef, useState, type ReactNode } from "react";
import { usd } from "@/lib/format";
import { mark } from "@/lib/mark";
import { Bot, botColors, type BotColor, type BotShape } from "./bot";

// Building blocks ported from Air Agents (web/src/Screens.tsx, Payments.tsx and App.tsx, MIT).
// Phone-scale pieces first (they render inside <Phone> at 262px), then page-scale ones.

export type Face = { color: BotColor; shape: BotShape };

/**
 * Flick's logo: the app icon, small, its fingertip flicking every few seconds (lib/mark.tsx). Black
 * in both themes, like an app icon; in dark, a hairline (ink is white there) keeps it off the page.
 */
export function Logo({ size = 24 }: { size?: number }) {
  // Each logo's own gradient id (React's ids carry characters a url(#…) reference can't).
  const id = `mark${useId().replace(/[^\w-]/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="shrink-0 overflow-hidden rounded-[29%] ring-1 ring-ink/15" aria-hidden>
      <rect width="64" height="64" fill="#000" />
      {mark(true, id)}
    </svg>
  );
}


export function Title({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 pb-2 pt-1">
      <h4 className="text-[26px] font-semibold tracking-tight">{children}</h4>
      {right}
    </div>
  );
}

export function Group({ children }: { children: ReactNode }) {
  return <div className="mx-3 divide-y divide-separator/50 rounded-card bg-card">{children}</div>;
}

export function Bubble({ from, children }: { from: "you" | "agent"; children: ReactNode }) {
  return from === "you" ? (
    <p className="ml-auto max-w-[82%] rounded-[17px] bg-ink px-3 py-2 text-[13px] leading-[18px] text-on-ink">{children}</p>
  ) : (
    <p className="mr-auto max-w-[82%] rounded-[17px] bg-fill px-3 py-2 text-[13px] leading-[18px]">{children}</p>
  );
}

export function Activity({ children }: { children: ReactNode }) {
  return <p className="rise mx-auto w-fit rounded-full bg-fill/50 px-2.5 py-1 text-[11px] text-secondary">{children}</p>;
}

export function InputBar() {
  return (
    <div className="flex items-center gap-2 px-3 pb-5 pt-2">
      <span className="flex h-9 flex-1 items-center rounded-full border border-separator px-3 text-[13px] text-secondary">Message</span>
      <span className="flex size-9 items-center justify-center rounded-full bg-ink text-on-ink">
        <Mic size={16} />
      </span>
    </div>
  );
}

export function Speaking({ agent, label = "Speaking" }: { agent: Face; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 pb-2">
      <Bot {...agent} mood="speaking" size={56} />
      <span className="flex items-center gap-1 text-[12px] text-secondary">
        <AudioLines size={13} /> {label}
      </span>
    </div>
  );
}

export function Row({ lead, title, sub, end }: { lead: ReactNode; title: ReactNode; sub: ReactNode; end?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      {lead}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] leading-[18px]">{title}</p>
        <p className="flex items-center gap-1 truncate text-[12px] leading-4 text-secondary">{sub}</p>
      </div>
      <span className="flex shrink-0 items-center gap-1 text-[13px] text-secondary">{end}</span>
    </div>
  );
}

export function Meter({ label, used, of }: { label: string; used: number; of: number }) {
  const over = used > of;
  return (
    <div>
      <p className="flex justify-between text-[13px]">
        <span className="text-secondary">{label}</span>
        <span className="tabular-nums">
          {usd(used)} of {usd(of)}
        </span>
      </p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fill">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.min(100, (used / of) * 100)}%`, background: over ? "#ff9500" : "var(--color-ink)" }}
        />
      </div>
    </div>
  );
}

/** Black capsule: the one main action. */
export function Primary({
  children,
  onClick,
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`pressable flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-ink px-4 text-[13px] text-on-ink disabled:cursor-default disabled:bg-ink/25 ${className}`}
    >
      {children}
    </button>
  );
}

/** Grey capsule: secondary actions. */
export function Secondary({
  children,
  onClick,
  disabled,
  label,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** For icon-only buttons. */
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`pressable flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-fill px-4 text-[13px] disabled:cursor-default disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

/** Fades its children in the first time they scroll into view. */
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const watch = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          watch.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    watch.observe(box.current!);
    return () => watch.disconnect();
  }, []);

  return <div ref={box} className={`reveal ${seen ? "seen" : ""} ${className}`}>{children}</div>;
}

/** Runs `start` once, the first time `box` is a third on screen: demos play when you reach them. */
export function useOnScreen(box: React.RefObject<HTMLElement | null>, start: () => void) {
  const onSeen = useEffectEvent(start);
  useEffect(() => {
    const seen = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          onSeen();
          seen.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    seen.observe(box.current!);
    return () => seen.disconnect();
  }, [box]);
}

/** A soft blurred blob of colour, for glows behind phones and headlines. */
export function Glow({ color, opacity = 0.3, className = "" }: { color: string; opacity?: number; className?: string }) {
  return <span aria-hidden className={`pointer-events-none absolute rounded-full blur-3xl ${className}`} style={{ background: color, opacity }} />;
}

export function Section({
  id,
  tone,
  label,
  title,
  intro,
  compact = false,
  agent,
  glow,
  children,
}: {
  id: string;
  tone: "white" | "grey";
  label: string;
  title: string;
  intro: string;
  compact?: boolean;
  /** Whose section it is: their face sits by the label, and their colour glows behind the demo. */
  agent?: Face;
  /** Which side of the demo the glow sits on (where its phone is). */
  glow?: "left" | "right";
  children: ReactNode;
}) {
  return (
    // The app-section* classes: the working pages' phone layout (app/globals.css).
    <section id={id} className={`app-section tone-${tone} overflow-hidden px-4 sm:px-6 ${compact ? "py-16 lg:py-14" : "py-24 sm:py-36"}`}>
      <div className="mx-auto max-w-6xl">
        <Reveal className={`app-section-head mx-auto text-center ${compact ? "max-w-4xl" : "max-w-3xl"}`}>
          <p className={`flex items-center justify-center gap-2 text-secondary ${compact ? "text-[15px]" : "text-[17px] sm:text-[19px]"}`}>
            {agent && <Bot {...agent} size={24} mood="awake" />}
            {label}
          </p>
          <h2 className={`mt-1 leading-[1.07] tracking-[-0.022em] text-balance ${compact ? "text-[34px] sm:text-[44px]" : "text-[40px] sm:text-[64px]"}`}>{title}</h2>
          <p className={`mx-auto text-secondary text-pretty ${compact ? "mt-2 max-w-3xl text-[17px] leading-[1.4]" : "mt-5 max-w-2xl text-[19px] leading-[1.45] sm:text-[21px]"}`}>
            {intro}
          </p>
        </Reveal>
        <Reveal className={`app-section-body relative ${compact ? "mt-8 lg:mt-10" : "mt-14 sm:mt-20"}`}>
          {agent && glow && (
            <Glow
              color={botColors[agent.color]}
              className={`top-1/2 size-[460px] -translate-y-1/2 ${glow === "left" ? "-left-24" : "-right-24"}`}
            />
          )}
          <div className="relative">{children}</div>
        </Reveal>
      </div>
    </section>
  );
}

/** A rounded tile on a section, in the opposite tone. */
export function Tile({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[28px] bg-[var(--tile)] p-5 ${className}`}>{children}</div>;
}

/** A payment's lifecycle, step by step; steps up to `at` light up. */
export function Wire({ steps, at }: { steps: readonly (readonly [string, string])[]; at: number }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {steps.map(([stage, what], i) => (
        <li key={stage} className={`rounded-2xl p-3 transition-colors duration-300 ${at >= i ? "bg-ink text-on-ink" : "bg-raised text-secondary"}`}>
          <p className="text-[13px] font-medium leading-4">
            <span className="tabular-nums opacity-60">{i + 1}.</span> {stage}
          </p>
          <p className={`mt-1 text-[12px] leading-4 ${at >= i ? "text-on-ink/70" : ""}`}>{what}</p>
        </li>
      ))}
    </ol>
  );
}
