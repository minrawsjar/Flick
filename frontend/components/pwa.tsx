"use client";

import { useEffect, useSyncExternalStore } from "react";
import { encode } from "uqr";

// Flick as an installed app: the service worker (public/sw.js), and how this browser installs it.
// Chrome, Edge and Android offer an install prompt we can trigger; Safari installs from its own
// menus, so /install shows the steps instead.

/** Registers the service worker. Production only: in dev it would cache files mid-edit. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
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
