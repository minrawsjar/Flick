import type { Metadata } from "next";
import { Section } from "@/components/ui";
import { agents } from "@/app/_landing/data";
import { Snap } from "@/app/_landing/lens";
import { SharedPhoto } from "./shared-photo";

export const metadata: Metadata = { title: "Lens" };

export default function Page() {
  return (
    <>
      <SharedPhoto />
      <Section id="lens" compact tone="white" agent={agents.lens} glow="left" label="Lens" title="Snap something to pay." intro="Tap a sample or snap your own photo. Lens reads it with AI, and paying goes through PayPal's sandbox checkout.">
        <Snap />
      </Section>
    </>
  );
}
