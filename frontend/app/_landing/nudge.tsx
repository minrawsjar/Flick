"use client";

import type { Debt } from "@backend/model";
import { Check, LoaderCircle, RefreshCw, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bot, type BotColor, type BotShape } from "@/components/bot";
import { Phone } from "@/components/phone";
import { Activity, Bubble, InputBar, Primary, Secondary, Speaking, Tile, useOnScreen, type Face } from "@/components/ui";
import { usd } from "@/lib/format";
import { act, daysSince, useLive, type LiveState } from "@/lib/live";
import { agents, owed, TONES, type Tone } from "./data";

// Nudge: who still owes you, and a reminder drafted for each of them in the tone you pick. Live,
// those are the backend's real requests: the draft comes from the AI model, and sending it is
// PayPal's own invoice reminder.

/** Nudge on the phone, typing out its draft. */
export function NudgeScreen({
  name,
  amount,
  what,
  days,
  tone,
  text,
  typed,
  sent,
}: {
  name: string;
  amount: number;
  what: string;
  days: number;
  tone: Tone;
  /** The draft; empty while it's being written. */
  text: string;
  typed: number;
  sent: boolean;
}) {
  const typing = !text || typed < text.length;
  return (
    <div className="flex h-full flex-col bg-page">
      <Speaking agent={agents.nudge} label={typing ? "Drafting" : "Nudge"} />
      <div className="flex flex-1 flex-col justify-end gap-2 overflow-hidden px-3">
        <Bubble from="agent">
          {name} owes you {usd(amount)} for {what}, {days} {days === 1 ? "day" : "days"} now. Here&apos;s a {tone.toLowerCase()} nudge:
        </Bubble>
        <Bubble from="you">
          {text ? text.slice(0, typed) : <LoaderCircle size={13} className="spinner" />}
          {text && typing && <span className="caret ml-px inline-block h-3 w-px translate-y-0.5 bg-on-ink" />}
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

type Debtor = { id: string; face: Face; name: string; amount: number; what: string; days: number; reminded: boolean; paid: boolean };

const demoDebtors: Debtor[] = owed.map((o) => ({ id: o.friend.id, face: o.friend, name: o.friend.name, amount: o.amount, what: o.what, days: o.days, reminded: false, paid: false }));

function liveDebtors(state: LiveState): Debtor[] {
  const order = (d: Debt) => (d.status === "requested" ? 0 : 1);
  return state.debts
    .filter((d) => d.status !== "cancelled")
    .sort((a, b) => order(a) - order(b))
    .map((d) => {
      const f = state.friends.find((x) => x.id === d.friendId);
      return {
        id: d.id,
        face: { color: (f?.color ?? "blue") as BotColor, shape: (f?.shape ?? "circle") as BotShape },
        name: f?.name ?? d.friendId,
        amount: d.amount,
        what: d.what,
        days: daysSince(d.createdAt),
        reminded: d.reminders > 0,
        paid: d.status === "paid",
      };
    });
}

export function Nudge() {
  const live = useLive();
  // What your friends owe you, even nothing yet. The sample requests are the one-pager's, or the
  // fallback when the backend is out of reach.
  const isLive = live.mode === "live";
  const debtors = live.mode === "demo" ? demoDebtors : live.state ? liveDebtors(live.state) : [];

  const [index, setIndex] = useState(0);
  const [tone, setTone] = useState<Tone>("Friendly");
  const [typed, setTyped] = useState(0);
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reminded, setReminded] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { text: string; by: string }>>({});
  const [error, setError] = useState<string>();
  const box = useRef<HTMLDivElement>(null);

  const who = debtors[Math.min(index, debtors.length - 1)];
  const key = who ? `${who.id}:${tone}` : "";
  const demoText = owed.find((o) => o.friend.id === who?.id)?.drafts[tone];
  const text = (isLive ? drafts[key]?.text : demoText) ?? "";
  const sent = Boolean(who && reminded.includes(who.id));
  const whoId = who?.id;
  const hasDraft = Boolean(drafts[key]);

  useOnScreen(box, () => setStarted(true));

  // Live: ask the backend (the AI model, or a template when AI is off) for this friend and tone.
  // Keyed on ids, not objects: every state refresh rebuilds the debtor list.
  useEffect(() => {
    if (!started || !isLive || !whoId || hasDraft) return;
    let stale = false;
    act<{ text: string; by: string }>("nudge/draft", { debtId: whoId, tone })
      .then((draft) => !stale && setDrafts((all) => ({ ...all, [key]: draft })))
      .catch((err) => !stale && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      stale = true;
    };
  }, [started, isLive, whoId, key, tone, hasDraft]);

  // Types the draft out, a couple of characters at a time.
  useEffect(() => {
    if (!started || !text || typed >= text.length) return;
    const t = setTimeout(() => setTyped((n) => n + 2), 22);
    return () => clearTimeout(t);
  }, [started, typed, text]);

  const pick = (i: number, t: Tone) => {
    setIndex(i);
    setTone(t);
    setTyped(0);
    setError(undefined);
  };

  const send = async () => {
    if (!who) return;
    setBusy(true);
    setError(undefined);
    try {
      if (isLive) await act("nudge/send", { debtId: who.id, text });
      else await new Promise((resolve) => setTimeout(resolve, 900));
      setReminded((r) => [...r, who.id]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const checkPaid = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await act("debts/refresh");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  // Inside `box`, so Nudge starts once it's seen, and drafts as soon as someone owes you.
  if (!who)
    return (
      <div ref={box}>
        <Tile className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
          <Bot {...agents.nudge} size={40} mood="idle" />
          <p className="text-[15px]">{live.mode === "loading" ? "Loading…" : "Nobody owes you anything right now."}</p>
          {live.mode !== "loading" && (
            <>
              <p className="text-[13px] leading-[1.45] text-secondary">Split a bill with your friends, and anyone who hasn&apos;t paid shows up here, for Nudge to remind.</p>
              <Link href="/split" className="pressable flex h-10 items-center rounded-full bg-ink px-4 text-[14px] text-on-ink">
                Split a bill
              </Link>
            </>
          )}
        </Tile>
      </div>
    );

  return (
    <div ref={box} className="grid grid-cols-1 items-center justify-items-center gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:justify-items-stretch">
      <Phone width={262} background="var(--color-page)">
        <NudgeScreen name={who.name} amount={who.amount} what={who.what} days={who.days} tone={tone} text={text} typed={typed} sent={sent} />
      </Phone>

      <div className="grid w-full min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
        <Tile>
          <p className="flex items-center justify-between text-[13px] text-secondary">
            Who owes you
            {isLive && (
              <button type="button" onClick={() => void checkPaid()} disabled={busy} className="pressable flex cursor-pointer items-center gap-1 rounded-full bg-raised px-2.5 py-0.5 text-[12px] text-ink">
                <RefreshCw size={12} /> Check who&apos;s paid
              </button>
            )}
          </p>
          <div className="mt-2 divide-y divide-separator/50">
            {debtors.map((d, i) => (
              <button
                key={d.id}
                type="button"
                aria-pressed={d === who}
                onClick={() => pick(i, tone)}
                className="pressable flex w-full cursor-pointer items-center gap-3 py-2 text-left"
              >
                <Bot {...d.face} size={34} mood={reminded.includes(d.id) || d.paid ? "awake" : "idle"} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[15px]">
                    {d.name}
                    {d === who && <span className="size-1.5 rounded-full bg-ink" />}
                  </span>
                  <span className="block truncate text-[12px] text-secondary">
                    {d.paid ? (
                      <span className="text-paid">Paid you back</span>
                    ) : reminded.includes(d.id) ? (
                      <span className="text-paid">Reminded just now</span>
                    ) : (
                      `For ${d.what} · ${d.days} ${d.days === 1 ? "day" : "days"}${d.reminded ? " · reminded before" : ""}`
                    )}
                  </span>
                </span>
                <span className="tabular-nums">{usd(d.amount)}</span>
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
            {isLive
              ? drafts[key]?.by === "template"
                ? "AI is off, so this one is from a template. Nothing is sent until you tap."
                : "Written by the AI model for this friend and what it was for. Nothing is sent until you tap."
              : "Nudge writes each reminder for the person and what it was for. Nothing is sent until you tap."}
          </p>
          {error && <p className="mt-2 text-[12px] leading-4 text-wait">{error}</p>}
          <div className="mt-auto flex gap-2 pt-4">
            {who.paid ? (
              <p className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-paid/15 text-[13px] text-paid">
                <Check size={15} /> {who.name} has paid
              </p>
            ) : sent ? (
              <p className="rise flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-paid/15 text-[13px] text-paid">
                <Check size={15} /> Reminder sent to {who.name}
              </p>
            ) : (
              <Primary onClick={() => void send()} disabled={busy || !text || typed < text.length} className="flex-1">
                {busy ? <LoaderCircle size={14} className="spinner" /> : <Send size={14} />} Send to {who.name}
              </Primary>
            )}
            <Secondary onClick={() => pick(index, TONES[(TONES.indexOf(tone) + 1) % TONES.length])}>Redraft</Secondary>
          </div>
        </Tile>
      </div>
    </div>
  );
}
