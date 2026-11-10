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

/** Sends the person to PayPal to approve a checkout; PayPal brings them back to /?paid=… */
export const approveOnPayPal = (approveUrl: string) => window.location.assign(approveUrl);

/** Where PayPal just brought the person back from, read once when the page loads. */
export const returned =
  typeof window === "undefined"
    ? null
    : (() => {
        const params = new URLSearchParams(window.location.search);
        const paid = params.get("paid");
        const checkout = params.get("checkout");
        return paid ? { paid } : checkout ? { checkout } : null;
      })();

/** Days since an ISO date. */
export const daysSince = (iso: string) => Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 86_400_000));
