"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import { Logo } from "./ui";

// The bar across the top of every page except Money Studio: Flick's mark (the one-pager), the four
// agents' working pages, and Money Studio.

const links = [
  ["/ask", "Ask Flick"],
  ["/lens", "Lens"],
  ["/autopilot", "Autopilot"],
  ["/split", "Split"],
  ["/nudge", "Nudge"],
  ["/friends", "Friends"],
] as const;

function Links({ className = "" }: { className?: string }) {
  const path = usePathname();
  return (
    <div className={`items-center gap-1 text-[13px] ${className}`}>
      {links.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={path === href ? "page" : undefined}
          className={`shrink-0 rounded-full px-3 py-1 transition-colors ${path === href ? "bg-fill text-ink" : "text-ink/70 hover:text-ink"}`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

export function Nav() {
  return (
    <header className="sticky top-0 z-30 bg-page/75 backdrop-blur-2xl backdrop-saturate-150">
      <nav className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-[15px]">
          <Logo />
          Flick
        </Link>
        <Links className="hidden md:flex" />
        <span className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/dashboard" className="pressable rounded-full bg-ink px-3 py-1 text-[13px] text-on-ink">
            Money Studio
          </Link>
        </span>
      </nav>
      {/* On phones the links get their own row, which scrolls sideways if it must. */}
      <Links className="flex overflow-x-auto px-3 pb-2 md:hidden" />
    </header>
  );
}
