"use client";

import { Bell, BellOff, LoaderCircle } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { encode } from "uqr";

// Flick as an installed app: the service worker (public/sw.js), and how this browser installs it.
// Chrome, Edge and Android offer an install prompt we can trigger; Safari installs from its own
// menus, so /install shows the steps instead.

/**
 * Registers the service worker. Production only: in dev it would cache files mid-edit. Each build
 * registers its own (?v=), whose caches start fresh, so an installed app never keeps showing the
 * last deploy's pages; when it takes over from an older one, the page reloads once onto this build.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const updating = Boolean(navigator.serviceWorker.controller);
    const reload = () => updating && window.location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", reload, { once: true });
    navigator.serviceWorker.register(`/sw.js?v=${process.env.NEXT_PUBLIC_BUILD}`, { scope: "/", updateViaCache: "none" }).catch(() => {});
    return () => navigator.serviceWorker.removeEventListener("controllerchange", reload);
  }, []);
  return null;
}

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let prompt: PromptEvent | null = null;
let justInstalled = false;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    prompt = event as PromptEvent;
    changed();
  });
  window.addEventListener("appinstalled", () => {
    prompt = null;
    justInstalled = true;
    changed();
  });
}

/**
 * How Flick installs here: "installed" (running as the app, or just installed), "prompt" (one tap),
 * "ios" (Share, then Add to Home Screen), "mac-safari" (File, then Add to Dock), or "menu" (the
 * browser's own menu, or another browser). "unknown" while rendering on the server.
 */
export type InstallWay = "installed" | "prompt" | "ios" | "mac-safari" | "menu" | "unknown";

function way(): InstallWay {
  const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
  if (standalone || justInstalled) return "installed";
  if (prompt) return "prompt";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua)) return "mac-safari";
  return "menu";
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useInstallWay = () => useSyncExternalStore(subscribe, way, () => "unknown" as const);

/** Opens the browser's install prompt, when it offered one. */
export async function install() {
  if (!prompt) return;
  await prompt.prompt();
  await prompt.userChoice;
  prompt = null;
  changed();
}

/** A QR code, black on white in either theme, which every phone camera reads. */
export function QrCode({ text, size = 168 }: { text: string; size?: number }) {
  const { size: n, data } = encode(text, { ecc: "M", border: 2 });
  let path = "";
  data.forEach((row, y) => row.forEach((dark, x) => dark && (path += `M${x} ${y}h1v1h-1z`)));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" role="img" aria-label={`QR code for ${text}`}>
      <rect width={n} height={n} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}

// --- Notifications ------------------------------------------------------------------------

const never = () => () => {};
/** Whether this browser can get Flick's notifications: iPhones only once Flick is on the home screen. */
const pushSupport = () =>
  !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)
    ? /iPhone|iPad/.test(navigator.userAgent)
      ? "install"
      : "unsupported"
    : Notification.permission === "denied"
      ? "denied"
      : "ok";

const keyBytes = (b64: string) => Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));

/** Turns the agents' notifications on or off for this browser (backend/src/push.ts sends them). */
export function Notify() {
  const support = useSyncExternalStore(never, pushSupport, () => "unknown");
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (support !== "ok") return;
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setOn(Boolean(sub)))
      .catch(() => setOn(false));
  }, [support]);

  const toggle = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) throw new Error("Notifications come with the installed app (production builds only).");
      if (on) {
        const sub = await reg.pushManager.getSubscription();
        await fetch("/api/push/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub?.endpoint }) });
        await sub?.unsubscribe();
        setOn(false);
        return;
      }
      if ((await Notification.requestPermission()) !== "granted") throw new Error("Notifications are blocked for Flick in your browser's settings.");
      const { publicKey } = (await (await fetch("/api/push/key")).json()) as { publicKey: string };
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: { message?: string } }).error?.message ?? `Flick's backend answered ${res.status}.`);
      setOn(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (support === "unknown" || support === "unsupported") return null;
  if (support === "install" || support === "denied") {
    return <span className="text-[12px] text-secondary">{support === "install" ? "Add Flick to your home screen for notifications" : "Notifications are blocked"}</span>;
  }
  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy || on === null}
        aria-pressed={Boolean(on)}
        className={`pressable flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12px] disabled:cursor-default ${on ? "bg-fill" : "bg-ink text-on-ink"}`}
      >
        {busy ? <LoaderCircle size={13} className="spinner" /> : on ? <Bell size={13} /> : <BellOff size={13} />}
        {on ? "Notifications on" : "Notify me"}
      </button>
      {error && <span className="max-w-60 text-right text-[11px] leading-4 text-wait">{error}</span>}
    </span>
  );
}
