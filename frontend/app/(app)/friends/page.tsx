import type { Metadata } from "next";
import { Section } from "@/components/ui";
import { FriendsBook } from "@/app/_landing/friends";

export const metadata: Metadata = { title: "Friends" };

export default function Page() {
  return (
    <Section
      id="friends"
      compact
      tone="white"
      label="Friends"
      title="Your people, by their PayPal."
      intro="Add the friends you split with, by the email of their PayPal account. Splitter invoices them there, Nudge reminds them there, and Autopilot pays them there."
    >
      <FriendsBook />
    </Section>
  );
}
