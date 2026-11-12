'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Logo } from '@/components/ui';
import { AiAgentModal } from './AiAgentModal';

// Money Studio's frame: a top bar, the reports sidebar and the canvas, in Flick's tokens so it
// follows the page into dark mode. Shared by the dashboard, its loading skeleton and its error page.
// On a phone the sidebar is a drawer over the canvas, opened from the top bar.

function TopBar({ reportsOpen, onReports }: { reportsOpen: boolean; onReports: () => void }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-separator/60 bg-card px-4 md:px-5">
      <button
        type="button"
        onClick={onReports}
        aria-expanded={reportsOpen}
        aria-controls="studio-reports"
        aria-label={reportsOpen ? 'Close reports' : 'Reports'}
        className="-ml-1 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-fill md:hidden"
      >
        {reportsOpen ? <X size={18} /> : <Menu size={18} />}
      </button>
      <Link href="/" className="flex items-center gap-2 text-[15px] max-md:hidden">
        <Logo />
        Flick
      </Link>
      <span className="h-5 w-px bg-separator max-md:hidden" aria-hidden />
      <span className="truncate text-[15px] font-semibold">Money Studio</span>
      <span className="hidden text-xs text-secondary sm:inline">AG Studio over your PayPal sandbox data</span>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <Link href="/" className="rounded-full bg-fill px-3 py-1 text-[13px] transition-colors hover:bg-fill/70">
          Back to Flick
        </Link>
      </div>
    </header>
  );
}

export function AppShell({
  sidebar,
  children,
  navKey = '',
}: {
  sidebar: ReactNode;
  children: ReactNode;
  /** The report and page on show: picking another one closes the drawer on a phone. */
  navKey?: string;
}) {
  // The drawer is open for the report and page it was opened on, so no effect is needed to close it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === navKey;
  return (
    // overflow-hidden: nothing inside may widen the page, or a phone zooms the whole page out to fit it.
    <div data-studio className="relative flex h-dvh flex-col overflow-hidden bg-grouped font-sans text-ink">
      <TopBar reportsOpen={open} onReports={() => setOpenOn(open ? null : navKey)} />
      <div className="relative flex min-h-0 flex-1">
        <nav
          id="studio-reports"
          className={`flex w-64 shrink-0 flex-col border-r border-separator bg-card max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-30 max-md:w-[min(18rem,85vw)] max-md:shadow-2xl max-md:transition-[translate,visibility] max-md:duration-200 ${open ? '' : 'max-md:invisible max-md:-translate-x-full'}`}
          aria-label="Reports"
        >
          {sidebar}
        </nav>
        {open && <button type="button" aria-label="Close reports" onClick={() => setOpenOn(null)} className="absolute inset-0 z-20 cursor-default bg-black/40 md:hidden" />}
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
      <AiAgentModal />
    </div>
  );
}
