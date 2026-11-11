import type { Metadata } from "next";
import { Suspense } from "react";
import { ChatApp } from "./chat";

export const metadata: Metadata = { title: "Flick Chat" };

// Which chat is open is in the URL (?with=their PayPal email), so a notification can open it.
export default function Page() {
  return (
    <Suspense>
      <ChatApp />
    </Suspense>
  );
}
