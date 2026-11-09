import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// SF on Apple devices; Inter everywhere else (see --font-sans in globals.css).
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

// Re-applies a light or dark choice made with the nav's toggle (components/theme-toggle.tsx)
// before first paint, so a dark page never flashes white.
const themeScript = `try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

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
    // The theme script sets data-theme before React hydrates, hence suppressHydrationWarning.
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
