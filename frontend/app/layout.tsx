import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// SF on Apple devices; Inter everywhere else (see --font-sans in globals.css).
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    template: "%s · Flick",
    default: "Flick: snap it, Flick pays",
  },
  description:
    "Snap a bill, a receipt or anything you want. Flick's agents pay it with PayPal, learn it, and run your week's payments on autopilot.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
