"use client";

import { History, Pointer, UserRound } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";
import { Logo } from "@/components/ui";
import { useLive } from "@/lib/live";

// Signing in to Flick, with a PayPal sandbox account (backend/src/account.ts). PayPal's page asks to
// save PayPal with Flick; that one approval makes this Flick theirs, on every device, and lets a
// flick pay with no PayPal page each time. Signing in is optional: a guest can do everything, and
// approves each payment on PayPal's page.

const never = () => () => {};
/** The page's query: why we're here (?signin=failed, ?signedout=1) and where to go after (?next=). */
const useQuery = () => useSyncExternalStore(never, () => window.location.search, () => "");

export function SignIn() {
  const live = useLive();
  const query = new URLSearchParams(useQuery());
  const next = /^\/(?!\/)/.test(query.get("next") ?? "") ? query.get("next")! : "/home";
  const profile = live.state?.profile;
  const paypal = live.state?.config.paypal ?? true;

  const note = query.get("signin") === "failed"
    ? "PayPal didn't sign you in, so nothing was saved. Try again."
    : query.get("signin") === "cancelled"
      ? "Sign-in cancelled. You can carry on as a guest."
      : query.has("signedout")
        ? "Signed out. Your Flick is kept for when you sign back in, here or anywhere."
        : null;

  return (
    <div className="mx-auto flex min-h-[calc(100svh-9rem)] max-w-md flex-col justify-center px-4 py-8">
      <div className="rounded-[28px] bg-card p-6 shadow-[0_0_0_0.5px_rgba(0,0,0,0.06)]">
        <Logo size={64} />
        {profile ? (
          <>
            <h1 className="mt-5 text-[32px] font-semibold leading-[1.05] tracking-tight">You&apos;re signed in.</h1>
            <p className="mt-2 text-[15px] leading-[1.45] text-secondary">
              As {profile.name}
              {profile.email ? `, with ${profile.email}` : ""}. A flick pays from that PayPal.
            </p>
            <div className="mt-6 grid gap-2">
              <Link href={next} className="pressable flex h-12 items-center justify-center rounded-full bg-ink text-[16px] text-on-ink">
                Open Flick
              </Link>
              <Link href="/profile" className="pressable flex h-11 items-center justify-center rounded-full bg-fill text-[15px]">
                Your profile
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-5 text-[32px] font-semibold leading-[1.05] tracking-tight">Sign in to Flick</h1>
            <p className="mt-2 text-[15px] leading-[1.45] text-secondary">With your PayPal sandbox account. Approve once on PayPal, and this Flick is yours.</p>
            <ul className="mt-5 grid gap-3.5">
              <Point icon={<UserRound size={18} />} title="Your own Flick">
                Your bills, friends and payments, on every device you sign in on.
              </Point>
              <Point icon={<Pointer size={18} />} title="A flick pays">
                Flick saves your PayPal, so a flick pays there and then: no PayPal page each time.
              </Point>
              <Point icon={<History size={18} />} title="Nothing lost">
                What you&apos;ve done here as a guest comes with you.
              </Point>
            </ul>
            {note && (
              <p role="status" className="mt-5 rounded-2xl bg-fill px-4 py-2.5 text-[14px] leading-5">
                {note}
              </p>
            )}
            <div className="mt-6 grid gap-1">
              {paypal ? (
                <a
                  href={`/api/auth/paypal/start?next=${encodeURIComponent(next)}`}
                  className="pressable flex h-12 items-center justify-center rounded-full bg-[#0070e0] text-[16px] font-medium text-white"
                >
                  Sign in with PayPal
                </a>
              ) : (
                <p className="rounded-2xl bg-wait/15 px-4 py-2.5 text-[14px] text-wait">PayPal isn&apos;t set up on this backend, so signing in is off. Flick works as a guest.</p>
              )}
              <Link href={next} className="flex h-11 items-center justify-center text-[14px] text-secondary">
                Continue as a guest
              </Link>
            </div>
            <p className="mt-2 text-[12px] leading-4 text-secondary">
              Use a PayPal sandbox personal account: make one at developer.paypal.com, under Testing tools, Sandbox accounts. Sandbox money only; nothing
              real is charged.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Point({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fill" aria-hidden>
        {icon}
      </span>
      <span>
        <span className="block text-[15px] font-medium">{title}</span>
        <span className="block text-[14px] leading-5 text-secondary">{children}</span>
      </span>
    </li>
  );
}
