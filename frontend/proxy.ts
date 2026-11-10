import { NextResponse, type NextRequest } from "next/server";

// Every browser gets its own Flick: a workspace id in a cookie, made on its first request. The
// /api/* rewrite and server components (lib/api.ts) pass it to the backend, which keeps that
// browser's things apart from everyone else's (backend/src/store.ts).

const YEAR = 60 * 60 * 24 * 365;

export function proxy(request: NextRequest) {
  if (request.cookies.has("flick")) return NextResponse.next();
  const workspace = crypto.randomUUID().replaceAll("-", "");
  // This first request already belongs to the new workspace, not just the ones after it.
  const headers = new Headers(request.headers);
  headers.set("cookie", [request.headers.get("cookie"), `flick=${workspace}`].filter(Boolean).join("; "));
  const response = NextResponse.next({ request: { headers } });
  response.cookies.set({ name: "flick", value: workspace, path: "/", maxAge: YEAR, sameSite: "lax", httpOnly: true, secure: request.nextUrl.protocol === "https:" });
  return response;
}

export const config = {
  // Pages and /api/*; not the build's files, icons or the service worker.
  matcher: ["/((?!_next/static|_next/image|pwa-icon|apple-icon|.*\\.(?:js|css|png|jpg|svg|ico|webmanifest|txt)$).*)"],
};
