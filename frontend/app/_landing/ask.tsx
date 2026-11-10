"use client";

import type { ChatMessage } from "@backend/ai";
import { ArrowUp, Check, CircleCheck, LoaderCircle, ShieldCheck, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Bot } from "@/components/bot";
import { Phone } from "@/components/phone";
import { Activity, Bubble, Tile, useOnScreen } from "@/components/ui";
import { act, approveOnPayPal, useLive } from "@/lib/live";
import { agents } from "./data";

// Ask Flick: one conversation that reaches all four agents. The AI reads your real data, plans,
// and proposes actions; nothing runs until you approve it (backend/src/agent.ts). The one-pager
// shows a scripted version of the same thing (AskDemo).

type Pending = { id: string; summary: string };
type Link = { label: string; url: string };
type Turn = { messages: ChatMessage[]; reply?: string; pending?: Pending[]; links: Link[]; steps: string[] };

/** The four agents, side by side: Flick's own face. */
export function Crew({ size = 28 }: { size?: number }) {
  return (
    <span className="flex -space-x-1.5">
      {Object.values(agents).map((a) => (
        <Bot key={a.name} {...a} size={size} mood="awake" />
      ))}
    </span>
  );
}

/** The model writes **bold** now and then; show it as bold, and nothing else as markup. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}
    </>
  );
}

function ApprovalCard({ pending, choices, onChoose, onConfirm, busy }: { pending: Pending[]; choices: Record<string, boolean>; onChoose: (id: string, yes: boolean) => void; onConfirm: () => void; busy: boolean }) {
  const yes = pending.filter((p) => choices[p.id]).length;
  return (
    <div className="rise mr-auto w-full max-w-[90%] rounded-2xl bg-card p-3 shadow-[0_6px_24px_-10px_rgba(0,0,0,0.25)] ring-1 ring-separator/40">
      <p className="flex items-center gap-1.5 text-[12px] text-secondary">
        <ShieldCheck size={14} /> Needs your OK
      </p>
      <ul className="mt-2 divide-y divide-separator/40">
        {pending.map((p) => (
          <li key={p.id} className="flex items-center gap-2 py-2 text-[14px] leading-5">
            <span className="flex-1">{p.summary}</span>
            <button type="button" aria-label="No" onClick={() => onChoose(p.id, false)} className={`pressable flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full ${choices[p.id] ? "bg-fill text-secondary" : "bg-danger/15 text-danger"}`}>
              <X size={15} />
            </button>
            <button type="button" aria-label="Yes" onClick={() => onChoose(p.id, true)} className={`pressable flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full ${choices[p.id] ? "bg-ink text-on-ink" : "bg-fill text-secondary"}`}>
              <Check size={15} />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onConfirm} disabled={busy} className="pressable mt-2 flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-ink text-[14px] text-on-ink disabled:opacity-50">
        {busy ? <LoaderCircle size={15} className="spinner" /> : <Check size={15} />}
        {yes ? `Go ahead with ${yes === pending.length ? (yes === 1 ? "it" : `all ${yes}`) : `${yes} of ${pending.length}`}` : "Do none of these"}
      </button>
    </div>
  );
}

const suggestions = [
  "What's happening with my money this week?",
  "Split my last receipt with Maya and Leo",
  "Remind everyone who owes me, nicely",
  "Skip the coffee tip and approve the week",
];

/** The live conversation, on /ask. */
export function Ask() {
  const live = useLive();
  const ready = live.mode === "live" && Boolean(live.state?.config.ai);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [choices, setChoices] = useState<Record<string, boolean>>({});
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [links, setLinks] = useState<Link[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const end = useRef<HTMLDivElement>(null);

  // A block body on purpose: scrollIntoView returns a promise in newer browsers, and an effect may only return its cleanup.
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, pending, busy]);

  const take = (turn: Turn) => {
    setMessages(turn.messages);
    setPending(turn.pending ?? []);
    setChoices(Object.fromEntries((turn.pending ?? []).map((p) => [p.id, true])));
    setSummaries((all) => ({ ...all, ...Object.fromEntries((turn.pending ?? []).map((p) => [p.id, p.summary])) }));
    if (turn.links.length) setLinks(turn.links);
  };

  const run = async (work: () => Promise<Turn>) => {
    setBusy(true);
    setError(undefined);
    try {
      take(await work());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const send = (say: string) => {
    const content = say.trim();
    if (!content || busy) return;
    setText("");
    setLinks([]);
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setPending([]);
    void run(() => act<Turn>("agent", { messages: next }));
  };

  const confirm = () => void run(() => act<Turn>("agent/decide", { messages, decisions: choices }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(text);
  };

  // What to show: your words, Flick's words, what it looked at, and what happened to each action.
  const shown: ReactNode[] = [];
  messages.forEach((m, i) => {
    if (m.role === "user") shown.push(<Bubble key={i} from="you">{m.content}</Bubble>);
    if (m.role === "assistant") {
      if (m.tool_calls?.some((c) => c.function.name === "get_overview")) shown.push(<Activity key={`${i}r`}>Read your week, scans, friends and requests</Activity>);
      if (m.content?.trim())
        shown.push(
          <Bubble key={i} from="agent">
            <span className="whitespace-pre-line">
              <Rich text={m.content.trim()} />
            </span>
          </Bubble>,
        );
    }
    if (m.role === "tool" && summaries[m.tool_call_id]) {
      const outcome = JSON.parse(m.content) as { done?: boolean; declined?: string; error?: string };
      shown.push(
        <Activity key={i}>
          {outcome.done ? "✓ " : outcome.declined ? "✗ Skipped: " : "⚠ Couldn't: "}
          {summaries[m.tool_call_id]}
          {outcome.error ? ` (${outcome.error})` : ""}
        </Activity>,
      );
    }
  });

  return (
    <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <Tile className="flex h-[min(680px,calc(100dvh-220px))] min-h-[460px] flex-col !p-0">
        <div className="flex items-center gap-3 border-b border-separator/40 px-5 py-3">
          <Crew size={26} />
          <div className="min-w-0">
            <p className="text-[15px]">Flick</p>
            <p className="truncate text-[12px] text-secondary">Lens, Autopilot, Splitter and Nudge, in one conversation</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
          {!messages.length && (
            <div className="m-auto max-w-md text-center">
              <Sparkles size={22} className="mx-auto text-secondary" />
              <p className="mt-2 text-[17px]">Ask Flick to do something with your money.</p>
              <p className="mt-1 text-[13px] leading-5 text-secondary">It reads your real week, scans, friends and requests, then proposes what to do. Nothing happens until you say yes.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button key={s} type="button" disabled={!ready || busy} onClick={() => send(s)} className="pressable cursor-pointer rounded-full bg-raised px-3 py-1.5 text-[13px] ring-1 ring-separator/50 disabled:opacity-50">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {shown}
          {pending.length > 0 && <ApprovalCard pending={pending} choices={choices} onChoose={(id, yes) => setChoices((c) => ({ ...c, [id]: yes }))} onConfirm={confirm} busy={busy} />}
          {links.map((l) => (
            <button key={l.url} type="button" onClick={() => void approveOnPayPal(l.url, { amount: Number(/\$([\d.]+)/.exec(l.label)?.[1]) || undefined })} className="pressable rise mr-auto flex cursor-pointer items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[14px] text-on-ink">
              <CircleCheck size={15} /> {l.label}
            </button>
          ))}
          {busy && (
            <p className="flex items-center gap-1.5 text-[12px] text-secondary">
              <LoaderCircle size={13} className="spinner" /> Flick is thinking…
            </p>
          )}
          {error && <p className="text-[12px] text-wait">{error}</p>}
          <div ref={end} />
        </div>

        <form onSubmit={submit} className="flex items-center gap-2 border-t border-separator/40 p-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={ready ? (pending.length ? "Answer the card above first" : "Ask Flick…") : "Flick needs the live backend with AI turned on"}
            disabled={!ready || busy || pending.length > 0}
            maxLength={2000}
            className="h-11 flex-1 rounded-full bg-raised px-4 text-[15px] outline-none ring-1 ring-separator/60 focus:ring-2 focus:ring-ink disabled:opacity-60"
          />
          <button type="submit" aria-label="Send" disabled={!ready || busy || pending.length > 0 || !text.trim()} className="pressable flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-ink text-on-ink disabled:opacity-40">
            <ArrowUp size={18} />
          </button>
        </form>
      </Tile>

      <div className="grid content-start gap-3">
        {[
          ["Reads your real data", "Your week, what Lens read, who owes you and your usual amounts, so it can spot what's odd."],
          ["Plans across agents", "One request can pay a bill, split a receipt and remind a friend: Lens, Autopilot, Splitter and Nudge working together."],
          ["You say yes to every action", "Each action waits for your OK. Payments still go through PayPal's own approval."],
        ].map(([title, body]) => (
          <Tile key={title} className="!p-4">
            <p className="text-[15px]">{title}</p>
            <p className="mt-1 text-[13px] leading-5 text-secondary">{body}</p>
          </Tile>
        ))}
      </div>
    </div>
  );
}

// --- The one-pager's scripted version -----------------------------------------------------

const script: { at: number; node: ReactNode }[] = [
  { at: 0, node: <Bubble from="you">Split last night&apos;s sushi with Maya and Leo, and remind Leo about the cab.</Bubble> },
  { at: 900, node: <Activity>Read your week, scans, friends and requests</Activity> },
  { at: 1800, node: <Bubble from="agent">Here&apos;s the plan. Leo&apos;s cab has been open 14 days, so I&apos;ll keep it light:</Bubble> },
  {
    at: 2700,
    node: (
      <div className="rise mr-auto w-[92%] rounded-2xl bg-card p-2.5 text-[12px] leading-4 shadow-[0_6px_20px_-10px_rgba(0,0,0,0.3)] ring-1 ring-separator/40">
        <p className="flex items-center gap-1 text-[11px] text-secondary">
          <ShieldCheck size={12} /> Needs your OK
        </p>
        <p className="mt-1.5 flex items-center gap-1.5">
          <Check size={13} className="shrink-0" /> Invoice Maya $18.56 and Leo $24.58 for Nori Sushi
        </p>
        <p className="mt-1 flex items-center gap-1.5">
          <Check size={13} className="shrink-0" /> Send Leo a friendly reminder about the cab, $27.00
        </p>
        <p className="mt-2 rounded-full bg-ink py-1.5 text-center text-[12px] text-on-ink">Go ahead with both</p>
      </div>
    ),
  },
  { at: 4200, node: <Activity>✓ Sent PayPal invoices to Maya and Leo</Activity> },
  { at: 4800, node: <Activity>✓ Reminded Leo about the airport cab</Activity> },
  { at: 5600, node: <Bubble from="agent">Done. Leo now owes $51.58 in all; I&apos;ll check on Friday.</Bubble> },
];

/** Ask Flick on the one-pager: the same flow, played out. */
export function AskDemo() {
  const [shown, setShown] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  useOnScreen(box, () => script.forEach((step, i) => setTimeout(() => setShown(i + 1), step.at + 300)));

  return (
    <div ref={box} className="grid items-center justify-items-center gap-6 lg:grid-cols-[auto_1fr] lg:justify-items-stretch">
      <Phone width={262} background="var(--color-page)">
        <div className="flex h-full flex-col bg-page">
          <div className="flex flex-col items-center gap-1 pb-2">
            <Crew size={30} />
            <span className="text-[12px] text-secondary">Flick</span>
          </div>
          <div className="flex flex-1 flex-col justify-end gap-2 overflow-hidden px-3 pb-5 [mask-image:linear-gradient(to_bottom,transparent,black_28px)]">
            {script.slice(0, shown).map((step, i) => (
              <div key={i} className="rise flex flex-col">
                {step.node}
              </div>
            ))}
          </div>
        </div>
      </Phone>
      <div className="grid w-full min-w-0 gap-3 md:grid-cols-3">
        {[
          ["Reads your real data", "Your week, what Lens read, who owes you and your usual amounts, so it can spot what's odd."],
          ["Plans across agents", "One sentence becomes a split, invoices and a reminder: Lens, Autopilot, Splitter and Nudge working together."],
          ["You say yes to every action", "Nothing runs until you approve it, and payments still go through PayPal's own approval."],
        ].map(([title, body]) => (
          <Tile key={title}>
            <p className="text-[15px]">{title}</p>
            <p className="mt-1 text-[13px] leading-5 text-secondary">{body}</p>
          </Tile>
        ))}
      </div>
    </div>
  );
}
