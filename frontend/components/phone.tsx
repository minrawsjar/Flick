import { BatteryFull, CalendarCheck, LayoutGrid, ScanLine, Signal, Users, Wifi } from "lucide-react";
import type { ReactNode } from "react";

// An iPhone, from Air Agents (web/src/Frames.tsx, MIT) with Flick's tabs. Screens render at the
// app's own layout inside it.

const tabs = [
  ["This week", CalendarCheck],
  ["Lens", ScanLine],
  ["People", Users],
  ["Studio", LayoutGrid],
] as const;

export type Tab = (typeof tabs)[number][0];

export function Phone({
  children,
  tab,
  width = 262,
  background = "#f2f2f7",
  dark = false,
}: {
  children: ReactNode;
  tab?: Tab;
  width?: number;
  background?: string;
  /** A dark screen (the camera): white status bar. */
  dark?: boolean;
}) {
  return (
    <div
      className="relative shrink-0 rounded-[46px] bg-[linear-gradient(145deg,#4a4a4d,#1a1a1c_30%,#0c0c0d_70%,#3a3a3c)] p-[7px] shadow-[0_40px_80px_-24px_rgba(0,0,0,0.4),0_12px_24px_-12px_rgba(0,0,0,0.2),inset_0_0_0_1px_rgba(255,255,255,0.08)]"
      style={{ width, height: width * 2.12 }}
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-[39px] text-left" style={{ background }}>
        <div className={`relative z-10 flex h-11 shrink-0 items-center justify-between px-6 text-[13px] ${dark ? "text-white" : ""}`}>
          <span>9:41</span>
          <span className="absolute left-1/2 top-2.5 h-[22px] w-[74px] -translate-x-1/2 rounded-full bg-black" />
          <span className="flex items-center gap-1">
            <Signal size={13} />
            <Wifi size={13} />
            <BatteryFull size={16} />
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        {tab && (
          <div className="absolute inset-x-2.5 bottom-3 z-10 flex h-[52px] items-center justify-around rounded-full bg-white/85 px-1 shadow-[0_2px_12px_rgba(0,0,0,0.12)] backdrop-blur">
            {tabs.map(([name, Icon]) => (
              <span
                key={name}
                className={`flex flex-col items-center gap-0.5 rounded-full px-2.5 py-1 text-[9px] text-ink ${name === tab ? "bg-fill" : ""}`}
              >
                <Icon size={17} strokeWidth={1.75} />
                {name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
