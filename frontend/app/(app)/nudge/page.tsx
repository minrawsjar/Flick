import type { Metadata } from "next";
import { Section } from "@/components/ui";
import { agents } from "@/app/_landing/data";
import { Nudge } from "@/app/_landing/nudge";

export const metadata: Metadata = { title: "Nudge" };

export default function Page() {
  return (
    <Section id="nudge" compact tone="white" agent={agents.nudge} glow="left" label="Nudge" title="Get paid back." intro="Who still owes you. Pick a tone: Nudge writes the reminder and PayPal sends it.">
      <Nudge />
    </Section>
  );
}
