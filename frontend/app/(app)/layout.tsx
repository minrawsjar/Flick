import type { ReactNode } from "react";
import { Nav } from "@/components/nav";
import { BackendNotice, ReturnNotice } from "../_landing/live-notice";

// Flick's working pages, one per agent, reached from the navbar. They run on the live backend
// (lib/live.ts); the one-pager at / is the demo.

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Nav />
      <ReturnNotice />
      <BackendNotice />
      <main>{children}</main>
    </>
  );
}
