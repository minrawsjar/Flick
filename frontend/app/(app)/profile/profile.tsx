"use client";

import type { money } from "@backend/account";
import { ArrowUpRight, ChevronRight, LoaderCircle, Pencil, RotateCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Secondary } from "@/components/ui";
import { initial, usd } from "@/lib/format";
import { refresh, useLive } from "@/lib/live";

// Who this Flick belongs to (signed in with PayPal, /login) and what's in it. The name starts as
// PayPal's and can be changed here (POST /api/profile). Signing out leaves it all kept: signing in
// again, here or on another device, brings it back.

export function Profile() {
  const live = useLive();
  const [busy, setBusy] = useState(false);
  // Editing the name: what's typed so far (null when not editing), and what went wrong saving it.
  const [draft, setDraft] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string>();
  const state = live.state;
  const profile = state?.profile;

  const saveName = async () => {
    setBusy(true);
    setNameError(undefined);
    try {
      const res = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: draft }) });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: { message?: string } }).error?.message ?? `Flick's backend answered ${res.status}.`);
      await refresh();
      setDraft(null);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (live.mode === "loading") return <div className="mx-auto max-w-md px-4 py-10 text-[15px] text-secondary">Loading…</div>;

  if (!profile) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-[28px] bg-card p-6">
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight">You&apos;re a guest.</h1>
          <p className="mt-2 text-[15px] leading-[1.45] text-secondary">
            What you do here lives in this browser only. Sign in with PayPal to keep it on every device, and to pay with a flick.
          </p>
          <Link href="/login?next=/profile" className="pressable mt-6 flex h-12 items-center justify-center rounded-full bg-[#0070e0] text-[16px] font-medium text-white">
            Sign in with PayPal
          </Link>
        </div>
      </div>
    );
  }

  // This browser's notifications stop first (they'd be about this Flick), then the session ends.
  const signOut = async () => {
    setBusy(true);
    try {
      const sub = await navigator.serviceWorker?.getRegistration().then((r) => r?.pushManager.getSubscription());
      if (sub) {
        await fetch("/api/push/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
    } catch {}
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
    // A full load, not the router: the next request starts this browser's new guest Flick, and
    // nothing of the signed-in one stays in memory.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login?signedout=1");
  };

  const paid = Object.values(state.checkouts).filter((c) => c.status === "captured").length;
  const counts: [string, number][] = [
    ["Friends", state.friends.length],
    ["Bills read", state.scans.length],
    ["Payments", paid],
  ];

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="rounded-[28px] bg-card p-6">
        <div className="flex items-center gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-ink text-[26px] font-semibold text-on-ink" aria-hidden>
            {initial(profile.name)}
          </span>
          {draft === null ? (
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <h1 className="truncate text-[24px] font-semibold leading-tight tracking-tight">{profile.name}</h1>
                <button
                  type="button"
                  onClick={() => setDraft(profile.name)}
                  aria-label="Change your name"
                  className="pressable flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-secondary hover:bg-fill"
                >
                  <Pencil size={15} aria-hidden />
                </button>
              </span>
              <p className="truncate text-[14px] text-secondary">{profile.email}</p>
            </span>
          ) : (
            <form onSubmit={(e) => (e.preventDefault(), void saveName())} className="min-w-0 flex-1">
              <label htmlFor="name" className="text-[12px] text-secondary">
                Your name in Flick
              </label>
              <input
                id="name"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={60}
                autoFocus
                autoComplete="name"
                className="mt-1 h-10 w-full rounded-xl bg-fill px-3 text-[17px] outline-none focus:ring-2 focus:ring-ink/20"
              />
              <span className="mt-2 flex gap-2">
                <button type="submit" disabled={busy || !draft.trim()} className="pressable h-8 cursor-pointer rounded-full bg-ink px-4 text-[13px] text-on-ink disabled:opacity-50">
                  {busy ? <LoaderCircle size={14} className="spinner" /> : "Save"}
                </button>
                <button type="button" onClick={() => (setDraft(null), setNameError(undefined))} className="pressable h-8 cursor-pointer rounded-full bg-fill px-4 text-[13px]">
                  Cancel
                </button>
              </span>
              {nameError && <span className="mt-1.5 block text-[12px] text-wait">{nameError}</span>}
            </form>
          )}
        </div>
        {!profile.named && draft === null && (
          <p className="mt-3 rounded-2xl bg-fill px-4 py-2.5 text-[13px] leading-[18px] text-secondary">
            That&apos;s the name PayPal gave Flick (its sandbox calls everyone John Doe). Tap the pencil to use your own.
          </p>
        )}

        <dl className="mt-6 divide-y divide-separator/50 rounded-2xl bg-tile text-[14px]">
          <Row label="Signed in with" value="PayPal (sandbox)" />
          <Row label="Flick to pay" value="On: a flick pays from this PayPal" />
          <Row label="Member since" value={new Date(profile.since).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} />
        </dl>

        <Money />

        <Link href="/business" className="mt-3 flex items-center justify-between rounded-2xl bg-tile px-4 py-3 text-[14px]">
          <span>
            Run a business?
            <span className="block text-[12px] text-secondary">Register it, and bills Flick reads with its name pay this PayPal.</span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-secondary" />
        </Link>

        <p className="mt-6 text-[13px] text-secondary">In your Flick</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {counts.map(([label, n]) => (
            <div key={label} className="rounded-2xl bg-tile px-3 py-3">
              <p className="text-[24px] font-semibold tabular-nums leading-none">{n}</p>
              <p className="mt-1 text-[12px] text-secondary">{label}</p>
            </div>
          ))}
        </div>

        <Secondary onClick={() => void signOut()} disabled={busy} className="mt-6 w-full">
          {busy ? <LoaderCircle size={15} className="spinner" /> : "Sign out"}
        </Secondary>
        <p className="mt-2 text-center text-[12px] leading-4 text-secondary">Signing out keeps your Flick. Sign in again, here or anywhere, and it&apos;s all there.</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <dt className="text-secondary">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

type Money = ReturnType<typeof money>;

/**
 * Your money through Flick, asked afresh each time the profile opens (GET /api/profile/money): paid
 * this month and in all, where it went, and what's open with friends either way. Not your PayPal
 * balance, which PayPal keeps to itself: the link opens it on PayPal.
 */
function Money() {
  const [money, setMoney] = useState<Money>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(true);

  // The state is set once the answer comes, not as the effect runs.
  const fetchIt = useCallback(
    () =>
      fetch("/api/profile/money", { cache: "no-store" })
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error?.message ?? `Flick's backend answered ${res.status}.`);
          setMoney(json as Money);
          setError(undefined);
        })
        .catch((err) => setError(err instanceof Error ? err.message : String(err)))
        .finally(() => setBusy(false)),
    [],
  );
  useEffect(() => {
    void fetchIt();
  }, [fetchIt]);
  const load = () => {
    setBusy(true);
    void fetchIt();
  };

  const where = money
    ? ([
        ["Bills", money.where.bills],
        ["Weeks", money.where.weeks],
        ["Groceries", money.where.groceries],
        ["Friends", money.where.friends],
      ] as const).filter(([, amount]) => amount > 0)
    : [];

  return (
    <section aria-label="Your money through Flick" className="mt-6 rounded-2xl bg-tile p-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-secondary">Paid through Flick this month</p>
        <button type="button" onClick={load} disabled={busy} aria-label="Update" className="pressable flex size-7 cursor-pointer items-center justify-center rounded-full text-secondary hover:bg-fill disabled:cursor-default">
          <RotateCw size={14} className={busy ? "spinner" : ""} />
        </button>
      </div>
      {money ? (
        <>
          <p className="mt-0.5 text-[34px] font-semibold tabular-nums leading-tight tracking-tight">{usd(money.thisMonth)}</p>
          <p className="text-[12px] text-secondary">
            {usd(money.paid)} in all · as of {new Date(money.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </p>
          {where.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 text-[12px]">
              {where.map(([label, amount]) => (
                <span key={label} className="rounded-full bg-fill px-2.5 py-1">
                  {label} <span className="tabular-nums">{usd(amount)}</span>
                </span>
              ))}
            </div>
          )}
          <dl className="mt-3 divide-y divide-separator/50 text-[14px]">
            <MoneyRow label="Friends paid you back" value={usd(money.paidBack)} />
            <MoneyRow label="Owed to you" value={usd(money.owedToYou.amount)} note={money.owedToYou.count ? `${money.owedToYou.count} open` : undefined} href="/nudge" />
            <MoneyRow label="You owe" value={usd(money.youOwe.amount)} note={money.youOwe.count ? `${money.youOwe.count} in Chat` : undefined} href="/chat" />
          </dl>
        </>
      ) : (
        <p className="mt-2 text-[13px] text-secondary">{error ?? "Adding it up…"}</p>
      )}
      <p className="mt-3 text-[12px] leading-4 text-secondary">
        Your PayPal balance stays with PayPal: it doesn&apos;t share a customer&apos;s balance with apps.{" "}
        <a href="https://www.sandbox.paypal.com/myaccount/summary" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-ink underline-offset-2 hover:underline">
          See it on PayPal <ArrowUpRight size={12} />
        </a>
      </p>
    </section>
  );
}

function MoneyRow({ label, value, note, href }: { label: string; value: string; note?: string; href?: string }) {
  const body = (
    <>
      <dt className="text-secondary">{label}</dt>
      <dd className="flex items-center gap-1.5 tabular-nums">
        {note && <span className="text-[12px] text-secondary">{note}</span>}
        {value}
        {href && <ChevronRight size={14} className="text-secondary" />}
      </dd>
    </>
  );
  return href ? (
    <Link href={href} className="flex items-center justify-between gap-3 py-2.5">
      {body}
    </Link>
  ) : (
    <div className="flex items-center justify-between gap-3 py-2.5">{body}</div>
  );
}
