import type { Metadata } from "next";
import { Section } from "@/components/ui";
import { agents } from "@/app/_landing/data";
import { Split } from "@/app/_landing/split";

export const metadata: Metadata = { title: "Splitter" };

export default function Page() {
  return (
    <Section id="split" compact tone="white" agent={agents.splitter} glow="right" label="Splitter" title="Split a bill." intro="Tick who had what, and each friend gets a PayPal invoice for their share. Snap a receipt in Lens to split it here.">
      <Split />
    </Section>
  );
}
