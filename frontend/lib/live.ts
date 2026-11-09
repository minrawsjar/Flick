"use client";

import { useSyncExternalStore } from "react";
import type { Scan, State } from "@backend/model";

// The one-pager's link to the backend. When the backend answers and PayPal is configured, the
// page is "live": its demos read and change real state through the API (the browser reaches it via
// the /api/* rewrite). Otherwise it stays on demo data, so it never breaks.

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
  }
  return () => listeners.delete(listener);
}

const serverSnapshot: Snapshot = { mode: "loading", state: null, receipt: null };
export const useLive = () => useSyncExternalStore(subscribe, () => snapshot, () => serverSnapshot);

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
