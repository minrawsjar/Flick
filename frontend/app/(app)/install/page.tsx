import type { Metadata } from "next";
import { Section } from "@/components/ui";
import { Install } from "./install";

export const metadata: Metadata = { title: "Get the app" };

export default function Page() {
  return (
    <Section
      id="install"
      compact
      tone="grey"
      label="Get the app"
      title="Flick, on your home screen."
      intro="Install Flick like an app, straight from this page: no app store. It opens full screen on Today, works offline, and takes photos you share to it."
    >
      <Install />
    </Section>
  );
}
