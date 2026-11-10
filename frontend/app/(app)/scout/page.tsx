import type { Metadata } from "next";
import { Section } from "@/components/ui";
import { agents } from "@/app/_landing/data";
import { Scout } from "@/app/_landing/scout";

export const metadata: Metadata = { title: "Scout" };

export default function Page() {
  return (
    <Section
      id="scout"
      compact
      tone="white"
      agent={agents.scout}
      glow="left"
      label="Scout"
      title="Never overpay for the usual."
      intro="Scout learns what you buy and when, finds it cheapest this week nearby or online, and says when a price is heading up. One PayPal approval buys the lot."
    >
      <Scout />
    </Section>
  );
}
