'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Logo } from '@/components/ui';
import { AiAgentModal } from './AiAgentModal';

// Money Studio's frame: a top bar, the reports sidebar and the canvas, in Flick's tokens so it
// follows the page into dark mode. Shared by the dashboard, its loading skeleton and its error page.

function TopBar() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-separator/60 bg-card px-5">
      <Link href="/" className="flex items-center gap-2 text-[15px]">
        <Logo />
        Flick
      </Link>
      <span className="h-5 w-px bg-separator" aria-hidden />
      <span className="text-[15px] font-semibold">Money Studio</span>
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
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative flex h-dvh flex-col bg-grouped font-sans text-ink">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <nav className="flex w-64 shrink-0 flex-col border-r border-separator bg-card" aria-label="Reports">
          {sidebar}
        </nav>
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
      <AiAgentModal />
    </div>
  );
}
