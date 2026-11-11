"use client";

import { createContext, createElement, useContext, useSyncExternalStore, type ReactNode } from "react";
import type { Scan, State } from "@backend/model";

// The app pages' link to the backend (/lens, /autopilot, /split, /nudge). When the backend answers
// and PayPal is configured they're "live": they read and change real state through the API (the
// browser reaches it via the /api/* rewrite). Otherwise they fall back to demo data. The one-pager
// wraps its sections in <ShowDemo>, so it's always the demo.

export type LiveState = State & { config: { paypal: boolean; ai: boolean } };

type Snapshot = {
  mode: "loading" | "live" | "demo";
  state: LiveState | null;
  /** A receipt Lens read, handed from the Lens section to Split. */
  receipt: Scan | null;
};

let snapshot: Snapshot = { mode: "loading", state: null, receipt: null };
const listeners = new Set<() => void>();
const update = (patch: Partial<Snapshot>) => {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
};

/** Reloads everything Flick knows from the backend. */
export function refresh() {
  return fetch("/api/state", { cache: "no-store" })
    .then((res) => (res.ok ? (res.json() as Promise<LiveState>) : Promise.reject(new Error(String(res.status)))))
    .then((state) => update({ state, mode: state.config.paypal ? "live" : "demo" }))
    .catch(() => update({ state: null, mode: "demo" }));
}

let started = false;
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started) {
    started = true;
    void refresh();
    // Coming back to the tab or the installed app (from PayPal, or another app): catch up.
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void refresh());
  }
  return () => listeners.delete(listener);
}

const serverSnapshot: Snapshot = { mode: "loading", state: null, receipt: null };
const demoSnapshot: Snapshot = { mode: "demo", state: null, receipt: null };

const DemoOnly = createContext(false);
/** Everything inside plays the demo, whatever the backend says. */
export const ShowDemo = ({ children }: { children: ReactNode }) => createElement(DemoOnly.Provider, { value: true }, children);

export function useLive() {
  const live = useSyncExternalStore(subscribe, () => snapshot, () => serverSnapshot);
  return useContext(DemoOnly) ? demoSnapshot : live;
}

export const handReceipt = (receipt: Scan) => update({ receipt });

/** POSTs to Flick's API and refreshes the shared state. Throws the API's own error message. */
export async function act<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? `Flick's backend answered ${res.status}.`);
  void refresh();
  return data as T;
}

/**
 * A payment waiting for the person's flick (components/flick-confirm.tsx): a PayPal checkout to
 * approve (`url`), or a payment Flick makes itself once they've flicked (`pay`: Flick Chat's).
 */
export type Confirming = { url?: string; pay?: () => Promise<unknown>; amount?: number; to?: string; done: (went: boolean) => void };
let confirming: Confirming | null = null;
const confirmListeners = new Set<() => void>();
const setConfirming = (next: Confirming | null) => {
  confirming = next;
  confirmListeners.forEach((listener) => listener());
};
const subscribeConfirm = (listener: () => void) => {
  confirmListeners.add(listener);
  return () => void confirmListeners.delete(listener);
};
export const useConfirming = () => useSyncExternalStore(subscribeConfirm, () => confirming, () => null);

/**
 * Sends the person to PayPal to approve a checkout, once they've flicked to confirm; PayPal brings
 * them back to the page with ?paid=…. Resolves false if they backed out (the checkout is then
 * cancelled), so the caller can put its button back. No URL: it was paid already (Autopilot's saved
 * PayPal), so there's nothing to approve.
 */
export function approveOnPayPal(approveUrl: string | null | undefined, details: { amount?: number; to?: string } = {}): Promise<boolean> {
  if (!approveUrl) return refresh().then(() => true);
  return new Promise((resolve) =>
    setConfirming({
      url: approveUrl,
      ...details,
      done: (went) => {
        setConfirming(null);
        resolve(went);
      },
    }),
  );
}

/**
 * Pays with a flick, from the PayPal the person signed in with: `pay` runs once they've flicked (or
 * tapped). Resolves true once it's paid, false if they backed out; nothing is paid until they flick.
 */
export function flickToPay(pay: () => Promise<unknown>, details: { amount?: number; to?: string } = {}): Promise<boolean> {
  return new Promise((resolve) =>
    setConfirming({
      pay,
      ...details,
      done: (went) => {
        setConfirming(null);
        resolve(went);
      },
    }),
  );
}

/** Where PayPal just brought the person back from (a payment, or signing in), read once when the page loads. */
export const returned =
  typeof window === "undefined"
    ? null
    : (() => {
        const params = new URLSearchParams(window.location.search);
        const paid = params.get("paid");
        const checkout = params.get("checkout");
        return paid ? { paid } : checkout ? { checkout } : params.has("signedin") ? { paid: "signedin" } : null;
      })();

/** Days since an ISO date. */
export const daysSince = (iso: string) => Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 86_400_000));
