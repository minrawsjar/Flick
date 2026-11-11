import type { Metadata } from "next";
import { Business } from "./business";

export const metadata: Metadata = { title: "Flick for business" };

export default function Page() {
  return <Business />;
}
