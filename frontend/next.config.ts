import type { NextConfig } from "next";
import { BACKEND_URL } from "./lib/api";

const nextConfig: NextConfig = {
  // Bundle only this folder. ../backend is reached over HTTP; its types come in via type-only imports.
  turbopack: { root: __dirname },
  // The end-to-end test (scripts/e2e.mjs) builds into its own folder, pointed at its own backend.
  ...(process.env.NEXT_DIST_DIR && { distDir: process.env.NEXT_DIST_DIR }),
  // Which build this is: the service worker is registered per build, so a deploy replaces what an
  // installed app has cached (components/pwa.tsx, public/sw.js).
  env: { NEXT_PUBLIC_BUILD: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || String(Date.now()) },

  // The browser only talks to this origin; /api/* (e.g. the AI assistant's proxy) is forwarded to the backend.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
