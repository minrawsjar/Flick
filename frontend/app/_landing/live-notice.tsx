"use client";

import { CircleCheck, CloudOff, Info } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { returned, useLive } from "@/lib/live";

const onConnection = (listener: () => void) => {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
};
const useOnline = () => useSyncExternalStore(onConnection, () => navigator.onLine, () => true);

/** On the working pages: says so when they've fallen back to the demo. */
export function BackendNotice() {
  const live = useLive();
  const online = useOnline();
  if (live.mode !== "demo" || !online) return null;
  return (
    <p className="mx-auto mt-4 w-fit max-w-[calc(100%-2rem)] rounded-full bg-wait/15 px-4 py-1.5 text-center text-[13px] text-wait">
      Can&apos;t reach Flick&apos;s backend right now, so this page is playing the demo.
    </p>
  );
}

/** Offline, the installed app shows what Flick last knew (public/sw.js keeps a copy). */
export function OfflineNotice() {
  if (useOnline()) return null;
  return (
    <p className="mx-auto mt-4 flex w-fit max-w-[calc(100%-2rem)] items-center gap-1.5 rounded-full bg-fill px-4 py-1.5 text-center text-[13px]">
      <CloudOff size={14} aria-hidden /> You&apos;re offline: this is what Flick last knew. Paying waits until you&apos;re back.
    </p>
  );
}

const messages: Record<string, [ok: boolean, text: string]> = {
  week: [true, "Week approved with PayPal. Autopilot takes it from here."],
  scan: [true, "Paid with PayPal. Flick has paid them."],
  cancelled: [false, "PayPal checkout cancelled. Nothing was paid."],
  failed: [false, "That payment didn't go through. Nothing was taken; the backend's log says why."],
};

const never = () => () => {};

/** After PayPal sends the person back: what happened, for a few seconds. */
export function ReturnNotice() {
  // Only the browser knows the URL; on the server (and while hydrating) there's nothing to say.
  const info = useSyncExternalStore(never, () => returned, () => null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!info) return;
    // Tidy the address bar, keeping the #section PayPal returned to.
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.hash}`);
    const t = setTimeout(() => setHidden(true), 7000);
    return () => clearTimeout(t);
  }, [info]);

  const message = info && messages[info.paid ?? info.checkout ?? ""];
  if (!message || hidden) return null;
  const [ok, text] = message;
  return (
    <div role="status" className="rise fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-40 lg:bottom-6 flex justify-center px-4">
      <p className="flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[14px] text-on-ink shadow-[0_10px_30px_-8px_rgba(0,0,0,0.4)]">
        {ok ? <CircleCheck size={17} className="text-[#34c759]" /> : <Info size={17} />}
        {text}
      </p>
    </div>
  );
}
