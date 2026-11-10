import { ImageResponse } from "next/og";
import { AppIcon } from "@/lib/app-icon";

// The installed app's icons (app/manifest.ts), drawn at build time.

const sizes = ["192", "512"];
export const dynamicParams = false;
export const generateStaticParams = () => sizes.map((size) => ({ size }));

export async function GET(_: Request, { params }: RouteContext<"/pwa-icon/[size]">) {
  const size = Number((await params).size);
  return new ImageResponse(<AppIcon size={size} />, { width: size, height: size });
}
