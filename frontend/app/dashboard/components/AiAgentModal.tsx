'use client';

import type { ChatMessage } from '@backend/ai';
import { ArrowUp, Check, LoaderCircle, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Logo } from '@/components/ui';
import { act, approveOnPayPal } from '@/lib/live';

// "Ask Flick" in Money Studio: a chat in the corner with Flick's agent (backend/src/agent.ts), the
// same one as the Ask Flick page. It reads your own Flick (your week, bills, friends, requests,
// payments) to answer, and asks before it does anything: each action it proposes waits for Approve,
// and anything that pays goes through Flick to pay. AG Studio's own assistant (studio/ai.ts) is the
// one that builds and changes the dashboard's pages.

type Pending = { id: string; summary: string };
type Link = { label: string; url: string };
type Turn = { messages: ChatMessage[]; reply?: string; pending?: Pending[]; links: Link[]; steps: string[] };
type Line = { from: 'you' | 'flick' | 'step'; text: string };

const STARTERS = ['Who owes me the most?', "What's Autopilot paying this week?", 'Anything out of the ordinary?'];

export function AiAgentModal() {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  // The conversation as the agent keeps it (tool calls included), and what's shown of it.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [lines, pending, busy]);

  const take = (turn: Turn) => {
    setMessages(turn.messages);
    setLines((l) => [...l, ...turn.steps.map((text) => ({ from: 'step' as const, text })), ...(turn.reply ? [{ from: 'flick' as const, text: turn.reply }] : [])]);
    setPending(turn.pending ?? []);
    setLinks(turn.links);
  };
  const run = async (work: () => Promise<Turn>) => {
    setBusy(true);
    try {
      take(await work());
    } catch (err) {
      setLines((l) => [...l, { from: 'flick', text: err instanceof Error ? err.message : String(err) }]);
    } finally {
      setBusy(false);
    }
  };

  const send = (text: string) => {
    const said = text.trim();
    if (!said || busy) return;
    setPrompt('');
    setLines((l) => [...l, { from: 'you', text: said }]);
    setPending([]);
    setLinks([]);
    void run(() => act<Turn>('agent', { messages: [...messages, { role: 'user', content: said }] }));
  };
  const decide = (yes: boolean) =>
    run(() => act<Turn>('agent/decide', { messages, decisions: Object.fromEntries(pending.map((p) => [p.id, yes])) }));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pressable fixed bottom-5 right-5 z-50 flex h-11 cursor-pointer items-center gap-2 rounded-full bg-ink px-4 text-[14px] text-on-ink shadow-[0_10px_30px_-8px_rgba(0,0,0,0.45)]"
      >
        <Sparkles size={16} aria-hidden /> Ask Flick
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Ask Flick"
      className="fixed bottom-5 right-5 z-50 flex h-[min(560px,calc(100dvh-2.5rem))] w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-[24px] bg-card text-ink shadow-2xl ring-1 ring-separator/60"
    >
      <div className="flex items-center gap-2.5 border-b border-separator/60 px-4 py-3">
        <Logo size={26} />
        <span className="flex-1">
          <span className="block text-[15px] font-semibold leading-5">Ask Flick</span>
          <span className="block text-[12px] text-secondary">About your own money. It asks before it does anything.</span>
        </span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="pressable cursor-pointer rounded-full p-1.5 text-secondary hover:bg-fill">
          <X size={18} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
        {!lines.length && (
          <div className="my-auto grid gap-2">
            <p className="text-center text-[13px] text-secondary">Ask about your bills, payments, friends or week.</p>
            {STARTERS.map((s) => (
              <button key={s} type="button" onClick={() => send(s)} className="pressable cursor-pointer rounded-full bg-fill px-3.5 py-2 text-left text-[13px]">
                {s}
              </button>
            ))}
          </div>
        )}
        {lines.map((line, i) =>
          line.from === 'step' ? (
            <p key={i} className="mx-auto w-fit rounded-full bg-fill/60 px-2.5 py-0.5 text-[11px] text-secondary">
              {line.text}
            </p>
          ) : (
            <p
              key={i}
              className={`max-w-[85%] whitespace-pre-wrap rounded-[18px] px-3 py-2 text-[14px] leading-5 ${line.from === 'you' ? 'ml-auto bg-ink text-on-ink' : 'mr-auto bg-fill'}`}
            >
              {line.text}
            </p>
          ),
        )}
        {pending.length > 0 && (
          <div className="rounded-2xl bg-tile p-3">
            <p className="text-[12px] text-secondary">Flick would like to:</p>
            <ul className="mt-1 grid gap-1 text-[14px]">
              {pending.map((p) => (
                <li key={p.id}>{p.summary}</li>
              ))}
            </ul>
            <div className="mt-2.5 flex gap-2">
              <button type="button" disabled={busy} onClick={() => void decide(true)} className="pressable flex h-8 cursor-pointer items-center gap-1 rounded-full bg-ink px-3.5 text-[13px] text-on-ink disabled:opacity-50">
                <Check size={14} /> Approve
              </button>
              <button type="button" disabled={busy} onClick={() => void decide(false)} className="pressable h-8 cursor-pointer rounded-full bg-fill px-3.5 text-[13px] disabled:opacity-50">
                No
              </button>
            </div>
          </div>
        )}
        {links.map((link) => (
          <button key={link.url} type="button" onClick={() => void approveOnPayPal(link.url)} className="pressable mr-auto h-9 cursor-pointer rounded-full bg-[#0070e0] px-4 text-[13px] font-medium text-white">
            {link.label}
          </button>
        ))}
        {busy && (
          <p className="flex items-center gap-1.5 text-[12px] text-secondary">
            <LoaderCircle size={13} className="spinner" /> Flick is looking…
          </p>
        )}
        <div ref={end} />
      </div>

      <form
        onSubmit={(e) => (e.preventDefault(), send(prompt))}
        className="flex items-center gap-2 border-t border-separator/60 p-3"
      >
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask Flick"
          aria-label="Ask Flick"
          className="h-10 min-w-0 flex-1 rounded-full bg-fill px-4 text-[14px] outline-none focus:ring-2 focus:ring-ink/20"
        />
        <button type="submit" disabled={busy || !prompt.trim()} aria-label="Send" className="pressable flex size-10 cursor-pointer items-center justify-center rounded-full bg-ink text-on-ink disabled:opacity-40">
          <ArrowUp size={18} />
        </button>
      </form>
    </div>
  );
}
