import type { Metadata } from "next";
import { Section } from "@/components/ui";
import { agents } from "@/app/_landing/data";
import { Split } from "@/app/_landing/split";

export const metadata: Metadata = { title: "Splitter" };

export default function Page() {
  return (
    <Section id="split" compact tone="white" agent={agents.splitter} glow="right" label="Splitter" title="Split a bill." intro="Tick who had what, or split it evenly. Friends on Flick get their share in Flick Chat and pay it with a flick; anyone else gets a PayPal invoice. Snap a receipt in Lens to split it here.">
      <Split />
    </Section>
  );
}
