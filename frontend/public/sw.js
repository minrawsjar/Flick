// Flick's service worker (registered by components/pwa.tsx, production only).
// - The installed app opens offline: pages and GET /api/state come from the network when it
//   answers, and from the last copy otherwise. Nothing that moves money is ever cached or replayed.
// - Built files (/_next/static, content-hashed) come from the cache once fetched.
// - Photos shared to Flick from another app (Android's share sheet, app/manifest.ts share_target)
//   arrive here as a POST to /share; the photo is kept for /lens, which reads it with Lens.

// Bump to drop every cached page and file. ponytail: old /_next/static chunks pile up until then.
const VERSION = "flick-v1";
const SHARED = "flick-share";
const PAGES = ["/home", "/lens", "/autopilot", "/scout", "/ask", "/split", "/nudge", "/friends", "/install"];

self.addEventListener("install", (event) => {
  // Best effort: a page that fails to fetch is cached on its first visit instead.
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => Promise.allSettled(PAGES.map((page) => cache.add(page))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION && key !== SHARED).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.method === "POST" && url.pathname === "/share") return event.respondWith(receiveShare(request));
  if (request.method !== "GET") return;
  if (url.pathname.startsWith("/_next/static/")) return event.respondWith(cacheFirst(request));
  if (url.pathname === "/api/state") return event.respondWith(networkFirst(request, url.pathname));
  // The rest of the API (PayPal's return, which captures a payment, is a navigation) goes straight
  // to the network, untouched.
  if (url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") return event.respondWith(networkFirst(request, url.pathname));
});

async function networkFirst(request, key) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(request);
    if (res.ok) await cache.put(key, res.clone());
    return res;
  } catch (err) {
    const copy = await cache.match(key);
    if (copy) return copy;
    if (request.mode !== "navigate") throw err;
    return (await cache.match("/home")) ?? offline();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const copy = await cache.match(request);
  if (copy) return copy;
  const res = await fetch(request);
  if (res.ok) await cache.put(request, res.clone());
  return res;
}

async function receiveShare(request) {
  const photo = (await request.formData()).get("photo");
  const ok = photo instanceof File && photo.type.startsWith("image/");
  if (ok) await (await caches.open(SHARED)).put("/shared-photo", new Response(photo, { headers: { "Content-Type": photo.type } }));
  return Response.redirect(new URL(ok ? "/lens?shared=1" : "/lens?shared=none", self.location.origin).href, 303);
}

const offline = () =>
  new Response(
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Flick</title>' +
      '<body style="font:17px -apple-system,system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;text-align:center">' +
      "<p>You're offline.<br>Flick opens again when you're back online.</p>",
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
