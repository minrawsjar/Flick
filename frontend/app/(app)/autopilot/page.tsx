import type { Metadata } from "next";
import { Section } from "@/components/ui";
import { agents } from "@/app/_landing/data";
import { Autopilot } from "@/app/_landing/autopilot";
import { Autopay } from "./autopay";

export const metadata: Metadata = { title: "Autopilot" };

export default function Page() {
  return (
    <Section id="autopilot" compact tone="white" agent={agents.autopilot} glow="left" label="Autopilot" title="Your week, on autopilot." intro="This week's plan, from what Flick has seen you pay. Edit it, approve it once with PayPal, then step through the days as each payment goes out.">
      <Autopilot />
      <Autopay />
    </Section>
  );
}
