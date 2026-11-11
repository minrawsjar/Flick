import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { FlickConfirm } from "@/components/flick-confirm";
import { ServiceWorker } from "@/components/pwa";
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
  // Installed from Safari's "Add to Home Screen": opens full screen, named Flick.
  appleWebApp: { capable: true, title: "Flick", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  // Under the notch and home indicator; the bars pad themselves with env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The theme script sets data-theme before React hydrates, hence suppressHydrationWarning.
    // data-scroll-behavior: the page scrolls smoothly (globals.css), but going to another page lands
    // at once, as Next.js did by itself before version 16.
    <html lang="en" className={`${inter.variable} h-full antialiased`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        {children}
        <FlickConfirm />
        <ServiceWorker />
      </body>
    </html>
  );
}
