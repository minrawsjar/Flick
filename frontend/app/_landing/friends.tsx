"use client";

import { Check, Pencil, Trash2, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Bot, type BotColor, type BotShape } from "@/components/bot";
import { Primary, Tile } from "@/components/ui";
import { usd } from "@/lib/format";
import { act, useLive } from "@/lib/live";
import { friends as demoFriends } from "./data";

// Friends: the people you split with, each linked by the email of their PayPal account. Splitter's
// invoices and Nudge's reminders go to that address, and Autopilot pays them there.

const field = "h-10 w-full rounded-xl bg-raised px-3 text-[14px] outline-none ring-1 ring-separator/60 transition focus:ring-2 focus:ring-ink";

type Row = { id: string; name: string; email: string; color: BotColor; shape: BotShape; owes: number };

export function FriendsBook() {
  const live = useLive();
  const state = live.mode === "live" ? live.state : null;
  const rows: Row[] = state
    ? state.friends.map((f) => ({
        id: f.id,
        name: f.name,
        email: f.email,
        color: f.color as BotColor,
        shape: f.shape as BotShape,
        owes: state.debts.filter((d) => d.friendId === f.id && d.status === "requested").reduce((sum, d) => sum + d.amount, 0),
      }))
    : demoFriends.map((f) => ({ ...f, email: `${f.id}@example.com`, owes: 0 }));

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [added, setAdded] = useState<string>();

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(undefined);
    try {
      await work();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(() => act("friends/add", { name, email }));
    if (ok) {
      setAdded(name.trim());
      setName("");
      setEmail("");
    }
  };

  const save = async (id: string) => {
    if (await run(() => act("friends/update", { id, email: draft }))) setEditing(null);
  };

  return (
    <div className="grid w-full gap-3 lg:grid-cols-[1.5fr_1fr]">
      <Tile>
        <p className="text-[13px] text-secondary">Your friends</p>
        <div className="mt-2 divide-y divide-separator/50">
          {rows.map((f) => (
            <div key={f.id} className="flex items-center gap-3 py-2.5">
              <Bot color={f.color} shape={f.shape} size={36} mood={f.id === editing ? "awake" : "idle"} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px]">{f.name}</p>
                {editing === f.id ? (
                  <input
                    autoFocus
                    type="email"
                    aria-label={`${f.name}'s PayPal email`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void save(f.id);
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className={`${field} mt-1 h-9`}
                  />
                ) : (
                  <p className="truncate text-[13px] text-secondary">{f.email}</p>
                )}
              </div>
              {f.owes > 0 && editing !== f.id && <span className="shrink-0 rounded-full bg-wait/15 px-2.5 py-0.5 text-[12px] text-wait">owes {usd(f.owes)}</span>}
              {state &&
                (editing === f.id ? (
                  <button type="button" onClick={() => void save(f.id)} disabled={busy} className="pressable flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-ink text-on-ink" aria-label="Save email">
                    <Check size={16} />
                  </button>
                ) : (
                  <span className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(f.id);
                        setDraft(f.email);
                        setError(undefined);
                      }}
                      className="pressable flex size-9 cursor-pointer items-center justify-center rounded-full bg-fill"
                      aria-label={`Change ${f.name}'s PayPal email`}
                      title="Change their PayPal email"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void run(() => act("friends/remove", { id: f.id }))}
                      disabled={busy}
                      className="pressable flex size-9 cursor-pointer items-center justify-center rounded-full bg-fill text-danger"
                      aria-label={`Remove ${f.name}`}
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                ))}
            </div>
          ))}
          {!rows.length && <p className="py-4 text-[14px] text-secondary">No friends yet. Add the first one.</p>}
        </div>
        {error && <p className="mt-2 text-[12px] leading-4 text-wait">{error}</p>}
      </Tile>

      <Tile>
        <form onSubmit={(e) => void add(e)} className="flex h-full flex-col">
          <p className="flex items-center gap-1.5 text-[13px] text-secondary">
            <UserPlus size={14} /> Add a friend
          </p>
          <label className="mt-3 block text-[13px]">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sam" maxLength={40} required disabled={!state} className={`${field} mt-1`} />
          </label>
          <label className="mt-3 block text-[13px]">
            Their PayPal email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sam@example.com" required disabled={!state} className={`${field} mt-1`} />
          </label>
          <p className="mt-3 text-[12px] leading-[1.45] text-secondary">
            The email they sign in to PayPal with. On the sandbox, use a personal test account (developer.paypal.com → Testing Tools → Sandbox Accounts). Splitter&apos;s invoices and
            Nudge&apos;s reminders go there, and Autopilot pays them there.
          </p>
          <div className="mt-auto pt-4">
            <Primary type="submit" disabled={busy || !state || !name.trim() || !email.trim()}>{busy ? "Adding…" : "Add friend"}</Primary>
            {added && !error && <p className="rise mt-2 text-center text-[12px] text-paid">{added} is in. Split something with them.</p>}
          </div>
        </form>
      </Tile>
    </div>
  );
}
