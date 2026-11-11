"use client";

import type { view } from "@backend/business";
import { BadgeCheck, LoaderCircle, Store } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Secondary } from "@/components/ui";
import { usd } from "@/lib/format";
import { useLive } from "@/lib/live";

// Flick for business (backend/src/business.ts): a business signs in with its own PayPal and registers
// the names on its bills. A bill Lens reads with one of those names pays that PayPal, the account
// that signed in, so nobody can point a business's bills at another account by typing an email.

type View = ReturnType<typeof view>;

async function call(path: string, body?: unknown): Promise<View> {
  const res = await fetch(`/api/${path}`, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message ?? `Flick's backend answered ${res.status}.`);
  return json as View;
}

export function Business() {
  const live = useLive();
  const [data, setData] = useState<View>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [names, setNames] = useState("");

  // Asked once the page opens; the state is set when the answer comes.
  const load = useCallback(
    () =>
      call("business").then(
        (next) => (setData(next), setError(undefined)),
        (err) => setError(err instanceof Error ? err.message : String(err)),
      ),
    [],
  );
  useEffect(() => {
    void load();
  }, [load, live.state?.profile?.email]);

  const run = async (work: () => Promise<View>) => {
    setBusy(true);
    setError(undefined);
    try {
      setData(await work());
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(() => call("business", { name, names }));
  };
  const edit = () => {
    if (!data?.yours) return;
    setName(data.yours.name);
    setNames(data.yours.names.slice(1).join(", "));
    setEditing(true);
  };

  const yours = data?.yours;
  const others = data?.all.filter((b) => b.id !== yours?.id) ?? [];

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="rounded-[28px] bg-card p-6">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-ink text-on-ink">
          <Store size={22} aria-hidden />
        </span>
        <h1 className="mt-4 text-[28px] font-semibold leading-tight tracking-tight">{yours ? yours.name : "Get paid when Flick pays your bills."}</h1>

        {!data && !error && <p className="mt-3 flex items-center gap-2 text-[14px] text-secondary"><LoaderCircle size={15} className="spinner" /> Loading…</p>}

        {data && !data.signedIn && (
          <>
            <p className="mt-2 text-[15px] leading-[1.45] text-secondary">
              When someone snaps your bill with Flick, Lens reads your name off it. Register that name, and the money comes to your PayPal. Sign in with your business&apos;s PayPal account first: that&apos;s the account Flick pays.
            </p>
            <Link href="/login?next=/business" className="pressable mt-6 flex h-12 items-center justify-center rounded-full bg-[#0070e0] text-[16px] font-medium text-white">
              Sign in with PayPal
            </Link>
          </>
        )}

        {data?.signedIn && (!yours || editing) && (
          <form onSubmit={submit} className="mt-3">
            {!yours && (
              <p className="text-[15px] leading-[1.45] text-secondary">
                Bills Lens reads with any of these names are paid to the PayPal you signed in with. Each name belongs to one business on Flick.
              </p>
            )}
            <label htmlFor="biz-name" className="mt-5 block text-[13px] text-secondary">
              Business name, as your bills show it
            </label>
            <input id="biz-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="KFC" required className="mt-1 h-11 w-full rounded-xl bg-fill px-3 text-[16px] outline-none focus:ring-2 focus:ring-ink/20" />
            <label htmlFor="biz-names" className="mt-4 block text-[13px] text-secondary">
              Other names on your bills (optional, with commas)
            </label>
            <input id="biz-names" value={names} onChange={(e) => setNames(e.target.value)} maxLength={400} placeholder="Kentucky Fried Chicken, KFC India" className="mt-1 h-11 w-full rounded-xl bg-fill px-3 text-[16px] outline-none focus:ring-2 focus:ring-ink/20" />
            <p className="mt-4 rounded-2xl bg-tile px-4 py-3 text-[13px] leading-[18px]">
              <span className="text-secondary">Paid to </span>
              {data.email}
              <span className="text-secondary">, the PayPal you signed in with.</span>
            </p>
            <button type="submit" disabled={busy || !name.trim()} className="pressable mt-5 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-ink text-[16px] text-on-ink disabled:opacity-50">
              {busy && <LoaderCircle size={16} className="spinner" />}
              {yours ? "Save names" : `Register ${name.trim() || "your business"}`}
            </button>
            {yours && (
              <Secondary onClick={() => setEditing(false)} disabled={busy} className="mt-2 w-full">
                Cancel
              </Secondary>
            )}
          </form>
        )}

        {yours && !editing && (
          <>
            <p className="mt-1 flex items-center gap-1.5 text-[14px] text-paid">
              <BadgeCheck size={16} aria-hidden /> On Flick since {new Date(yours.since).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5 text-[13px]">
              {yours.names.map((n) => (
                <span key={n} className="rounded-full bg-fill px-3 py-1">
                  {n}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[13px] text-secondary">Bills with these names are paid to {yours.email}.</p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-tile px-3 py-3">
                <p className="text-[24px] font-semibold tabular-nums leading-none">{yours.paid.count}</p>
                <p className="mt-1 text-[12px] text-secondary">Payments from Flick</p>
              </div>
              <div className="rounded-2xl bg-tile px-3 py-3">
                <p className="text-[24px] font-semibold tabular-nums leading-none">{usd(yours.paid.amount)}</p>
                <p className="mt-1 text-[12px] text-secondary">Paid to your PayPal</p>
              </div>
            </div>
            {yours.paid.latest.length > 0 && (
              <ul className="mt-3 divide-y divide-separator/50 rounded-2xl bg-tile px-4 text-[14px]">
                {yours.paid.latest.map((p) => (
                  <li key={p.at} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0 truncate">{p.what}</span>
                    <span className="shrink-0 tabular-nums">{usd(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6 grid grid-cols-2 gap-2">
              <Secondary onClick={edit} disabled={busy}>
                Change names
              </Secondary>
              <Secondary onClick={() => void run(() => call("business/remove", {}))} disabled={busy}>
                Take it off Flick
              </Secondary>
            </div>
          </>
        )}

        {error && <p className="mt-3 text-[13px] text-wait">{error}</p>}
      </div>

      {others.length > 0 && (
        <section aria-label="Businesses on Flick" className="mt-4 rounded-[28px] bg-card p-6">
          <p className="text-[13px] text-secondary">On Flick: their bills pay their own PayPal</p>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[13px]">
            {others.map((b) => (
              <span key={b.id} className="flex items-center gap-1 rounded-full bg-fill px-3 py-1">
                <BadgeCheck size={13} className="text-paid" aria-hidden /> {b.name}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
