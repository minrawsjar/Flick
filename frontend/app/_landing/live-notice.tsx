"use client";

import { CircleCheck, Info } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { returned } from "@/lib/live";

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
    <div role="status" className="rise fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <p className="flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[14px] text-on-ink shadow-[0_10px_30px_-8px_rgba(0,0,0,0.4)]">
        {ok ? <CircleCheck size={17} className="text-[#34c759]" /> : <Info size={17} />}
        {text}
      </p>
    </div>
  );
}
