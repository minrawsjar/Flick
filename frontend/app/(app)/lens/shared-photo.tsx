"use client";

import { CircleCheck, Info, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { act, useLive } from "@/lib/live";
import { usd } from "@/lib/format";
import { forLens, pdfForLens } from "@/app/_landing/lens";
import type { Scan } from "@backend/model";

// A bill shared to Flick from another app (Android's share sheet: app/manifest.ts share_target): a
// photo, an e-bill's PDF, or a bill as text (an e-mail's). public/sw.js keeps it and opens
// /lens?shared=1; this reads it with Lens, and the Lens phone below then shows the new scan, ready
// to pay.

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
      if (shared !== "1") return setNote({ text: "What you shared didn't come through. Snap it or upload it here instead." });
      if (!canRead) return setNote({ text: "Lens can't read bills right now: Flick's AI is off." });
      setNote({ busy: true, text: "Lens is reading what you shared…" });
      try {
        const cache = await caches.open("flick-share");
        const [file, text] = await Promise.all([cache.match("/shared-photo"), cache.match("/shared-text")]);
        const blob = await file?.blob();
        const body = blob ? (blob.type === "application/pdf" ? { pdf: await pdfForLens(blob) } : await forLens(blob)) : text ? { text: await text.text() } : null;
        if (!body) throw new Error("What you shared didn't come through. Snap it or upload it here instead.");
        const scan = await act<Scan>("lens/read", body);
        await Promise.all([cache.delete("/shared-photo"), cache.delete("/shared-text")]);
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
