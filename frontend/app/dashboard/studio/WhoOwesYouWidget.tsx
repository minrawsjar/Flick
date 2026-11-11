'use client';

import type { AgWidgetParams } from 'ag-studio';
import { Bot, type BotColor, type BotShape } from '@/components/bot';
import { usd } from '@/lib/format';
import type { StudioContext } from './widget-parts';

// "Who owes you": each friend with money still out, most first: how much, across how many requests,
// since when, and how many reminders Nudge has sent. A custom AG Studio widget (custom-widgets.tsx),
// drawn from Money Studio's own data in Studio's context.

const daysSince = (date: string) => Math.max(0, Math.round((Date.now() - Date.parse(`${date}T00:00:00Z`)) / 86_400_000));

export function WhoOwesYouWidget({ context }: AgWidgetParams) {
  const { data } = context as StudioContext;
  const faces = new Map(data.faces.map((f) => [f.name, f]));
  const owed = new Map<string, { amount: number; requests: number; since: string; reminders: number }>();
  for (const r of data.flickRequests) {
    if (r.status !== 'requested') continue;
    const o = owed.get(r.friend) ?? { amount: 0, requests: 0, since: r.requested, reminders: 0 };
    o.amount += r.outstanding;
    o.requests += 1;
    o.reminders += r.reminders;
    if (r.requested < o.since) o.since = r.requested;
    owed.set(r.friend, o);
  }
  const rows = [...owed].sort((a, b) => b[1].amount - a[1].amount);
  const total = rows.reduce((sum, [, o]) => sum + o.amount, 0);

  return (
    <div className="flex h-full flex-col overflow-hidden px-3 pb-3 pt-1 text-ink">
      {rows.length > 0 && <p className="mb-1 text-[12px] text-secondary">{usd(total)} owed to you in all</p>}
      {rows.length ? (
        <ul className="min-h-0 flex-1 divide-y divide-separator/50 overflow-y-auto">
          {rows.map(([name, o]) => {
            const face = faces.get(name);
            const days = daysSince(o.since);
            return (
              <li key={name} className="flex items-center gap-3 py-2">
                <Bot color={(face?.color ?? 'blue') as BotColor} shape={(face?.shape ?? 'circle') as BotShape} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{name}</span>
                  <span className="block text-[12px] text-secondary">
                    {o.requests} {o.requests === 1 ? 'request' : 'requests'}, {days === 0 ? 'today' : `${days} ${days === 1 ? 'day' : 'days'}`}
                    {o.reminders ? ` · ${o.reminders} ${o.reminders === 1 ? 'reminder' : 'reminders'}` : ''}
                  </span>
                </span>
                <span className="text-[15px] font-semibold tabular-nums">{usd(o.amount)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="flex flex-1 items-center justify-center text-[13px] text-secondary">Nobody owes you anything right now.</p>
      )}
    </div>
  );
}
