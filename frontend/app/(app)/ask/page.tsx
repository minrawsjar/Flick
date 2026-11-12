import type { Metadata } from "next";
import { Section } from "@/components/ui";
import { Ask } from "@/app/_landing/ask";

export const metadata: Metadata = { title: "Ask Flick" };

export default function Page() {
  return (
    <Section
      id="ask"
      compact
      tone="white"
      label="Ask Flick"
      title="Say what you need. Flick does the rest."
      intro="One conversation reaches Lens, Autopilot, Splitter, Nudge, Scout and Safe. Flick reads your real data, plans the steps, and asks before it does anything."
    >
      <Ask />
    </Section>
  );
}
