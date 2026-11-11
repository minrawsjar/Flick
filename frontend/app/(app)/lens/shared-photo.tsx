"use client";

import { CircleCheck, Info, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { act, useLive } from "@/lib/live";
import { usd } from "@/lib/format";
import { forLens } from "@/app/_landing/lens";
import type { Scan } from "@backend/model";

// A photo shared to Flick from another app (Android's share sheet: app/manifest.ts share_target).
// public/sw.js keeps it and opens /lens?shared=1; this reads it with Lens, and the Lens phone
// below then shows the new scan, ready to pay.

type Note = { busy?: boolean; ok?: boolean; text: string };

export function SharedPhoto() {
  const live = useLive();
  const [note, setNote] = useState<Note | null>(null);
  const done = useRef(false);

  useEffect(() => {
    const shared = new URLSearchParams(window.location.search).get("shared");
    if (!shared || done.current || live.mode === "loading") return;
    done.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    const canRead = live.mode === "live" && live.state?.config.ai;

    void (async () => {
      if (shared !== "1") return setNote({ text: "That photo didn't come through. Snap it here instead." });
      if (!canRead) return setNote({ text: "Lens can't read photos right now: Flick's AI is off." });
      setNote({ busy: true, text: "Lens is reading the photo you shared…" });
      try {
        const cache = await caches.open("flick-share");
        const photo = await cache.match("/shared-photo");
        if (!photo) throw new Error("That photo didn't come through. Snap it here instead.");
        const scan = await act<Scan>("lens/read", await forLens(await photo.blob()));
        await cache.delete("/shared-photo");
        setNote({ ok: true, text: `Lens read ${scan.title}${scan.amount ? `, ${usd(scan.amount)}` : ""}. It's below, ready to pay.` });
      } catch (err) {
        setNote({ text: err instanceof Error ? err.message : String(err) });
      }
    })();
  }, [live.mode, live.state?.config.ai]);

  if (!note) return null;
  const Icon = note.busy ? LoaderCircle : note.ok ? CircleCheck : Info;
  return (
    <p role="status" className="mx-auto mt-4 flex w-fit max-w-[calc(100%-2rem)] items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] text-on-ink">
      <Icon size={15} className={note.busy ? "spinner" : note.ok ? "text-[#34c759]" : ""} aria-hidden />
      {note.text}
    </p>
  );
}
