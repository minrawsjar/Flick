import type { ReactNode } from "react";
import { ChatBanner } from "@/components/chat-alerts";
import { Nav, TabBar } from "@/components/nav";
import { BackendNotice, OfflineNotice, ReturnNotice } from "../_landing/live-notice";

// Flick's working pages, reached from the navbar: what the installed app opens (manifest.ts). They
// run on the live backend (lib/live.ts); the one-pager at / is the demo. data-app: the phone
// layout in app/globals.css.

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div data-app>
      <Nav app />
      <ReturnNotice />
      <BackendNotice />
      <OfflineNotice />
      {/* Room for the tab bar, below laptop width. */}
      <main className="pb-[calc(env(safe-area-inset-bottom)+84px)] lg:pb-0">{children}</main>
      <TabBar />
      <ChatBanner />
    </div>
  );
}
