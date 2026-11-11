"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Secondary } from "@/components/ui";
import { initial } from "@/lib/format";
import { useLive } from "@/lib/live";

// Who this Flick belongs to (signed in with PayPal, /login) and what's in it. Signing out leaves it
// all kept: signing in again, here or on another device, brings it back.

export function Profile() {
  const live = useLive();
  const [busy, setBusy] = useState(false);
  const state = live.state;
  const profile = state?.profile;

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
          <span className="min-w-0">
            <h1 className="truncate text-[24px] font-semibold leading-tight tracking-tight">{profile.name}</h1>
            <p className="truncate text-[14px] text-secondary">{profile.email}</p>
          </span>
        </div>

        <dl className="mt-6 divide-y divide-separator/50 rounded-2xl bg-tile text-[14px]">
          <Row label="Signed in with" value="PayPal (sandbox)" />
          <Row label="Flick to pay" value="On: a flick pays from this PayPal" />
          <Row label="Member since" value={new Date(profile.since).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} />
        </dl>

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
