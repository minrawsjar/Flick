'use client';

import type { AgWidgetParams } from 'ag-studio';
import { usd } from '@/lib/format';
import type { StudioContext } from './widget-parts';

// "Week timeline": Autopilot's week, Monday to Sunday, each payment on its day, coloured by where it
// stands. A custom AG Studio widget (custom-widgets.tsx), drawn from Money Studio's own data in
// Studio's context.

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** 0 = Monday, for a YYYY-MM-DD date (calendar days, in UTC, as the backend keeps them). */
const weekday = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;

const looks: Record<string, string> = {
  paid: 'bg-paid/15 text-paid',
  scheduled: 'bg-sky/15 text-ink',
  planned: 'bg-fill text-ink',
  failed: 'bg-danger/15 text-danger',
  skipped: 'bg-fill text-secondary line-through',
};

export function WeekTimelineWidget({ context }: AgWidgetParams) {
  const { data } = context as StudioContext;
  const payments = data.flickPayments;

  return (
    <div className="flex h-full flex-col overflow-hidden px-3 pb-3 pt-1 text-ink">
      {payments.length ? (
        <div className="grid min-h-0 flex-1 grid-cols-7 gap-1.5 overflow-y-auto">
          {DAYS.map((day, i) => (
            <div key={day} className="flex min-w-0 flex-col gap-1.5">
              <p className="text-center text-[11px] font-medium text-secondary">{day}</p>
              {payments
                .filter((p) => weekday(p.date) === i)
                .map((p) => (
                  <div key={p.id} title={`${p.payee}: ${p.reason}`} className={`rounded-lg px-1.5 py-1.5 text-[11px] leading-[14px] ${looks[p.status] ?? 'bg-fill'}`}>
                    <span className="block break-words font-medium">{p.payee}</span>
                    <span className="tabular-nums">{usd(p.amount)}</span>
                  </div>
                ))}
            </div>
          ))}
        </div>
      ) : (
        <p className="flex flex-1 items-center justify-center text-[13px] text-secondary">Autopilot hasn&apos;t planned a week yet.</p>
      )}
    </div>
  );
}
