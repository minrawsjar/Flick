"use client";

import { CircleCheck, LoaderCircle, Repeat } from "lucide-react";
import { useState } from "react";
import { Tile } from "@/components/ui";
import { usd } from "@/lib/format";
import { act, approveOnPayPal, useLive } from "@/lib/live";

// Autopilot paying by itself (backend/src/autopilot.ts): approve one week with "save PayPal", and
// PayPal keeps the account for Flick (PayPal's vault). Then each week is paid with it, up to the cap,
// with no approval page; a bigger week still asks. Stopping deletes the saved account at PayPal.

export function Autopay() {
  const { mode, state } = useLive();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [cap, setCap] = useState<string>();
  // Only for your own week: the sample week above is a walkthrough.
  if (mode !== "live" || !state || (!state.week.payments.length && !state.autopay)) return null;

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(undefined);
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const { autopay, week } = state;
  const waiting = week.payments.filter((p) => p.status === "planned");
  const total = waiting.reduce((sum, p) => sum + p.amount, 0);
  const canApprove = waiting.length > 0 && week.approval?.status !== "approved";

  return (
    <Tile className="mt-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <p className="flex items-center gap-1.5 text-[15px]">
            {autopay ? <CircleCheck size={16} className="text-paid" aria-hidden /> : <Repeat size={16} aria-hidden />}
            {autopay ? "Autopilot pays by itself" : "Let Autopilot pay by itself"}
          </p>
          <p className="mt-1 text-[13px] leading-5 text-secondary">
            {autopay
              ? `With the PayPal you saved${autopay.email ? ` (${autopay.email})` : ""} on ${autopay.since}: each week is paid when it's planned, up to ${usd(autopay.cap)}, with no approval page. A bigger week still asks you.`
              : "Approve one week with Save PayPal, and PayPal keeps your account for Flick. After that Autopilot pays every week by itself, up to a cap you set, and asks only when a week is bigger. Stop any time: it's deleted at PayPal."}
          </p>
        </div>
        {autopay ? (
          <div className="flex flex-wrap items-center gap-2">
            <form
              className="flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => act("autopay/cap", { cap: Number(cap) }));
              }}
            >
              <label htmlFor="cap" className="text-[12px] text-secondary">
                Weekly cap
              </label>
              <input
                id="cap"
                type="number"
                inputMode="decimal"
                min={10}
                max={5000}
                step="any"
                value={cap ?? String(autopay.cap)}
                onChange={(e) => setCap(e.target.value)}
                className="h-8 w-24 rounded-full bg-raised px-3 text-[13px] tabular-nums outline-none ring-1 ring-separator/60 focus:ring-2 focus:ring-ink"
              />
              {cap !== undefined && Number(cap) !== autopay.cap && (
                <button type="submit" disabled={busy} className="pressable h-8 cursor-pointer rounded-full bg-ink px-3 text-[12px] text-on-ink">
                  Save
                </button>
              )}
            </form>
            <button type="button" disabled={busy} onClick={() => void run(() => act("autopay/stop"))} className="pressable h-8 cursor-pointer rounded-full bg-fill px-3 text-[12px]">
              Stop, and forget my PayPal
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy || !canApprove}
            onClick={() => void run(async () => approveOnPayPal((await act<{ approveUrl: string | null }>("week/approve", { save: true })).approveUrl))}
            className="pressable flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] text-on-ink disabled:cursor-default disabled:opacity-40"
          >
            {busy && <LoaderCircle size={14} className="spinner" />}
            {canApprove ? `Approve and save PayPal · ${usd(total)}` : "Save PayPal when you approve next week"}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-[12px] text-wait">{error}</p>}
    </Tile>
  );
}
