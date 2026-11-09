"use client";

import { Check, LoaderCircle, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Bot } from "@/components/bot";
import { Phone } from "@/components/phone";
import { Activity, Bubble, InputBar, Primary, Secondary, Speaking, Tile, useOnScreen } from "@/components/ui";
import { usd } from "@/lib/format";
import { agents, owed, TONES, type Owed, type Tone } from "./data";

// Nudge: who still owes you, and a reminder drafted for each of them in the tone you pick.

/** Nudge on the phone, typing out its draft. */
export function NudgeScreen({ who, tone, typed, sent }: { who: Owed; tone: Tone; typed: number; sent: boolean }) {
  const draft = who.drafts[tone];
  const typing = typed < draft.length;
  return (
    <div className="flex h-full flex-col bg-page">
      <Speaking agent={agents.nudge} label={typing ? "Drafting" : "Nudge"} />
      <div className="flex flex-1 flex-col justify-end gap-2 overflow-hidden px-3">
        <Bubble from="agent">
          {who.friend.name} owes you {usd(who.amount)} for {who.what}, {who.days} days now. Here&apos;s a {tone.toLowerCase()} nudge:
        </Bubble>
        <Bubble from="you">
          {draft.slice(0, typed)}
          {typing && <span className="caret ml-px inline-block h-3 w-px translate-y-0.5 bg-on-ink" />}
        </Bubble>
        {sent && (
          <>
            <Activity>Sent with a PayPal link</Activity>
            <Bubble from="agent">I&apos;ll check back on Friday if it&apos;s still open.</Bubble>
          </>
        )}
      </div>
      <InputBar />
    </div>
  );
}

export function Nudge() {
  const [index, setIndex] = useState(0);
  const [tone, setTone] = useState<Tone>("Friendly");
  const [typed, setTyped] = useState(0);
  const [started, setStarted] = useState(false);
  const [sending, setSending] = useState(false);
  const [reminded, setReminded] = useState<string[]>([]);
  const box = useRef<HTMLDivElement>(null);

  const who = owed[index];
  const draft = who.drafts[tone];
  const sent = reminded.includes(who.friend.id);

  useOnScreen(box, () => setStarted(true));

  // Types the draft out, a couple of characters at a time.
  useEffect(() => {
    if (!started || typed >= draft.length) return;
    const t = setTimeout(() => setTyped((n) => n + 2), 22);
    return () => clearTimeout(t);
  }, [started, typed, draft]);

  const pick = (i: number, t: Tone) => {
    setIndex(i);
    setTone(t);
    setTyped(0);
  };

  const send = () => {
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setReminded((r) => [...r, who.friend.id]);
    }, 900);
  };

  return (
    <div ref={box} className="grid items-center justify-items-center gap-6 lg:grid-cols-[auto_1fr] lg:justify-items-stretch">
      <Phone width={262} background="var(--color-page)">
        <NudgeScreen who={who} tone={tone} typed={typed} sent={sent} />
      </Phone>

      <div className="grid w-full min-w-0 gap-3 md:grid-cols-2">
        <Tile>
          <p className="text-[13px] text-secondary">Who owes you</p>
          <div className="mt-2 divide-y divide-separator/50">
            {owed.map((o, i) => (
              <button
                key={o.friend.id}
                type="button"
                aria-pressed={i === index}
                onClick={() => pick(i, tone)}
                className="pressable flex w-full cursor-pointer items-center gap-3 py-2 text-left"
              >
                <Bot {...o.friend} size={34} mood={reminded.includes(o.friend.id) ? "awake" : "idle"} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[15px]">
                    {o.friend.name}
                    {i === index && <span className="size-1.5 rounded-full bg-ink" />}
                  </span>
                  <span className="block truncate text-[12px] text-secondary">
                    {reminded.includes(o.friend.id) ? (
                      <span className="text-paid">Reminded just now</span>
                    ) : (
                      `For ${o.what} · ${o.days} ${o.days === 1 ? "day" : "days"}`
                    )}
                  </span>
                </span>
                <span className="tabular-nums">{usd(o.amount)}</span>
              </button>
            ))}
          </div>
        </Tile>

        <Tile className="flex flex-col">
          <p className="text-[13px] text-secondary">In your voice</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {TONES.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={t === tone}
                onClick={() => pick(index, t)}
                className={`pressable h-9 cursor-pointer rounded-full px-4 text-[13px] transition-colors ${t === tone ? "bg-ink text-on-ink" : "bg-raised"}`}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[13px] leading-5 text-secondary">
            Nudge writes each reminder for the person and what it was for. Nothing is sent until you tap.
          </p>
          <div className="mt-auto flex gap-2 pt-4">
            {sent ? (
              <p className="rise flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-paid/15 text-[13px] text-paid">
                <Check size={15} /> Reminder sent to {who.friend.name}
              </p>
            ) : (
              <Primary onClick={send} disabled={sending || typed < draft.length} className="flex-1">
                {sending ? <LoaderCircle size={14} className="spinner" /> : <Send size={14} />} Send to {who.friend.name}
              </Primary>
            )}
            <Secondary onClick={() => pick(index, TONES[(TONES.indexOf(tone) + 1) % TONES.length])}>Redraft</Secondary>
          </div>
        </Tile>
      </div>
    </div>
  );
}
