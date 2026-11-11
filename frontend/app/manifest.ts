import type { MetadataRoute } from "next";

// What makes Flick installable as an app (see /install). It opens on Today, full screen. Long-press
// the icon for shortcuts; on Android, photos and e-bills shared to Flick go to Lens (public/sw.js takes them).

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/home",
    name: "Flick: snap it, Flick pays",
    short_name: "Flick",
    description: "Snap a bill, a receipt or anything you want. Flick's agents pay it with PayPal and run your week on autopilot.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Snap a bill", short_name: "Snap", url: "/lens" },
      { name: "This week", short_name: "Week", url: "/autopilot" },
      { name: "Ask Flick", short_name: "Ask", url: "/ask" },
      { name: "Get paid back", short_name: "Nudge", url: "/nudge" },
    ],
    share_target: {
      action: "/share",
      method: "POST",
      enctype: "multipart/form-data",
      // A photo or an e-bill (PDF) as a file, or a bill as text: an e-mail shared from a mail app.
      params: { title: "title", text: "text", url: "url", files: [{ name: "photo", accept: ["image/*", "application/pdf", ".pdf"] }] },
    },
  };
}
