"use client";

import type { ChatPeer, Safe } from "@backend/model";
import { ArrowUpRight, Camera, LoaderCircle, LockKeyhole, Undo2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SafeCard } from "@/components/safe";
import { useLive } from "@/lib/live";

// Every Safe you gave or were given (GET /api/safes), each as Flick Chat shows it, with its chat a
// tap away. Giving one starts in a chat: it's between two people on Flick.

type Listed = Safe & { peer: ChatPeer };

const STEPS = [
  [LockKeyhole, "Give it for one thing", "In Flick Chat, give a friend on Flick money for a purpose. A flick pays it from your PayPal, and Flick holds it."],
  [Camera, "They snap the receipt", "Safe reads every line. Only what's for the purpose comes out, with its share of the tax. A used, old or unrelated receipt is turned down."],
  [Undo2, "Paid, or back to you", "PayPal pays them back, or pays the shop's bill. Anything doubtful waits for you. Close it, and what's left is refunded to you."],
] as const;

/** Runs `load` now and every `ms` while the tab is visible (as Flick Chat does): a friend's receipt shows up by itself. */
function usePoll(load: (() => unknown) | undefined, ms: number) {
  useEffect(() => {
    if (!load) return;
    void load();
    const timer = setInterval(() => document.visibilityState === "visible" && void load(), ms);
    return () => clearInterval(timer);
  }, [load, ms]);
}

export function Safes() {
  const live = useLive();
  const [safes, setSafes] = useState<{ forYou: Listed[]; youGave: Listed[] } | null>(null);
  const [error, setError] = useState<string>();
  const signedIn = Boolean(live.state?.profile);

  const load = useCallback(async () => {
    const res = await fetch("/api/safes", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data?.error?.message ?? `Flick's backend answered ${res.status}.`);
    setSafes(data);
    setError(undefined);
  }, []);
  usePoll(signedIn ? load : undefined, 5000);

  const run = async (work: () => Promise<unknown>) => {
    setError(undefined);
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    await load();
  };

  const me = live.state?.profile?.email.trim().toLowerCase() ?? "";
  return (
    <div className="space-y-6">
      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map(([Icon, title, detail], i) => (
          <li key={title} className="rounded-[22px] bg-card p-4">
            <p className="flex items-center gap-2 text-[15px]">
              <span className="flex size-7 items-center justify-center rounded-full bg-sky/20">
                <Icon size={15} aria-hidden />
              </span>
              {i + 1}. {title}
            </p>
            <p className="mt-1.5 text-[13px] leading-5 text-secondary">{detail}</p>
          </li>
        ))}
      </ol>

      {live.mode === "loading" ? (
        <LoaderCircle size={18} className="spinner text-secondary" />
      ) : !signedIn ? (
        <div className="rounded-[22px] bg-card p-5 text-[14px] leading-6 text-secondary">
          A Safe is between two people signed in with PayPal: the one who gives it, and the friend who spends it.{" "}
          <Link href="/login?next=/safe" className="text-ink underline underline-offset-2">
            Sign in with PayPal
          </Link>{" "}
          to give one or see yours.
        </div>
      ) : (
        <>
          {error && (
            <p role="alert" className="rounded-xl bg-wait/15 px-3 py-2 text-[13px] text-wait">
              {error}
            </p>
          )}
          {!safes ? (
            <LoaderCircle size={18} className="spinner text-secondary" />
          ) : (
            <>
              <List title="Given to you" empty="Nothing yet. When a friend gives you money for something, it waits here and in your chat." safes={safes.forYou} me={me} run={run} />
              <List title="You gave" empty="To give one, open a chat with a friend on Flick and tap the lock." safes={safes.youGave} me={me} run={run} />
              <Link href="/chat" className="pressable inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-5 text-[14px] text-on-ink">
                <LockKeyhole size={14} /> Give money for one thing, in Chat
              </Link>
            </>
          )}
        </>
      )}
    </div>
  );
}

function List({ title, empty, safes, me, run }: { title: string; empty: string; safes: Listed[]; me: string; run: (work: () => Promise<unknown>) => Promise<void> }) {
  return (
    <section aria-label={title}>
      <h2 className="text-[19px] tracking-tight">{title}</h2>
      {!safes.length ? (
        <p className="mt-1 text-[13px] text-secondary">{empty}</p>
      ) : (
        <ul className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {safes.map((s) => (
            <li key={s.id} className="flex flex-col items-start gap-1.5 [&>div]:w-full">
              <SafeCard safe={s} me={me} peer={s.peer} run={run} />
              <Link href={`/chat?with=${encodeURIComponent(s.peer.email)}`} className="flex items-center gap-1 px-1 text-[12px] text-secondary hover:text-ink">
                Its receipts, in your chat with {s.peer.name} <ArrowUpRight size={12} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
