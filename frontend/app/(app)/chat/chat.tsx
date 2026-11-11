"use client";

import type { ChatMessage, ChatPeer, Debt, Scan } from "@backend/model";
import { ArrowLeft, ArrowUpRight, BellRing, Camera, CircleCheck, DollarSign, LoaderCircle, SendHorizontal, UserPlus, X, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Bot, type BotColor, type BotShape } from "@/components/bot";
import { checkChats } from "@/components/chat-alerts";
import { Notify } from "@/components/pwa";
import { Logo } from "@/components/ui";
import { usd } from "@/lib/format";
import { act, flickToPay, useLive } from "@/lib/live";
import { forLens } from "@/app/_landing/lens";

// Flick Chat: you and your friends, signed in with PayPal. Talk, ask for money (with a bill's photo,
// read by Lens), and pay a request with a flick, from the PayPal you signed in with. A friend can
// let your requests pay by themselves, up to an amount. Friends not on Flick yet still get requests,
// as PayPal invoices by email. The backend is backend/src/chat.ts; the page polls it while open.

type Me = { email: string; name: string };
type Chat = { peer: ChatPeer; last?: ChatMessage; unread: number; youOwe: number; owedToYou: number };
type Thread = { v: number; same?: true; me: Me; peer: ChatPeer; messages: ChatMessage[]; autopay: { mine: number; theirs: number } };

const CAPS = [0, 10, 25, 50, 100];

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api/${path}`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? `Flick's backend answered ${res.status}.`);
  return data as T;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));
const face = (peer: ChatPeer) => ({ color: peer.color as BotColor, shape: peer.shape as BotShape });
const clock = (iso: string) => {
  const d = new Date(iso);
  return Date.now() - d.getTime() < 86_400_000 ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" });
};

/** Runs `load` now and every `ms` while the tab is visible. */
function usePoll(load: () => unknown, ms: number) {
  useEffect(() => {
    void load();
    const timer = setInterval(() => document.visibilityState === "visible" && void load(), ms);
    return () => clearInterval(timer);
  }, [load, ms]);
}

/** A chat's last message, in a line. */
function preview(m: ChatMessage, me: string, peer: ChatPeer) {
  const who = m.from === me ? "You" : peer.name;
  if (m.kind === "request") return `${who} asked for ${usd(m.amount ?? 0)}: ${m.what}`;
  if (m.kind === "paid") return `${who} paid ${usd(m.amount ?? 0)}${m.auto ? ", by itself" : ""}`;
  if (m.kind === "reminder") return `Reminder: ${m.text}`;
  return m.from === me && m.kind === "text" ? `You: ${m.text}` : (m.text ?? "");
}

export function ChatApp() {
  const live = useLive();
  const params = useSearchParams();
  const router = useRouter();
  const open = params.get("with");
  const select = useCallback((email: string | null) => router.replace(email ? `/chat?with=${encodeURIComponent(email)}` : "/chat", { scroll: false }), [router]);

  if (live.mode === "loading") return <Frame><Centered><LoaderCircle size={20} className="spinner text-secondary" /></Centered></Frame>;
  if (live.mode !== "live") {
    return (
      <Frame>
        <Centered>Flick Chat needs Flick&apos;s backend, which isn&apos;t answering just now.</Centered>
      </Frame>
    );
  }
  if (!live.state?.profile) return <SignInFirst />;
  return <Messenger open={open} select={select} />;
}

/** The page's box: the screen's height under the bar (and above the tab bar on a phone). */
function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-180px)] max-w-6xl gap-3 px-3 pt-2 sm:px-6 lg:h-[calc(100dvh-72px)] lg:px-8 lg:py-3 min-[1280px]:max-w-7xl">
      {children}
    </div>
  );
}

const Centered = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-[24px] bg-card p-8 text-center text-[15px] text-secondary">{children}</div>
);

function SignInFirst() {
  return (
    <Frame>
      <Centered>
        <Logo size={44} />
        <h1 className="text-[28px] leading-tight tracking-tight text-ink">Flick Chat</h1>
        <p className="max-w-md leading-6">
          Talk with friends, send a bill&apos;s photo, ask for money, and pay each other with a flick. Your friends find you by the PayPal you sign in
          with, and that&apos;s where their money goes.
        </p>
        <Link href="/login?next=/chat" className="pressable mt-2 rounded-full bg-ink px-5 py-2.5 text-[15px] text-on-ink">
          Sign in with PayPal
        </Link>
        <Link href="/split" className="text-[13px] text-secondary underline-offset-2 hover:underline">
          Or split a bill without signing in
        </Link>
      </Centered>
    </Frame>
  );
}

function Messenger({ open, select }: { open: string | null; select: (email: string | null) => void }) {
  const [list, setList] = useState<{ me: Me; chats: Chat[] } | null>(null);
  const [error, setError] = useState<string>();
  const load = useCallback(
    () =>
      get<{ me: Me; chats: Chat[] }>("chat").then(
        (next) => (setList(next), setError(undefined)),
        (err) => setError(message(err)),
      ),
    [],
  );
  usePoll(load, 5000);

  return (
    <Frame>
      <aside aria-label="Your chats" className={`${open ? "hidden lg:flex" : "flex"} min-h-0 w-full flex-col overflow-hidden rounded-[24px] bg-card lg:w-[320px] lg:shrink-0`}>
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <h1 className="text-[22px] tracking-tight">Chats</h1>
          <span className="flex items-start gap-1.5">
            {/* Notifications for messages, requests and payments when Flick is closed (push.ts). */}
            <Notify />
            <Link href="/friends" className="pressable flex h-8 items-center gap-1 rounded-full bg-fill px-3 text-[12px]">
              <UserPlus size={13} /> Add a friend
            </Link>
          </span>
        </div>
        {error && <p className="px-4 text-[12px] text-wait">{error}</p>}
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {list?.chats.map((c) => (
            <li key={c.peer.email}>
              <button
                type="button"
                onClick={() => select(c.peer.email)}
                aria-current={open === c.peer.email ? "true" : undefined}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors ${open === c.peer.email ? "bg-fill" : "hover:bg-fill/50"}`}
              >
                <Bot {...face(c.peer)} size={38} mood={c.unread ? "awake" : "idle"} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={`truncate text-[15px] ${c.unread ? "font-semibold" : ""}`}>{c.peer.name}</span>
                    {c.last && <span className="shrink-0 text-[11px] text-secondary">{clock(c.last.at)}</span>}
                  </span>
                  <span className="flex items-center gap-1.5 text-[13px] text-secondary">
                    <span className="min-w-0 flex-1 truncate">{c.last ? preview(c.last, list.me.email, c.peer) : c.peer.onFlick ? "On Flick: say hi" : "Not on Flick yet"}</span>
                    {c.unread > 0 && <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] text-on-ink">{c.unread}</span>}
                  </span>
                  {(c.youOwe > 0 || c.owedToYou > 0) && (
                    <span className="mt-1 flex gap-1.5 text-[11px]">
                      {c.youOwe > 0 && <span className="rounded-full bg-wait/15 px-2 py-0.5 text-wait">You owe {usd(c.youOwe)}</span>}
                      {c.owedToYou > 0 && <span className="rounded-full bg-paid/15 px-2 py-0.5 text-paid">Owes you {usd(c.owedToYou)}</span>}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
          {list && !list.chats.length && (
            <li className="px-3 py-6 text-center text-[13px] leading-5 text-secondary">
              No friends yet. Add one by their PayPal email: once they sign in to Flick, you can chat and pay each other.
            </li>
          )}
        </ul>
      </aside>

      <section aria-label="Chat" className={`${open ? "flex" : "hidden lg:flex"} min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[24px] bg-card`}>
        {open && list ? (
          <Conversation key={open} email={open} me={list.me} back={() => select(null)} changed={load} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-[14px] text-secondary">
            <Logo size={36} />
            <p className="max-w-sm leading-5">Pick a friend. Ask for money with a bill&apos;s photo, and they pay it with a flick, or let it pay by itself.</p>
          </div>
        )}
      </section>
    </Frame>
  );
}

function Conversation({ email, me, back, changed }: { email: string; me: Me; back: () => void; changed: () => void }) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [error, setError] = useState<string>();
  const version = useRef<number | undefined>(undefined);
  const scroller = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const next = await get<Thread>(`chat/thread?with=${encodeURIComponent(email)}${version.current === undefined ? "" : `&v=${version.current}`}`);
      if (next.same) return;
      version.current = next.v;
      setThread(next);
      setError(undefined);
      // Opening it read it: the counts elsewhere go now, not at their next check.
      checkChats();
    } catch (err) {
      setError(message(err));
    }
  }, [email]);
  usePoll(load, 2500);

  // New messages: down to the newest.
  const count = thread?.messages.length ?? 0;
  useLayoutEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [count]);

  /** Runs an action, then shows what it changed (the chat, and its line in the list). */
  const run = async (work: () => Promise<unknown>) => {
    setError(undefined);
    try {
      await work();
    } catch (err) {
      setError(message(err));
    }
    await load();
    changed();
  };

  if (!thread) {
    return (
      <div className="flex flex-1 items-center justify-center text-[14px] text-secondary">
        {error ?? <LoaderCircle size={18} className="spinner" />}
      </div>
    );
  }
  const { peer, messages, autopay } = thread;

  return (
    <>
      <header className="flex items-center gap-3 border-b border-separator/60 px-3 py-2.5 sm:px-4">
        <button type="button" onClick={back} aria-label="Back to your chats" className="pressable -ml-1 flex size-8 cursor-pointer items-center justify-center rounded-full lg:hidden">
          <ArrowLeft size={18} />
        </button>
        <Bot {...face(peer)} size={34} mood="awake" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] leading-5">{peer.name}</p>
          <p className="truncate text-[12px] text-secondary">{peer.onFlick ? `On Flick · ${peer.email}` : `Not on Flick yet · ${peer.email}`}</p>
        </div>
        {peer.onFlick && <PaysByItself peer={peer} cap={autopay.mine} set={(cap) => run(() => act("chat/allow", { with: peer.email, cap }))} />}
      </header>

      <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-5">
        {autopay.theirs > 0 && (
          <p className="mx-auto w-fit rounded-full bg-fill/60 px-3 py-1 text-center text-[12px] text-secondary">
            <Zap size={11} className="-mt-0.5 mr-1 inline" />
            {peer.name}&apos;s Flick pays your requests up to {usd(autopay.theirs)} by itself.
          </p>
        )}
        {!peer.onFlick && <NotOnFlick peer={peer} />}
        {messages.map((m) => (
          <Line key={m.id} m={m} me={me.email} peer={peer} run={run} />
        ))}
        {peer.onFlick && !messages.length && <p className="pt-8 text-center text-[13px] text-secondary">Say hi, or ask {peer.name} for money: they can pay it with a flick.</p>}
      </div>

      {error && (
        <p role="alert" className="mx-3 mb-1 rounded-xl bg-wait/15 px-3 py-1.5 text-[12px] text-wait">
          {error}
        </p>
      )}
      <Composer peer={peer} run={run} />
    </>
  );
}

/** Lets this friend's requests pay by themselves, from your saved PayPal, up to an amount each. */
function PaysByItself({ peer, cap, set }: { peer: ChatPeer; cap: number; set: (cap: number) => void }) {
  const [open, setOpen] = useState(false);
  const label = cap ? `Pays by itself, up to ${usd(cap)}` : "Pays by itself: off";
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={label}
        className={`pressable flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-3 py-1 text-[12px] ${cap ? "bg-paid/15 text-paid" : "bg-fill"}`}
      >
        <Zap size={13} aria-hidden />
        <span className="max-sm:hidden">{label}</span>
        <span className="sm:hidden">{cap ? usd(cap) : "Off"}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-2xl bg-raised p-3 text-[13px] shadow-xl ring-1 ring-separator/60">
          <p className="leading-5 text-secondary">Pay {peer.name}&apos;s requests by themselves, from the PayPal you signed in with, when one is up to:</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CAPS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => (setOpen(false), set(c))}
                aria-pressed={c === cap}
                className={`pressable cursor-pointer rounded-full px-3 py-1 ${c === cap ? "bg-ink text-on-ink" : "bg-fill"}`}
              >
                {c ? usd(c) : "Off"}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** A friend who hasn't signed in: what they've been asked for, as PayPal invoices by email. */
function NotOnFlick({ peer }: { peer: ChatPeer }) {
  const debts = (useLive().state?.debts ?? []).filter((d) => d.friendId === peer.friendId && !d.chat);
  return (
    <div className="mx-auto max-w-md space-y-2 text-center">
      <p className="rounded-2xl bg-fill/60 px-4 py-3 text-[13px] leading-5 text-secondary">
        {peer.name} isn&apos;t on Flick yet, so messages can&apos;t reach them. A money request can: it goes to {peer.email} as a PayPal invoice. Once they
        sign in to Flick with that PayPal, you can chat and they can pay with a flick.
      </p>
      {debts.map((d) => (
        <Invoice key={d.id} debt={d} />
      ))}
    </div>
  );
}

function Invoice({ debt }: { debt: Debt }) {
  const status = debt.status === "paid" ? ["Paid", "text-paid"] : debt.status === "cancelled" ? ["Cancelled", "text-secondary"] : ["Waiting", "text-wait"];
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-raised px-4 py-2.5 text-left text-[13px] ring-1 ring-separator/50">
      <span className="min-w-0">
        <span className="block truncate">PayPal invoice: {debt.what}</span>
        <span className={`text-[12px] ${status[1]}`}>{status[0]}</span>
      </span>
      <span className="flex items-center gap-2">
        <span className="tabular-nums">{usd(debt.amount)}</span>
        {debt.payerUrl && (
          <a href={debt.payerUrl} target="_blank" rel="noreferrer" aria-label="The invoice on PayPal" className="text-secondary">
            <ArrowUpRight size={14} />
          </a>
        )}
      </span>
    </div>
  );
}

function Line({ m, me, peer, run }: { m: ChatMessage; me: string; peer: ChatPeer; run: (work: () => Promise<unknown>) => Promise<void> }) {
  const mine = m.from === me;
  if (m.kind === "paid") {
    return (
      <p className="mx-auto flex w-fit items-center gap-1.5 rounded-full bg-paid/15 px-3 py-1 text-[12px] text-paid">
        <CircleCheck size={13} /> {mine ? "You" : peer.name} paid {usd(m.amount ?? 0)} for {m.what}
        {m.auto ? ", by itself" : ""} · {clock(m.at)}
      </p>
    );
  }
  if (m.kind === "note") return <p className="mx-auto w-fit max-w-md text-center text-[12px] text-secondary">{m.text}</p>;
  if (m.kind === "request") return <Request m={m} mine={mine} peer={peer} run={run} />;
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[78%] rounded-[20px] px-3.5 py-2 text-[15px] leading-5 ${mine ? "rounded-br-md bg-ink text-on-ink" : "rounded-bl-md bg-fill"}`}>
        {m.kind === "reminder" && (
          <span className="mb-0.5 flex items-center gap-1 text-[11px] opacity-70">
            <BellRing size={11} /> A reminder, from Nudge
          </span>
        )}
        <span className="whitespace-pre-wrap break-words">{m.text}</span>
        <span className="ml-2 align-bottom text-[10px] opacity-60">{clock(m.at)}</span>
      </div>
    </div>
  );
}

/** A money request: its bill's photo, the amount, and what you can do about it. */
function Request({ m, mine, peer, run }: { m: ChatMessage; mine: boolean; peer: ChatPeer; run: (work: () => Promise<unknown>) => Promise<void> }) {
  const [busy, setBusy] = useState<"remind" | "decline">();
  const amount = m.amount ?? 0;
  const status =
    m.status === "paid"
      ? ["Paid" + (m.auto ? ", by itself" : ""), "bg-paid/15 text-paid"]
      : m.status === "paying"
        ? ["Paying…", "bg-fill text-secondary"]
        : m.status === "declined"
          ? ["Turned down", "bg-fill text-secondary"]
          : [mine ? `Waiting for ${peer.name}` : "Waiting for you", "bg-wait/15 text-wait"];
  const pay = () =>
    run(async () => {
      await flickToPay(() => act("chat/pay", { with: peer.email, id: m.id }), { amount, to: peer.name });
    });
  const perform = (kind: "remind" | "decline", path: string, body: object) => {
    setBusy(kind);
    void run(() => act(path, body)).finally(() => setBusy(undefined));
  };
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className="w-[min(300px,85%)] overflow-hidden rounded-[22px] bg-raised ring-1 ring-separator/60">
        {m.photo && (
          // A data URL Lens kept; next/image adds nothing here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.photo} alt={`The bill for ${m.what}`} className="max-h-56 w-full object-cover" />
        )}
        <div className="p-3.5">
          <p className="flex items-center justify-between gap-2 text-[12px] text-secondary">
            <span>{mine ? `You asked ${peer.name}` : `${peer.name} asked you`}</span>
            <span>{clock(m.at)}</span>
          </p>
          <p className="mt-0.5 text-[30px] font-semibold leading-tight tracking-tight tabular-nums">{usd(amount)}</p>
          <p className="text-[15px]">{m.what}</p>
          {m.text && <p className="mt-1 text-[13px] leading-5 text-secondary">{m.text}</p>}
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className={`rounded-full px-2 py-0.5 ${status[1]}`}>{status[0]}</span>
            {m.payout === "failed" && <span className="text-wait">Flick is still sending it on to PayPal</span>}
          </p>
          {m.status === "open" && !mine && (
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <button type="button" onClick={() => void pay()} className="pressable flex h-10 cursor-pointer items-center justify-center rounded-full bg-ink text-[14px] text-on-ink">
                Pay {usd(amount)}
              </button>
              <button
                type="button"
                onClick={() => perform("decline", "chat/decline", { with: peer.email, id: m.id })}
                disabled={Boolean(busy)}
                className="pressable flex h-10 cursor-pointer items-center justify-center rounded-full bg-fill px-4 text-[13px] disabled:opacity-50"
              >
                {busy === "decline" ? <LoaderCircle size={14} className="spinner" /> : "Turn down"}
              </button>
            </div>
          )}
          {m.status === "open" && mine && (
            <button
              type="button"
              onClick={() => perform("remind", "chat/remind", { with: peer.email, id: m.id, tone: "Friendly" })}
              disabled={Boolean(busy)}
              className="pressable mt-3 flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-fill text-[13px] disabled:opacity-50"
            >
              {busy === "remind" ? <LoaderCircle size={14} className="spinner" /> : <BellRing size={14} />} Nudge {peer.name}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type Asking = { amount: string; what: string; photo?: string; total?: number; note?: string };

/** Typing, asking for money, and sharing a bill's photo (Lens reads it: all of it, or half). */
function Composer({ peer, run }: { peer: ChatPeer; run: (work: () => Promise<unknown>) => Promise<void> }) {
  const [text, setText] = useState("");
  const [asking, setAsking] = useState<Asking | null>(null);
  const [reading, setReading] = useState(false);
  const [sending, setSending] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const canRead = Boolean(useLive().state?.config.ai);

  const send = async () => {
    const words = text.trim();
    if (!words || sending) return;
    setSending(true);
    await run(async () => {
      await act("chat/send", { with: peer.email, text: words });
      setText("");
    });
    setSending(false);
  };

  const share = async (photo: File | undefined) => {
    if (!photo) return;
    setReading(true);
    try {
      const copies = await forLens(photo);
      if (!canRead) return setAsking({ amount: "", what: "", photo: copies.photo, note: "Type the amount: Lens isn't on here." });
      const scan = await act<Scan>("lens/read", copies);
      const total = scan.kind === "tip" ? 0 : scan.amount;
      setAsking({
        amount: total ? (total / 2).toFixed(2) : "",
        what: scan.kind === "unknown" ? "" : scan.title,
        photo: copies.photo,
        total: total || undefined,
        note: scan.kind === "unknown" ? "Lens couldn't find an amount: type it." : undefined,
      });
    } catch (err) {
      setAsking({ amount: "", what: "", note: message(err) });
    } finally {
      setReading(false);
      if (file.current) file.current.value = "";
    }
  };

  const request = async () => {
    if (!asking || sending) return;
    setSending(true);
    await run(async () => {
      await act("chat/request", { with: peer.email, amount: Number(asking.amount), what: asking.what.trim(), ...(asking.photo && { photo: asking.photo }) });
      setAsking(null);
    });
    setSending(false);
  };

  const amount = Number(asking?.amount);
  const ready = Boolean(asking && amount > 0 && asking.what.trim());

  return (
    <div className="border-t border-separator/60 p-2.5 sm:p-3">
      {asking && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void request();
          }}
          className="mb-2 rounded-2xl bg-fill/50 p-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-secondary">
              Ask {peer.name} for money{peer.onFlick ? "" : ", with a PayPal invoice"}
            </p>
            <button type="button" onClick={() => setAsking(null)} aria-label="Don't ask" className="pressable flex size-7 cursor-pointer items-center justify-center rounded-full">
              <X size={15} />
            </button>
          </div>
          <div className="mt-2 flex gap-3">
            {asking.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={asking.photo} alt="The bill" className="h-[88px] w-[66px] shrink-0 rounded-xl object-cover" />
            )}
            <div className="grid min-w-0 flex-1 gap-2">
              <label className="flex h-10 items-center rounded-full bg-raised px-3 ring-1 ring-separator/60 focus-within:ring-2 focus-within:ring-ink">
                <DollarSign size={15} className="text-secondary" />
                <input
                  inputMode="decimal"
                  value={asking.amount}
                  onChange={(e) => setAsking({ ...asking, amount: e.target.value.replace(/[^\d.]/g, "") })}
                  placeholder="0.00"
                  aria-label="How much"
                  className="w-full bg-transparent text-[16px] tabular-nums outline-none"
                />
              </label>
              <input
                value={asking.what}
                onChange={(e) => setAsking({ ...asking, what: e.target.value })}
                maxLength={80}
                placeholder="What for? Dinner, rent, tickets…"
                aria-label="What for"
                className="h-10 rounded-full bg-raised px-4 text-[14px] outline-none ring-1 ring-separator/60 focus:ring-2 focus:ring-ink"
              />
            </div>
          </div>
          {asking.total && (
            <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
              <span className="py-1 text-secondary">Lens read {usd(asking.total)}:</span>
              {[
                ["Half", asking.total / 2],
                ["All of it", asking.total],
              ].map(([label, value]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setAsking({ ...asking, amount: (value as number).toFixed(2) })}
                  className={`pressable cursor-pointer rounded-full px-3 py-1 ${Number(asking.amount) === Math.round((value as number) * 100) / 100 ? "bg-ink text-on-ink" : "bg-raised"}`}
                >
                  {label}, {usd(value as number)}
                </button>
              ))}
            </div>
          )}
          {asking.note && <p className="mt-2 text-[12px] text-wait">{asking.note}</p>}
          <button type="submit" disabled={!ready || sending} className="pressable mt-2.5 flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-ink text-[14px] text-on-ink disabled:opacity-40">
            {sending ? <LoaderCircle size={14} className="spinner" /> : null}
            {ready ? `Ask for ${usd(amount)}` : "Ask for money"}
          </button>
        </form>
      )}
      <div className="flex items-center gap-1.5">
        <input ref={file} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void share(e.target.files?.[0])} />
        <button
          type="button"
          onClick={() => file.current?.click()}
          disabled={reading}
          aria-label="Share a bill's photo"
          title="Share a bill's photo: Lens reads it"
          className="pressable flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-fill disabled:opacity-50"
        >
          {reading ? <LoaderCircle size={17} className="spinner" /> : <Camera size={18} />}
        </button>
        <button
          type="button"
          onClick={() => setAsking(asking ?? { amount: "", what: "" })}
          aria-label="Ask for money"
          title="Ask for money"
          className="pressable flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-fill"
        >
          <DollarSign size={18} />
        </button>
        {peer.onFlick ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex min-w-0 flex-1 items-center gap-1.5"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              placeholder={`Message ${peer.name}`}
              aria-label={`Message ${peer.name}`}
              className="h-10 min-w-0 flex-1 rounded-full bg-fill/60 px-4 text-[15px] outline-none focus:ring-2 focus:ring-ink"
            />
            <button type="submit" disabled={!text.trim() || sending} aria-label="Send" className="pressable flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-ink text-on-ink disabled:opacity-40">
              <SendHorizontal size={17} />
            </button>
          </form>
        ) : (
          <p className="min-w-0 flex-1 px-2 text-[12px] leading-4 text-secondary">Only money requests reach {peer.name} until they&apos;re on Flick.</p>
        )}
      </div>
    </div>
  );
}
