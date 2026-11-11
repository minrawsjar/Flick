import type { Metadata } from "next";
import { Profile } from "./profile";

export const metadata: Metadata = { title: "Your profile" };

export default function Page() {
  return <Profile />;
}
