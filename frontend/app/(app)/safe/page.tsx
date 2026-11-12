import type { Metadata } from "next";
import { Section } from "@/components/ui";
import { agents } from "@/app/_landing/data";
import { Safes } from "./safes";

export const metadata: Metadata = { title: "Safe" };

export default function Page() {
  return (
    <Section
      id="safe"
      compact
      tone="white"
      agent={agents.safe}
      glow="left"
      label="Safe"
      title="Money for one thing."
      intro="Give a friend money for a purpose and it waits in a Safe. They snap the receipt to spend it; Safe checks it's for what you said, and has never been used before. What's left comes back to you."
    >
      <Safes />
    </Section>
  );
}
