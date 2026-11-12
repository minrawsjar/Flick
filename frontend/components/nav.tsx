"use client";

import { CalendarCheck, Download, House, ScanLine, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { initial } from "@/lib/format";
import { useLive } from "@/lib/live";
import { UnreadCount, useUnread } from "./chat-alerts";
import { ThemeToggle } from "./theme-toggle";
import { Logo } from "./ui";

// The bar across the top of every page except Money Studio: Flick's mark (the one-pager), the
// working pages, installing the app, and Money Studio. Below laptop width the working pages get a
// tab bar at the bottom instead, like the installed app they become (see /install).

const links = [
  ["/home", "Today"],
  ["/chat", "Chat"],
  ["/ask", "Ask Flick"],
  ["/lens", "Lens"],
  ["/autopilot", "Autopilot"],
  ["/scout", "Scout"],
  ["/split", "Split"],
  ["/nudge", "Nudge"],
  ["/safe", "Safe"],
  ["/friends", "Friends"],
] as const;

const people = ["/chat", "/split", "/nudge", "/safe", "/friends"];
const week = ["/autopilot", "/scout"];

function Links({ className = "" }: { className?: string }) {
  const path = usePathname();
  const { count } = useUnread();
  return (
    <div className={`items-center gap-1 text-[13px] ${className}`}>
      {links.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={path === href ? "page" : undefined}
          className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 transition-colors xl:px-3 ${path === href ? "bg-fill text-ink" : "text-ink/70 hover:text-ink"}`}
        >
          {label}
          {href === "/chat" && <UnreadCount count={count} />}
        </Link>
      ))}
    </div>
  );
}

/** Signed in (with PayPal, /login): your initial, to your profile. A guest: Sign in. Hidden while the backend is out of reach. */
function Account() {
  const live = useLive();
  if (live.mode !== "live") return null;
  const profile = live.state?.profile;
  return profile ? (
    <Link
      href="/profile"
      aria-label={`Your profile: signed in as ${profile.name}`}
      className="pressable flex size-7 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-on-ink"
    >
      {initial(profile.name)}
    </Link>
  ) : (
    <Link href="/login" className="pressable rounded-full bg-fill px-3 py-1 text-[13px]">
      Sign in
    </Link>
  );
}

/** `app`: a working page, which has the tab bar below laptop width instead of a row of links. */
export function Nav({ app = false }: { app?: boolean }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 bg-page/75 pt-[env(safe-area-inset-top)] backdrop-blur-2xl backdrop-saturate-150">
      {/* Wider with the screen: the page's own width on laptops, most of a big monitor's. */}
      <nav className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 min-[1280px]:max-w-7xl min-[1536px]:max-w-[88rem] min-[1920px]:max-w-[110rem]">
        {/* Already on the one-pager, the logo takes you back to its top: a link to the same page doesn't scroll. */}
        <Link href="/" onClick={() => path === "/" && window.scrollTo({ top: 0 })} className="flex items-center gap-2 text-[15px]">
          <Logo />
          Flick
        </Link>
        <Links className="hidden lg:flex" />
        {/* Between laptop and wide screens, "Get the app" is just its icon, so the links fit. */}
        <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
          <Link href="/install" aria-label="Get the app" className="pressable flex items-center gap-1 rounded-full bg-fill px-3 py-1 text-[13px] standalone:hidden">
            <Download size={14} aria-hidden /> <span className="max-sm:hidden lg:max-xl:hidden">Get the app</span>
            <span className="sm:hidden">App</span>
          </Link>
          <Account />
          <ThemeToggle />
          <Link href="/dashboard" className="pressable rounded-full bg-ink px-3 py-1 text-[13px] text-on-ink">
            <span className="max-sm:hidden">Money </span>Studio
          </Link>
        </span>
      </nav>
      {/* On phones the one-pager's links get their own row, which scrolls sideways if it must. */}
      {!app && <Links className="flex overflow-x-auto px-3 pb-2 lg:hidden" />}
      {app && <Switch paths={people} labels={["Chat", "Split", "Nudge", "Safe", "Friends"]} />}
      {app && <Switch paths={week} labels={["Payments", "Groceries"]} />}
    </header>
  );
}

const tabs = [
  ["/home", "Today", House],
  ["/lens", "Lens", ScanLine],
  ["/autopilot", "Week", CalendarCheck],
  ["/split", "People", Users],
  ["/ask", "Ask", Sparkles],
] as const;

/**
 * The working pages' tab bar, below laptop width. Its Week tab shows what needs you, its People tab
 * unread chats, and the app's icon both.
 */
export function TabBar() {
  const path = usePathname();
  const waiting = useWaiting();
  const { count: unread } = useUnread();

  // The installed app's icon badge (Chrome, Edge, Safari on iOS 16.4+ for home-screen apps).
  useEffect(() => {
    if (!("setAppBadge" in navigator)) return;
    const all = waiting + unread;
    (all ? navigator.setAppBadge(all) : navigator.clearAppBadge()).catch(() => {});
  }, [waiting, unread]);

  return (
    <nav
      aria-label="Flick"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+10px)] z-30 mx-auto flex h-[60px] max-w-md items-center justify-around rounded-full bg-card/85 px-1.5 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.25),0_0_0_0.5px_rgba(0,0,0,0.06)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
    >
      {tabs.map(([href, label, Icon]) => {
        const on = href === "/split" ? people.includes(path) : href === "/autopilot" ? week.includes(path) : path === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`pressable relative flex min-w-[58px] flex-col items-center gap-0.5 rounded-full px-2.5 py-1.5 text-[10px] ${on ? "bg-fill text-ink" : "text-ink/60"}`}
          >
            <Icon size={21} strokeWidth={1.75} aria-hidden />
            {label}
            {href === "/autopilot" && waiting > 0 && (
              <span aria-label={`${waiting} waiting for you`} className="absolute right-3 top-1 size-2 rounded-full bg-danger" />
            )}
            {href === "/split" && unread > 0 && <span aria-label={`${unread} unread in Chat`} className="absolute right-3 top-1 size-2 rounded-full bg-danger" />}
          </Link>
        );
      })}
    </nav>
  );
}

/** Things in the week that need you: approving it, and any payment that failed. */
function useWaiting() {
  const { state } = useLive();
  if (!state) return 0;
  const { payments, approval } = state.week;
  const unapproved = approval?.status !== "approved" && payments.some((p) => p.status === "planned");
  return (unapproved ? 1 : 0) + payments.filter((p) => p.status === "failed").length;
}

/**
 * Pages that share a tab, switched under the bar: Chat, Split, Nudge, Safe and Friends (People); Autopilot's
 * payments and Scout's groceries (Week).
 */
function Switch({ paths, labels }: { paths: string[]; labels: string[] }) {
  const path = usePathname();
  const { count } = useUnread();
  if (!paths.includes(path)) return null;
  return (
    <div className="flex justify-center px-4 pb-2 lg:hidden">
      <div className="grid w-full max-w-sm rounded-full bg-fill p-0.5 text-[13px]" style={{ gridTemplateColumns: `repeat(${paths.length}, 1fr)` }}>
        {labels.map((label, i) => (
          <Link
            key={label}
            href={paths[i]}
            aria-current={path === paths[i] ? "page" : undefined}
            className={`flex items-center justify-center gap-1 rounded-full py-1 transition-colors ${path === paths[i] ? "bg-raised shadow-sm" : "text-ink/70"}`}
          >
            {label}
            {paths[i] === "/chat" && <UnreadCount count={count} />}
          </Link>
        ))}
      </div>
    </div>
  );
}
