"use client";

import type { unread } from "@backend/chat";
import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useLive } from "@/lib/live";
import { Bot, type BotColor, type BotShape } from "./bot";

// Chat notifications inside Flick: how many chat messages you haven't seen (a count by Chat in the
// top bar and the People switch, a dot on the People tab, the app icon's badge), and a banner on
// any page when one arrives, which opens that chat. While Flick is on screen and you're signed in,
// it asks the backend every few seconds (GET /api/chat/unread); with Flick closed, notifications
// (backend/src/push.ts) do the same job.

type Unread = ReturnType<typeof unread> & { news?: ReturnType<typeof unread>["latest"] };
const EVERY = 5000;
const NONE: Unread = { count: 0 };

// One poll for the whole page, shared by everything that shows it.
let current: Unread = NONE;
let started = false;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

async function poll() {
  if (document.visibilityState !== "visible") return;
  try {
    const res = await fetch("/api/chat/unread", { cache: "no-store" });
    if (!res.ok) return;
    const next = (await res.json()) as Unread;
    // News: a newest message that wasn't there before. Not on the first answer: what was already
    // waiting when Flick opened shows as counts, not as a banner.
    const news = started && next.latest && next.latest.id !== current.latest?.id ? next.latest : undefined;
    started = true;
    if (next.count === current.count && next.latest?.id === current.latest?.id) return;
    current = { ...next, news };
    listeners.forEach((listener) => listener());
  } catch {
    // Offline, or the backend restarting: the next poll tries again.
  }
}

/** Asks again now: after reading a chat, say, so its count goes at once. */
export const checkChats = () => void poll();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    void poll();
    timer = setInterval(poll, EVERY);
    document.addEventListener("visibilitychange", checkChats);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    clearInterval(timer);
    timer = undefined;
    document.removeEventListener("visibilitychange", checkChats);
  };
}
const nothing = () => () => {};

/** Your unread chat messages, while you're signed in (a guest has no chats). */
export function useUnread(): Unread {
  const signedIn = Boolean(useLive().state?.profile);
  const value = useSyncExternalStore(signedIn ? subscribe : nothing, () => current, () => NONE);
  return signedIn ? value : NONE;
}

/** A banner when a chat message arrives, on any page but that chat. Tapping it opens the chat. */
export function ChatBanner() {
  const { news } = useUnread();
  const path = usePathname();
  const [shown, setShown] = useState<NonNullable<Unread["news"]>>();

  useEffect(() => {
    if (!news) return;
    const reading = path === "/chat" && new URLSearchParams(location.search).get("with") === news.peer.email;
    if (reading) return;
    // Shown from the poll's news: an effect is where this page hears of it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShown(news);
    const hide = setTimeout(() => setShown(undefined), 7000);
    return () => clearTimeout(hide);
  }, [news, path]);

  if (!shown) return null;
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+10px)] z-50 flex justify-center lg:inset-x-auto lg:right-6 lg:top-[60px] lg:w-96">
      <div className="rise pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl bg-card/95 p-3 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.35)] ring-1 ring-separator/50 backdrop-blur">
        <Link href={`/chat?with=${encodeURIComponent(shown.peer.email)}`} onClick={() => setShown(undefined)} className="flex min-w-0 flex-1 items-center gap-3">
          <Bot color={shown.peer.color as BotColor} shape={shown.peer.shape as BotShape} size={34} mood="speaking" />
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold">{shown.peer.name}</span>
            <span className="block truncate text-[13px] text-secondary">{shown.text}</span>
          </span>
        </Link>
        <button type="button" aria-label="Dismiss" onClick={() => setShown(undefined)} className="pressable flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-fill text-secondary">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/** A count for a link: the unread messages, if any. */
export function UnreadCount({ count, className = "" }: { count: number; className?: string }) {
  if (count < 1) return null;
  return (
    <span aria-label={`${count} unread`} className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white ${className}`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}
