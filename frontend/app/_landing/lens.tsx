"use client";

import type { Scan } from "@backend/model";
import { Camera, CircleCheck, LoaderCircle, Repeat, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bot } from "@/components/bot";
import { Phone } from "@/components/phone";
import { Primary, Secondary, Tile, useOnScreen, Wire } from "@/components/ui";
import { usd } from "@/lib/format";
import { act, approveOnPayPal, handReceipt, returned, useLive } from "@/lib/live";
import { agents, sampleFromScan, samples, type Sample, type SampleKind } from "./data";

// Lens: point the camera at something you need to pay, and it reads who, how much and when.
// The hero's phone plays through the samples on its own; the Snap section lets you pick one,
// then shows what Lens read and the PayPal calls that pay it.

export type LensStage = "idle" | "scanning" | "read" | "paying" | "paid";

// --- The samples, drawn -----------------------------------------------------------------

const bars = [1, 2, 1, 3, 1, 1, 2, 1, 2, 3, 1, 1, 2, 1, 3, 1, 2, 1, 1, 2, 3, 1, 2, 1, 1, 3, 1, 2];
// Each bar's left edge, in units of the thinnest bar; bars are one unit apart.
const offsets = bars.map((_, i) => bars.slice(0, i).reduce((a, b) => a + b + 1, 0));
const units = offsets.at(-1)! + bars.at(-1)!;

function Barcode({ x, y, h, w }: { x: number; y: number; h: number; w: number }) {
  const unit = w / units;
  return (
    <g fill="#1c1c1c">
      {bars.map((b, i) => (
        <rect key={i} x={x + offsets[i] * unit} y={y} width={b * unit} height={h} />
      ))}
    </g>
  );
}

const qr = ["1110111", "1010101", "1110111", "0001000", "1101011", "0110110", "1011101"];

/** A photo of each sample: a bill, a receipt, a price tag and a tip jar. */
export function Doc({ kind, width = 120 }: { kind: SampleKind; width?: number }) {
  const t = { fontFamily: "inherit" };
  return (
    <svg width={width} height={width * 1.25} viewBox="0 0 120 150" aria-hidden className="shrink-0 drop-shadow-[0_6px_14px_rgba(0,0,0,0.35)]" style={t}>
      {kind === "bill" && (
        <>
          <rect x="4" y="2" width="112" height="146" rx="4" fill="#fff" />
          <rect x="14" y="13" width="11" height="11" rx="3" fill="#FACC15" />
          <path d="M20.5 15 l-3 4.2 h2.6 l-1.6 3.6 l4 -5 h-2.6z" fill="#1c1c1c" />
          <text x="29" y="22" fontSize="8.5" fontWeight="700">CITY POWER</text>
          <text x="14" y="36" fontSize="5.2" fill="#6e6e73">Electricity statement · November 2026</text>
          <rect x="14" y="44" width="70" height="3" rx="1.5" fill="#e5e5ea" />
          <rect x="14" y="51" width="88" height="3" rx="1.5" fill="#e5e5ea" />
          <rect x="14" y="58" width="58" height="3" rx="1.5" fill="#e5e5ea" />
          <rect x="14" y="70" width="92" height="32" rx="5" fill="#f5f5f7" />
          <text x="20" y="81" fontSize="5.2" fill="#6e6e73">Amount due</text>
          <text x="20" y="95" fontSize="12" fontWeight="700">$64.20</text>
          <text x="100" y="81" fontSize="5.2" fill="#6e6e73" textAnchor="end">Due</text>
          <text x="100" y="95" fontSize="8" fontWeight="600" textAnchor="end">Nov 11</text>
          <text x="14" y="113" fontSize="5.2" fill="#6e6e73">Account •••• 4821</text>
          <Barcode x={14} y={119} h={18} w={92} />
        </>
      )}
      {kind === "receipt" && (
        <>
          <path d="M26 2 h68 v140 l-5.7 6 l-5.7 -6 l-5.7 6 l-5.6 -6 l-5.7 6 l-5.7 -6 l-5.7 6 l-5.6 -6 l-5.7 6 l-5.7 -6 l-5.7 6 l-5.6 -6z" fill="#fff" />
          <text x="60" y="16" fontSize="7.5" fontWeight="700" textAnchor="middle">NORI SUSHI</text>
          <text x="60" y="24" fontSize="4.6" fill="#6e6e73" textAnchor="middle">Table 7 · 4 guests</text>
          {[
            ["Salmon roll", "14.00"],
            ["Dragon roll", "16.50"],
            ["Gyoza", "8.50"],
            ["Edamame", "6.00"],
            ["Miso soup ×2", "7.00"],
            ["Green tea ×4", "16.00"],
          ].map(([n, p], i) => (
            <g key={n} fontSize="5">
              <text x="31" y={37 + i * 9}>{n}</text>
              <text x="89" y={37 + i * 9} textAnchor="end">{p}</text>
            </g>
          ))}
          <line x1="31" x2="89" y1="88" y2="88" stroke="#c6c6c8" strokeDasharray="2 1.5" strokeWidth="0.8" />
          {[
            ["Tax", "6.04"],
            ["Tip 18%", "12.24"],
          ].map(([n, p], i) => (
            <g key={n} fontSize="5" fill="#6e6e73">
              <text x="31" y={97 + i * 8}>{n}</text>
              <text x="89" y={97 + i * 8} textAnchor="end">{p}</text>
            </g>
          ))}
          <text x="31" y="124" fontSize="7" fontWeight="700">TOTAL</text>
          <text x="89" y="124" fontSize="7" fontWeight="700" textAnchor="end">$86.28</text>
          <text x="60" y="136" fontSize="4.6" fill="#6e6e73" textAnchor="middle">Thank you!</text>
        </>
      )}
      {kind === "tag" && (
        <g transform="rotate(-6 60 75)">
          <line x1="60" y1="-6" x2="60" y2="20" stroke="#c6c6c8" strokeWidth="1.2" />
          <path d="M28 12 h64 a7 7 0 0 1 7 7 v114 a7 7 0 0 1 -7 7 h-64 a7 7 0 0 1 -7 -7 v-114 a7 7 0 0 1 7 -7z" fill="#fff" />
          <circle cx="60" cy="22" r="4" fill="#3a3a3c" />
          <text x="60" y="42" fontSize="6.5" fontWeight="700" textAnchor="middle" letterSpacing="1">STRIDE CO</text>
          <text x="60" y="58" fontSize="7.5" textAnchor="middle">Trail runners</text>
          <text x="60" y="68" fontSize="5.2" fill="#6e6e73" textAnchor="middle">Men&apos;s · Size 10</text>
          <text x="60" y="94" fontSize="17" fontWeight="700" textAnchor="middle">$89</text>
          <Barcode x={33} y={108} h={16} w={54} />
          <text x="60" y="132" fontSize="4.6" fill="#6e6e73" textAnchor="middle">SKU 40021-10</text>
        </g>
      )}
      {kind === "tip" && (
        <>
          <rect x="36" y="6" width="48" height="12" rx="3" fill="#a1a1a6" />
          <path d="M30 18 h60 a10 10 0 0 1 10 10 v104 a14 14 0 0 1 -14 14 h-52 a14 14 0 0 1 -14 -14 v-104 a10 10 0 0 1 10 -10z" fill="rgba(255,255,255,0.82)" stroke="#d1d1d6" />
          <circle cx="44" cy="134" r="7" fill="#FACC15" />
          <circle cx="58" cy="137" r="7" fill="#e5e5ea" />
          <circle cx="72" cy="133" r="7" fill="#FACC15" />
          <circle cx="64" cy="125" r="6" fill="#d1d1d6" />
          <rect x="34" y="40" width="52" height="66" rx="5" fill="#fff" />
          <text x="60" y="54" fontSize="9" fontWeight="700" textAnchor="middle" letterSpacing="1.5">TIPS</text>
          <g transform="translate(46 60)" fill="#1c1c1c">
            {qr.flatMap((row, y) => [...row].map((c, x) => (c === "1" ? <rect key={`${x}-${y}`} x={x * 4} y={y * 4} width="4" height="4" /> : null)))}
          </g>
          <text x="60" y="100" fontSize="5" fill="#6e6e73" textAnchor="middle">@beanthere</text>
        </>
      )}
    </svg>
  );
}

// --- The phone screen --------------------------------------------------------------------

function Corner({ className, on }: { className: string; on: boolean }) {
  return <span className={`absolute size-6 border-[3px] transition-colors duration-300 ${on ? "border-[#36D1DC]" : "border-white/90"} ${className}`} />;
}

/** Lens on the phone: the camera, the scan, and what it read with the one action. */
export function LensScreen({
  sample,
  stage,
  run = 0,
  onAct,
  onAlt,
  recurring = true,
  onRecurring,
  photo,
  hint,
}: {
  sample: Sample;
  stage: LensStage;
  /** A real photo to show instead of the drawn sample. */
  photo?: string;
  /** Replaces the camera's hint, e.g. with an error. */
  hint?: string;
  /** Changes on each new scan, to replay the animations. */
  run?: number;
  onAct?: () => void;
  /** The second action: splitting a receipt instead of paying it. */
  onAlt?: () => void;
  recurring?: boolean;
  onRecurring?: (on: boolean) => void;
}) {
  const read = stage === "read" || stage === "paying" || stage === "paid";

  return (
    <div className="flex h-full flex-col bg-[#0b0b0c] text-white">
      <div className="flex items-center justify-between px-4 pb-1 pt-1">
        <h4 className="text-[22px] font-semibold tracking-tight">Lens</h4>
        <span className="flex size-7 items-center justify-center rounded-full bg-white/15">
          <Zap size={13} />
        </span>
      </div>

      <div className="relative mx-2 min-h-0 flex-1 overflow-hidden rounded-[22px] bg-[radial-gradient(circle_at_50%_40%,#4a4033,#1f1b16_75%)]">
        {/* Once read, the locked-on document shrinks up out of the way of the result card. */}
        <div
          className="absolute inset-0 transition-transform duration-500"
          style={{ transform: read ? "translateY(-23%) scale(0.72)" : "none", transitionTimingFunction: "var(--ease-spring)" }}
        >
          <div key={run} className="rise absolute inset-0 flex items-center justify-center pb-10">
            {photo ? (
              // A data URL from the person's own camera; next/image adds nothing here.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="max-h-[78%] max-w-[78%] rounded-md object-contain shadow-[0_6px_14px_rgba(0,0,0,0.35)]" />
            ) : (
              <div className="-rotate-3">
                <Doc kind={sample.kind} width={128} />
              </div>
            )}
          </div>
          <div className="absolute inset-x-[18%] bottom-[22%] top-[6%]">
            <Corner on={read} className="left-0 top-0 rounded-tl-lg border-b-0 border-r-0" />
            <Corner on={read} className="right-0 top-0 rounded-tr-lg border-b-0 border-l-0" />
            <Corner on={read} className="bottom-0 left-0 rounded-bl-lg border-r-0 border-t-0" />
            <Corner on={read} className="bottom-0 right-0 rounded-br-lg border-l-0 border-t-0" />
            {stage === "scanning" && (
              <span className="loop-scan absolute inset-x-1 h-0.5 rounded-full bg-[#36D1DC] shadow-[0_0_12px_3px_rgba(54,209,220,0.75)]" />
            )}
          </div>
        </div>

        {!read && (
          <div className="absolute inset-x-0 bottom-3 flex flex-col items-center gap-2">
            <p className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] text-white/85 backdrop-blur">
              {stage === "scanning" ? (
                <span className="flex items-center gap-1">
                  <LoaderCircle size={11} className="spinner" /> Reading {sample.heard}…
                </span>
              ) : (
                (hint ?? "Point at a bill, receipt, tag or tip jar")
              )}
            </p>
          </div>
        )}

        {read && (
          <div key={`card-${run}`} className="rise absolute inset-x-1.5 bottom-1.5 rounded-[18px] bg-card p-3 text-ink">
            <p className="flex items-center gap-1.5 text-[11px] text-secondary">
              <Bot {...agents.lens} size={16} mood="awake" /> Lens read {sample.heard}
            </p>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <p className="truncate text-[15px]">{sample.title}</p>
              <p className="text-[18px] tabular-nums">{sample.shown ?? usd(sample.amount)}</p>
            </div>
            <p className="text-[12px] text-secondary">{sample.sub}</p>

            {stage === "read" && sample.action && (
              <>
                <Primary onClick={onAct} className="mt-2.5">
                  {sample.action}
                </Primary>
                {sample.alt && (
                  <Secondary onClick={onAlt} className="mt-1.5 w-full">
                    {sample.alt}
                  </Secondary>
                )}
                {sample.kind === "bill" && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={recurring}
                    onClick={() => onRecurring?.(!recurring)}
                    className="mt-2 flex w-full cursor-pointer items-center gap-1.5 text-left text-[12px]"
                  >
                    <Repeat size={13} className="text-secondary" />
                    <span className="flex-1">Pay it every month</span>
                    <span className={`flex h-[18px] w-[30px] items-center rounded-full p-0.5 transition-colors ${recurring ? "justify-end bg-[#34c759]" : "bg-fill"}`}>
                      <span className="size-3.5 rounded-full bg-white shadow" />
                    </span>
                  </button>
                )}
              </>
            )}
            {stage === "paying" && (
              <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-secondary">
                <LoaderCircle size={13} className="spinner" />
                {sample.action.startsWith("Split") ? "Sending PayPal requests…" : "Paying with PayPal…"}
              </p>
            )}
            {stage === "paid" && (
              <p className="rise mt-2.5 flex items-center gap-1.5 text-[12px] text-paid">
                <CircleCheck size={15} fill="#34c759" color="#fff" />
                {sample.kind === "bill" && !recurring ? "Paid with PayPal" : sample.done}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex h-[74px] shrink-0 items-center justify-center">
        <span className={`flex size-[52px] items-center justify-center rounded-full border-[3px] border-white transition-opacity ${read ? "opacity-40" : ""}`}>
          <span className="size-[40px] rounded-full bg-white" />
        </span>
      </div>
    </div>
  );
}

// --- Hero: Lens plays through every sample on its own -------------------------------------

const heroTimings: Record<LensStage, number> = { idle: 600, scanning: 1600, read: 1700, paying: 900, paid: 1700 };
const nextStage: Record<LensStage, LensStage> = { idle: "scanning", scanning: "read", read: "paying", paying: "paid", paid: "scanning" };

export function HeroLens({ width }: { width: number }) {
  const [i, setI] = useState(0);
  const [stage, setStage] = useState<LensStage>("idle");

  useEffect(() => {
    const t = setTimeout(() => {
      if (stage === "paid") setI((n) => (n + 1) % samples.length);
      setStage(nextStage[stage]);
    }, heroTimings[stage]);
    return () => clearTimeout(t);
  }, [stage]);

  return (
    <Phone width={width} background="#0b0b0c" dark tab="Lens">
      <div className="h-full pb-[68px]">
        <LensScreen sample={samples[i]} stage={stage} run={i} />
      </div>
    </Phone>
  );
}

// --- Snap: watch a sample, or snap your own and pay it ---------------------------------------
//
// The samples are a walkthrough: Lens "reads" one and its payment plays out, and nothing is
// charged. Your own photo is real: the vision model reads it, and paying goes through PayPal's
// sandbox checkout, into your own workspace and Money Studio.

/** A phone photo as a JPEG, its longer side `longest` px at most: to upload quickly, or to keep. */
export async function shrink(file: Blob, longest = 1600, quality = 0.85): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, longest / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d")!;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

/** What Lens uploads for a photo: a copy to read (Lens reads it just as well), and a small one to keep. */
export async function forLens(file: Blob) {
  const [image, photo] = await Promise.all([shrink(file), shrink(file, 480, 0.6)]);
  return { image, photo };
}

type View = { sample: Sample; scan?: Scan; photo?: string; live?: boolean };

/** How many scans Recent scans lists: as many as keep their photo (PHOTOS_KEPT in rules.ts). */
const RECENT = 10;

const scanStatus: Record<Scan["status"], [label: string, className: string]> = {
  read: ["Read", "text-secondary"],
  awaiting: ["Waiting for PayPal", "text-wait"],
  paid: ["Paid", "text-paid"],
};

/** Your scans, newest first: tap one to see it in the phone again, and pay it if it isn't paid. */
function RecentScans({ scans, open, on }: { scans: Scan[]; open: (scan: Scan) => void; on?: string }) {
  return (
    <Tile className="md:col-span-2">
      <p className="text-[13px] text-secondary">Recent scans</p>
      <div className="-mx-1 mt-2 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
        {scans.map((scan) => {
          const sample = sampleFromScan(scan);
          const [label, tone] = scanStatus[scan.status];
          return (
            <button
              key={scan.id}
              type="button"
              aria-pressed={scan.id === on}
              onClick={() => open(scan)}
              className={`pressable flex w-[136px] shrink-0 snap-start cursor-pointer flex-col gap-1.5 rounded-2xl p-2 text-left transition-colors ${scan.id === on ? "bg-ink text-on-ink" : "bg-raised"}`}
            >
              <span className="flex h-[76px] items-center justify-center overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_40%,#4a4033,#1f1b16_80%)]">
                {scan.photo ? (
                  // A data URL Lens kept; next/image adds nothing here.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={scan.photo} alt="" className="size-full object-cover" />
                ) : (
                  <Doc kind={sample.kind} width={44} />
                )}
              </span>
              <span className="truncate text-[13px] leading-4">{scan.title}</span>
              <span className="text-[12px] tabular-nums leading-4">{scan.kind === "tip" ? "Tip jar" : (sample.shown ?? usd(sample.amount))}</span>
              <span className={`text-[12px] leading-4 ${scan.id === on ? "" : tone}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </Tile>
  );
}

export function Snap() {
  const live = useLive();
  const canRead = live.mode === "live" && Boolean(live.state?.config.ai);
  const [view, setView] = useState<View | null>(null);
  const [stage, setStage] = useState<LensStage>("idle");
  const [run, setRun] = useState(0);
  const [shown, setShown] = useState(0);
  const [at, setAt] = useState(-1);
  const [recurring, setRecurring] = useState(true);
  const [error, setError] = useState<string>();
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Until you tap something, a live page shows the latest real scan: the one just paid, if PayPal
  // just sent you back, or else the newest, ready to pay.
  const auto = (() => {
    if (view || live.mode !== "live" || !live.state) return null;
    const paid = returned?.paid === "scan" ? live.state.scans.find((s) => s.status === "paid") : undefined;
    const scan = paid ?? live.state.scans.find((s) => s.kind !== "unknown");
    return scan ? { sample: sampleFromScan(scan), scan, photo: scan.photo, paid: scan.status === "paid" } : null;
  })();
  const current: View = view ?? auto ?? { sample: samples[0] };
  const currentStage: LensStage = view ? stage : auto ? (auto.paid ? "paid" : "read") : stage;
  const fieldsShown = view ? shown : auto ? current.sample.fields.length : shown;
  const wireAt = view ? at : auto?.paid ? current.sample.wire.length - 1 : at;

  const start = (next: View) => {
    setView(next);
    setStage("scanning");
    setShown(0);
    setAt(-1);
    setError(undefined);
    setRun((r) => r + 1);
  };

  const readLive = async (upload: { image: string; photo: string }, preview: View) => {
    start({ ...preview, live: true });
    try {
      const scan = await act<Scan>("lens/read", upload);
      const sample = sampleFromScan(scan);
      setView({ sample, scan, photo: preview.photo, live: true });
      setShown(sample.fields.length);
      setStage("read");
    } catch (err) {
      setView(null);
      setStage("idle");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const tapSample = (s: Sample) => start({ sample: s });

  // A scan from Recent scans, back in the phone: paid, or ready to pay.
  const open = (scan: Scan) => {
    const sample = sampleFromScan(scan);
    const paid = scan.status === "paid";
    setView({ sample, scan, photo: scan.photo, live: true });
    setStage(paid ? "paid" : "read");
    setShown(sample.fields.length);
    setAt(paid ? sample.wire.length - 1 : -1);
    setError(undefined);
    setRun((r) => r + 1);
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const copies = await forLens(file);
    await readLive(copies, { sample: { ...samples[0], heard: "your photo", fields: [] }, photo: copies.photo });
  };

  useOnScreen(box, () => {
    if (live.mode === "demo") start({ sample: samples[0] });
  });

  // Demo only: fields appear as Lens "reads", then each PayPal call lights up in turn.
  useEffect(() => {
    if (!view || view.live) return;
    if (stage === "scanning") {
      const timers = view.sample.fields.map((_, i) => setTimeout(() => setShown(i + 1), 450 + i * 200));
      timers.push(setTimeout(() => setStage("read"), 650 + view.sample.fields.length * 200));
      return () => timers.forEach(clearTimeout);
    }
    if (stage === "paying") {
      const timers = view.sample.wire.map((_, i) => setTimeout(() => setAt(i), 150 + i * 650));
      timers.push(setTimeout(() => setStage("paid"), 150 + view.sample.wire.length * 650));
      return () => timers.forEach(clearTimeout);
    }
  }, [stage, run, view]);

  const pay = async () => {
    const { scan } = current;
    if (!scan) {
      setView(current);
      setStage("paying");
      return;
    }
    setView({ ...current, live: true });
    setStage("paying");
    setAt(0);
    try {
      const { approveUrl, amount } = await act<{ approveUrl: string; amount: number }>("lens/pay", {
        scanId: scan.id,
        repeat: recurring,
        ...(scan.kind === "tip" && { amount: current.sample.amount }),
      });
      setAt(1);
      // Backed out of the flick: the checkout's cancelled, and it's ready to pay again.
      if (!(await approveOnPayPal(approveUrl, { amount, to: scan.title }))) {
        setStage("read");
        setAt(-1);
      }
    } catch (err) {
      setStage("read");
      setAt(-1);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // A real receipt can go to Splitter instead, with its items.
  const split = () => {
    if (!current.scan) return;
    handReceipt(current.scan);
    router.push("/split");
  };

  const { sample } = current;
  const done = sample.kind === "bill" && !recurring && !current.scan ? "Paid with PayPal" : sample.done;
  const recent = live.mode === "live" ? (live.state?.scans ?? []).filter((s) => s.kind !== "unknown").slice(0, RECENT) : [];

  return (
    <div ref={box} className="grid items-center justify-items-center gap-6 lg:grid-cols-[auto_1fr] lg:justify-items-stretch">
      <Phone width={262} background="#0b0b0c" dark>
        <LensScreen
          sample={sample}
          stage={currentStage}
          run={run}
          onAct={pay}
          onAlt={split}
          recurring={recurring}
          onRecurring={setRecurring}
          photo={current.photo}
          hint={error ? "Lens couldn't read that. Try another photo." : undefined}
        />
      </Phone>

      <div className="grid w-full min-w-0 gap-3 md:grid-cols-2">
        <Tile>
          <label
            aria-disabled={!canRead || (currentStage === "scanning" && Boolean(view?.live))}
            className="pressable flex h-14 cursor-pointer items-center justify-center gap-2 rounded-full bg-ink text-[17px] font-medium text-on-ink aria-disabled:pointer-events-none aria-disabled:opacity-40"
          >
            <Camera size={20} /> Snap your own
            <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={!canRead} onChange={(e) => void upload(e.target.files?.[0])} />
          </label>
          <p className="mt-2 text-center text-[12px] leading-4 text-secondary">
            {canRead ? "A bill, a receipt, a price tag or a tip jar. Lens reads it, and you pay it with PayPal." : live.mode === "loading" ? "Getting Lens ready…" : "Lens can't read photos right now: Flick's AI is off."}
          </p>
          {error && <p className="mt-2 text-center text-[12px] leading-4 text-wait">{error}</p>}

          <p className="mt-4 text-[13px] text-secondary">Or watch a sample. Nothing is charged.</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {samples.map((s) => {
              const on = current.sample.kind === s.kind && !current.scan && !current.photo;
              return (
                <button
                  key={s.kind}
                  type="button"
                  aria-pressed={on}
                  onClick={() => tapSample(s)}
                  className={`pressable flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl p-2.5 transition-colors ${on ? "bg-ink text-on-ink" : "bg-raised"}`}
                >
                  <span className="flex h-[52px] w-full items-center justify-center rounded-xl bg-[radial-gradient(circle_at_50%_40%,#4a4033,#1f1b16_80%)]">
                    <Doc kind={s.kind} width={34} />
                  </span>
                  <span className="text-[12px]">{s.label}</span>
                </button>
              );
            })}
          </div>
        </Tile>

        <Tile>
          <p className="flex items-center justify-between text-[13px] text-secondary">
            <span className="flex items-center gap-1.5">
              <Bot {...agents.lens} size={18} mood={currentStage === "scanning" ? "speaking" : "idle"} /> What Lens read
            </span>
            {currentStage === "scanning" && <LoaderCircle size={13} className="spinner" />}
          </p>
          <dl className="mt-3 divide-y divide-separator/50 font-mono text-[12px]">
            {sample.fields.map(([k, v], i) => (
              <div
                key={`${run}-${k}-${i}`}
                className="flex justify-between gap-3 py-1.5 transition-[opacity,transform] duration-300"
                style={{
                  opacity: i < fieldsShown ? 1 : 0,
                  transform: i < fieldsShown ? "none" : "translateY(4px)",
                  transitionDelay: view?.live ? `${i * 110}ms` : undefined,
                }}
              >
                <dt className="text-secondary">{k}</dt>
                <dd className="truncate text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </Tile>

        <Tile className="md:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-secondary">
              {current.scan ? "How it gets paid, through PayPal's sandbox. Each step shows in Money Studio." : "How it gets paid. This is a sample: nothing is charged."}
            </p>
            {currentStage === "read" && sample.action && (
              <button type="button" onClick={() => void pay()} className="pressable cursor-pointer rounded-full bg-ink px-3 py-1 text-[12px] text-on-ink">
                {sample.action}
              </button>
            )}
            {currentStage === "paying" && current.scan && <span className="text-[12px] text-secondary">Opening PayPal…</span>}
            {currentStage === "paid" && <span className="rise text-[12px] text-paid">{done}</span>}
          </div>
          <Wire steps={sample.wire} at={wireAt} />
        </Tile>

        {recent.length > 0 && <RecentScans scans={recent} open={open} on={current.scan?.id} />}
      </div>
    </div>
  );
}
