"use client";

import type { ChatPeer, Safe, SafeSpend } from "@backend/model";
import { Camera, Check, CircleCheck, LoaderCircle, LockKeyhole, ShieldAlert, X } from "lucide-react";
import { useRef, useState } from "react";
import { forLens, pdfForLens } from "@/app/_landing/lens";
import { agents } from "@/app/_landing/data";
import { usd } from "@/lib/format";
import { act, flickToPay } from "@/lib/live";
import { Bot } from "./bot";

// Flick Safe in the browser (backend/src/safe.ts): money given to a friend for one purpose, and each
// receipt spent from it. Flick Chat shows a Safe as a card where it was given, and each receipt where
// it was snapped; /safe lists them all.

type Run = (work: () => Promise<unknown>) => Promise<void>;
const day = (iso: string) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
const daysLeft = (iso: string) => Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000));

/** Who someone is, from where you stand: "you", or their name. */
const who = (email: string, me: string, peer: ChatPeer) => (email === me ? "you" : peer.name);

/** Gives `peer` money for a purpose: a flick pays it from your saved PayPal into a Safe. */
export function GiveSafe({ peer, run, close }: { peer: ChatPeer; run: Run; close: () => void }) {
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [days, setDays] = useState(14);
  const value = Number(amount);
  const ready = value >= 1 && value <= 500 && purpose.trim().length >= 2;
  const give = () =>
    run(async () => {
      const went = await flickToPay(() => act("safe", { with: peer.email, amount: value, purpose: purpose.trim(), days }), { amount: value, to: `${peer.name}, in a Safe` });
      if (went) close();
    });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) void give();
      }}
      className="mb-2 rounded-2xl bg-fill/50 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[13px] text-secondary">
          <Bot {...agents.safe} size={18} /> Give {peer.name} money for one thing
        </p>
        <button type="button" onClick={close} aria-label="Don't give" className="pressable flex size-7 cursor-pointer items-center justify-center rounded-full">
          <X size={15} />
        </button>
      </div>
      <p className="mt-1 text-[12px] leading-4 text-secondary">
        It waits in a Safe. {peer.name} snaps the receipt to spend it, and Safe checks it&apos;s for what you said. What&apos;s left comes back to you.
      </p>
      <div className="mt-2 grid grid-cols-[110px_1fr] gap-2">
        <label className="flex h-10 items-center rounded-full bg-raised px-3 ring-1 ring-separator/60 focus-within:ring-2 focus-within:ring-ink">
          <span className="text-secondary">$</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="20.00"
            aria-label="How much"
            className="w-full bg-transparent pl-1 text-[16px] tabular-nums outline-none"
          />
        </label>
        <input
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          maxLength={60}
          placeholder="For what? Chocolates, school books…"
          aria-label="What it's for"
          className="h-10 min-w-0 rounded-full bg-raised px-4 text-[14px] outline-none ring-1 ring-separator/60 focus:ring-2 focus:ring-ink"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
        <span className="py-1 text-secondary">For</span>
        {[7, 14, 30].map((d) => (
          <button key={d} type="button" onClick={() => setDays(d)} aria-pressed={d === days} className={`pressable cursor-pointer rounded-full px-3 py-1 ${d === days ? "bg-ink text-on-ink" : "bg-raised"}`}>
            {d} days
          </button>
        ))}
      </div>
      <button type="submit" disabled={!ready} className="pressable mt-2.5 flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-ink text-[14px] text-on-ink disabled:opacity-40">
        <LockKeyhole size={14} /> {ready ? `Give ${usd(value)} for ${purpose.trim()}` : "Give money for one thing"}
      </button>
    </form>
  );
}

/** Snaps a receipt or bill for a Safe given to you: Safe reads it, and the rules decide. */
function SnapReceipt({ safe, peer, run }: { safe: Safe; peer: ChatPeer; run: Run }) {
  const file = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const snap = async (picked: File | undefined) => {
    if (!picked) return;
    setReading(true);
    await run(async () => {
      const copies = picked.type === "application/pdf" ? { pdf: await pdfForLens(picked) } : await forLens(picked);
      await act("safe/spend", { with: peer.email, safe: safe.id, ...copies });
    });
    setReading(false);
    if (file.current) file.current.value = "";
  };
  return (
    <>
      <input ref={file} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => void snap(e.target.files?.[0])} />
      <button
        type="button"
        onClick={() => file.current?.click()}
        disabled={reading}
        className="pressable flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-ink text-[14px] text-on-ink disabled:opacity-60"
      >
        {reading ? (
          <>
            <LoaderCircle size={14} className="spinner" /> Safe is checking it…
          </>
        ) : (
          <>
            <Camera size={15} /> Snap the receipt
          </>
        )}
      </button>
    </>
  );
}

/** A Safe: what it's for, what's left, its receipts, and what you can do with it. */
export function SafeCard({ safe, me, peer, run }: { safe: Safe; me: string; peer: ChatPeer; run: Run }) {
  const [closing, setClosing] = useState(false);
  const giver = safe.from === me;
  const open = safe.status === "open";
  const spent = safe.spends.reduce((sum, s) => sum + s.paid, 0);
  const close = () => {
    setClosing(true);
    void run(() => act("safe/close", { with: peer.email, safe: safe.id })).finally(() => setClosing(false));
  };
  return (
    <div className="w-[min(320px,88%)] overflow-hidden rounded-[22px] bg-raised ring-1 ring-separator/60">
      <div className="flex items-center gap-2 bg-sky/15 px-3.5 py-2">
        <Bot {...agents.safe} size={22} mood={open ? "awake" : "idle"} />
        <p className="min-w-0 flex-1 truncate text-[13px]">
          Safe · for <span className="font-semibold">{safe.purpose}</span>
        </p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${open ? "bg-raised" : "bg-fill text-secondary"}`}>{open ? `${daysLeft(safe.expires)} days left` : "Closed"}</span>
      </div>
      <div className="p-3.5">
        <p className="text-[12px] text-secondary">{giver ? `You gave ${peer.name}` : `${peer.name} gave you`} · {day(safe.at)}</p>
        <p className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-[30px] font-semibold leading-tight tracking-tight tabular-nums">{usd(safe.left)}</span>
          <span className="text-[13px] text-secondary">left of {usd(safe.amount)}</span>
        </p>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fill" aria-hidden>
          <div className="h-full rounded-full bg-sky" style={{ width: `${Math.round((safe.left / safe.amount) * 100)}%` }} />
        </div>
        {safe.note && <p className="mt-2 text-[13px] leading-5 text-secondary">{safe.note}</p>}
        {safe.spends.length > 0 && (
          <ul className="mt-2.5 space-y-1 text-[12px]">
            {safe.spends.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">{s.merchant}</span>
                <SpendChip spend={s} />
              </li>
            ))}
          </ul>
        )}
        {safe.closed && (
          <p className="mt-2.5 text-[12px] text-secondary">
            {safe.closed.returned ? `${usd(safe.closed.returned)} went back to ${giver ? "your" : `${peer.name}'s`} PayPal` : "All spent"} · {usd(spent)} spent on {safe.purpose}
          </p>
        )}
        {open && !giver && (
          <div className="mt-3 space-y-1.5">
            <SnapReceipt safe={safe} peer={peer} run={run} />
            <p className="text-center text-[11px] leading-4 text-secondary">Only what&apos;s for {safe.purpose} comes out. Each receipt counts once.</p>
          </div>
        )}
        {open && giver && (
          <button
            type="button"
            onClick={close}
            disabled={closing}
            className="pressable mt-3 flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-fill text-[13px] disabled:opacity-50"
          >
            {closing ? <LoaderCircle size={14} className="spinner" /> : null} Close it{safe.left > 0 ? ` and get ${usd(safe.left)} back` : ""}
          </button>
        )}
      </div>
    </div>
  );
}

function SpendChip({ spend }: { spend: SafeSpend }) {
  if (spend.refused) return <span className="shrink-0 text-secondary">Not taken</span>;
  const asking = spend.ask?.status === "open";
  return (
    <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
      {spend.paid > 0 && <span className="text-paid">{usd(spend.paid)}</span>}
      {asking && <span className="rounded-full bg-wait/15 px-1.5 text-wait">asks {usd(spend.ask!.amount)}</span>}
    </span>
  );
}

/** A receipt spent from a Safe: each line as Safe judged it, and what came of it. */
export function SpendCard({ safe, spend, me, peer, run }: { safe: Safe; spend: SafeSpend; me: string; peer: ChatPeer; run: Run }) {
  const [busy, setBusy] = useState<"allow" | "decline">();
  const giver = safe.from === me;
  const spender = who(safe.to, me, peer);
  const decide = (allow: boolean) => {
    setBusy(allow ? "allow" : "decline");
    void run(() => act("safe/decide", { with: peer.email, safe: safe.id, spend: spend.id, allow })).finally(() => setBusy(undefined));
  };
  const paidTo = spend.to?.kind === "shop" ? `Safe paid ${spend.to.name}` : `Safe paid ${spender === "you" ? "you" : spender} back`;
  return (
    <div className="w-[min(320px,88%)] overflow-hidden rounded-[22px] bg-raised ring-1 ring-separator/60">
      <div className="flex gap-3 p-3.5">
        {spend.photo && (
          // A data URL Lens's way; next/image adds nothing here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={spend.photo} alt={`${spend.merchant}'s receipt`} className="h-[84px] w-[63px] shrink-0 rounded-xl object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[12px] text-secondary">
            <Bot {...agents.safe} size={16} /> {spender === "you" ? "You spent" : `${spender} spent`} from the Safe for {safe.purpose}
          </p>
          <p className="mt-0.5 truncate text-[15px]">{spend.merchant}</p>
          <p className="text-[12px] text-secondary">
            {spend.kind === "bill" ? "A bill" : spend.kind === "receipt" ? "A receipt" : "Not a receipt"}
            {spend.date ? ` · ${day(`${spend.date}T12:00:00Z`)}` : " · no date"}
            {spend.total ? ` · ${usd(spend.total)}` : ""}
            {spend.original ? ` (${new Intl.NumberFormat("en-US", { style: "currency", currency: spend.original.currency }).format(spend.original.total)})` : ""}
          </p>
        </div>
      </div>
      {spend.lines.length > 0 && (
        <ul className="space-y-0.5 border-t border-separator/50 px-3.5 py-2 text-[13px]">
          {spend.lines.map((l, i) => (
            <li key={i} className={`flex items-center justify-between gap-2 ${l.fits ? "" : "text-secondary"}`} title={l.why}>
              <span className="flex min-w-0 items-center gap-1.5">
                {l.fits ? <Check size={13} className="shrink-0 text-paid" aria-label="For the purpose" /> : <X size={13} className="shrink-0" aria-label="Not for the purpose" />}
                <span className={`truncate ${l.fits ? "" : "line-through"}`}>{l.name}</span>
              </span>
              <span className="tabular-nums">{usd(l.price)}</span>
            </li>
          ))}
          {spend.tax + spend.tip > 0 && (
            <li className="flex justify-between text-[12px] text-secondary">
              <span className="pl-5">{spend.tax && spend.tip ? "Tax and tip" : spend.tax ? "Tax" : "Tip"}</span>
              <span className="tabular-nums">{usd(spend.tax + spend.tip)}</span>
            </li>
          )}
        </ul>
      )}
      <div className="space-y-1.5 border-t border-separator/50 px-3.5 py-2.5 text-[12px]">
        {spend.refused && (
          <p className="flex items-start gap-1.5 text-wait">
            <ShieldAlert size={14} className="mt-px shrink-0" /> Not taken: {spend.refused}
          </p>
        )}
        {spend.paid > 0 && (
          <p className="flex items-center gap-1.5 text-paid">
            <CircleCheck size={14} /> {paidTo} {usd(spend.paid)}
          </p>
        )}
        {spend.payout === "failed" && <p className="text-wait">Flick is still sending it on to PayPal.</p>}
        {spend.ask && (
          <div className={`rounded-xl px-2.5 py-2 ${spend.ask.status === "open" ? "bg-wait/10" : "bg-fill/60"}`}>
            <p className={spend.ask.status === "open" ? "text-wait" : "text-secondary"}>
              {spend.ask.status === "open"
                ? `${usd(spend.ask.amount)} waits for ${giver ? "you" : peer.name}: ${spend.ask.why}`
                : spend.ask.status === "allowed"
                  ? `${giver ? "You" : peer.name} allowed ${usd(spend.ask.amount)}. ${spend.ask.why}`
                  : `Not allowed: ${usd(spend.ask.amount)}. ${spend.ask.why}`}
            </p>
            {spend.ask.status === "open" && giver && safe.status === "open" && (
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <button type="button" onClick={() => decide(true)} disabled={Boolean(busy)} className="pressable flex h-9 cursor-pointer items-center justify-center rounded-full bg-ink text-[13px] text-on-ink disabled:opacity-50">
                  {busy === "allow" ? <LoaderCircle size={14} className="spinner" /> : `Allow ${usd(Math.min(spend.ask.amount, safe.left))}`}
                </button>
                <button type="button" onClick={() => decide(false)} disabled={Boolean(busy)} className="pressable flex h-9 cursor-pointer items-center justify-center rounded-full bg-fill text-[13px] disabled:opacity-50">
                  {busy === "decline" ? <LoaderCircle size={14} className="spinner" /> : "Don't allow"}
                </button>
              </div>
            )}
          </div>
        )}
        {spend.notPaid && (
          <p className="flex items-start gap-1.5 text-secondary">
            <X size={14} className="mt-px shrink-0" /> {spend.notPaid.why} ({usd(spend.notPaid.amount)})
          </p>
        )}
        {spend.signs.length > 0 && !spend.refused && <p className="text-secondary">Safe noticed: {spend.signs.join(" ")}</p>}
        <p className="text-[11px] text-secondary">Left in the Safe now: {usd(safe.left)}</p>
      </div>
    </div>
  );
}
