"use client";

import { Camera, CameraOff, ChevronUp, LoaderCircle, Pointer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Logo, Primary, Secondary } from "@/components/ui";
import { isFlick, gray, motion, type Motion } from "@/lib/flick";
import { usd } from "@/lib/format";
import { refresh, useConfirming, type Confirming } from "@/lib/live";

// "Flick to pay": before PayPal opens, a sheet asks for one flick of the hand across the front
// camera (lib/flick.ts spots it). The camera's frames stay in the browser: nothing is recorded or
// sent. No camera, or no permission: a tap does it instead. "Not now" cancels the PayPal checkout,
// just as cancelling on PayPal's page would. Every payment comes here, through approveOnPayPal.

type CameraState = "starting" | "on" | "off";
type Phase = "waiting" | "flicked" | "cancelling";

const stop = (media: MediaStream | null) => media?.getTracks().forEach((t) => t.stop());

export function FlickConfirm() {
  const confirming = useConfirming();
  // A new payment, a new sheet: its camera and phase start over.
  return confirming ? <Sheet key={confirming.url} confirming={confirming} /> : null;
}

function Sheet({ confirming }: { confirming: Confirming }) {
  const { url, amount, to, done } = confirming;
  const [camera, setCamera] = useState<CameraState>("starting");
  const [phase, setPhase] = useState<Phase>("waiting");
  const video = useRef<HTMLVideoElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const stream = useRef<MediaStream | null>(null);
  // The camera loop calls the latest `go` (set after each render) when it sees a flick.
  const onFlick = useRef<() => void>(() => {});

  const stopCamera = () => {
    stop(stream.current);
    stream.current = null;
  };

  // Flicked (or tapped): the card flies off, and PayPal opens.
  const go = () => {
    if (phase !== "waiting") return;
    stopCamera();
    setPhase("flicked");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => window.location.assign(url), still ? 0 : 650);
  };
  useEffect(() => {
    onFlick.current = go;
  });

  const cancel = async () => {
    if (phase !== "waiting") return;
    stopCamera();
    setPhase("cancelling");
    const token = new URL(url).searchParams.get("token");
    // The same route PayPal's own cancel link takes: the checkout is cancelled, the bill put back.
    if (token) await fetch(`/api/paypal/cancel?token=${encodeURIComponent(token)}`, { redirect: "manual" }).catch(() => {});
    await refresh();
    done(false);
  };

  // The front camera, unseen, read about 30 times a second at 64×48: enough to catch a quick flick.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      try {
        const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } }, audio: false });
        if (stopped) return stop(media);
        stream.current = media;
        video.current!.srcObject = media;
        await video.current!.play();
        setCamera("on");
      } catch {
        if (!stopped) setCamera("off");
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 48;
      const g = canvas.getContext("2d", { willReadFrequently: true })!;
      const started = performance.now();
      const recent: Motion[] = [];
      let prev: Uint8Array | null = null;
      const look = () => {
        if (stopped || !stream.current) return;
        g.drawImage(video.current!, 0, 0, 64, 48);
        const next = gray(g.getImageData(0, 0, 64, 48).data);
        const now = performance.now();
        // The first moments are the camera finding its exposure, not a hand.
        if (prev && now - started > 600) {
          const m = motion(prev, next, 64, now);
          recent.push(m);
          while (recent.length && now - recent[0].t > 1000) recent.shift();
          // Straight to the DOM: this runs 30 times a second, React needn't re-render for it.
          if (glow.current) glow.current.style.opacity = String(Math.min(1, m.amount * 8));
          if (isFlick(recent, now)) return onFlick.current();
        }
        prev = next;
        timer = setTimeout(look, 33);
      };
      look();
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stop(stream.current);
      stream.current = null;
    };
  }, []);

  // Escape backs out; coming back from PayPal with the browser's Back button closes the sheet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && void cancel();
    const onShow = (e: PageTransitionEvent) => e.persisted && done(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pageshow", onShow);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pageshow", onShow);
      document.documentElement.style.overflow = "";
    };
  });

  const flicked = phase === "flicked";
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 backdrop-blur-sm fade-in sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="flick-title"
        className="sheet-up w-full max-w-[420px] rounded-t-[28px] bg-card p-5 pb-[calc(20px+env(safe-area-inset-bottom))] text-ink shadow-2xl sm:rounded-[28px]"
      >
        <div className="flex items-center gap-2 text-[13px] text-secondary">
          <Logo size={22} /> Flick to pay
        </div>
        <h2 id="flick-title" className="mt-3 text-[34px] font-semibold leading-none tracking-tight tabular-nums">
          {amount !== undefined ? `Pay ${usd(amount)}` : "Pay with PayPal"}
        </h2>
        <p className="mt-1.5 text-[14px] text-secondary">{to ? `To ${to}, with PayPal` : "With PayPal"}</p>

        <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_50%_70%,#12305a,#0b0b0c_75%)]">
          {/* The camera is read, never shown: the video stays a pixel, out of sight. */}
          <video ref={video} muted playsInline aria-hidden className="pointer-events-none absolute left-0 top-0 size-px opacity-0" />
          <div ref={glow} className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 shadow-[inset_0_0_0_4px_#0070e0,inset_0_0_60px_rgba(0,112,224,0.6)] transition-opacity duration-150" />

          {camera === "on" && !flicked && (
            <>
              {/* One finger, flicking up, again and again: what to do. */}
              <div className="absolute inset-x-0 top-5 flex flex-col items-center text-white/80" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <ChevronUp key={i} size={22} strokeWidth={2.5} className="loop-flick-hint -my-1.5" style={{ animationDelay: `${(2 - i) * 140}ms` }} />
                ))}
              </div>
              <Pointer size={76} strokeWidth={1.5} className="loop-finger-flick absolute left-1/2 top-[38%] -ml-[38px] text-white" aria-hidden />
              <p className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-black/45 px-3 py-1 text-[13px] text-white backdrop-blur">
                Flick one finger up, in front of the camera
              </p>
            </>
          )}
          {camera === "starting" && (
            <p className="absolute inset-0 flex items-center justify-center gap-1.5 text-[13px] text-white/80">
              <Camera size={16} aria-hidden /> Turning on the camera…
            </p>
          )}
          {camera === "off" && !flicked && (
            <p className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center text-[13px] text-white/80">
              <CameraOff size={22} aria-hidden />
              No camera to flick at here. Tap below to pay instead.
            </p>
          )}

          {/* The flick lands: a PayPal-blue card flies off the top. */}
          <div
            className="absolute inset-x-8 top-1/2 flex h-[120px] -translate-y-1/2 flex-col justify-between rounded-2xl bg-gradient-to-br from-[#0070e0] to-[#003087] p-4 text-white shadow-xl"
            style={{
              opacity: flicked ? 1 : 0,
              transform: flicked ? "translateY(-260%) rotate(-10deg) scale(0.9)" : "translateY(-50%)",
              transition: flicked ? "transform 600ms cubic-bezier(0.55, 0, 0.75, 0.2) 120ms, opacity 120ms" : "none",
            }}
            aria-hidden
          >
            <span className="flex items-center justify-between text-[12px] font-medium opacity-90">
              <span>Flick</span>
              <span>PayPal</span>
            </span>
            <span className="text-[26px] font-semibold tabular-nums">{amount !== undefined ? usd(amount) : "Approve"}</span>
          </div>
          {flicked && (
            <p className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-1.5 text-[13px] text-white">
              <LoaderCircle size={14} className="spinner" aria-hidden /> Opening PayPal…
            </p>
          )}
        </div>

        <p className="mt-2 text-center text-[11px] leading-4 text-secondary">
          The camera only looks for your flick, here on this device. Nothing is recorded or sent.
        </p>
        <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
          <Secondary onClick={() => void cancel()} disabled={phase !== "waiting"}>
            {phase === "cancelling" ? <LoaderCircle size={14} className="spinner" /> : "Not now"}
          </Secondary>
          <Primary onClick={go} disabled={phase !== "waiting"}>
            {camera === "on" ? "Tap to pay instead" : "Pay on PayPal"}
          </Primary>
        </div>
      </div>
    </div>
  );
}
