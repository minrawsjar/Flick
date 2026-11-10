// Flick's service worker (registered by components/pwa.tsx, production only).
// - The installed app opens offline: pages and GET /api/state come from the network when it
//   answers, and from the last copy otherwise. Nothing that moves money is ever cached or replayed.
// - Built files (/_next/static, content-hashed) come from the cache once fetched.
// - Photos shared to Flick from another app (Android's share sheet, app/manifest.ts share_target)
//   arrive here as a POST to /share; the photo is kept for /lens, which reads it with Lens.

// - Notifications (backend/src/push.ts): each push is a JSON { title, body, url, tag }; tapping one
//   opens that page in the app.

// One cache per build: each deploy registers its own worker (/sw.js?v=<build>, components/pwa.tsx),
// and activating it drops the caches of the builds before, pages and files alike.
const VERSION = `flick-${new URL(self.location.href).searchParams.get("v") || "dev"}`;
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

self.addEventListener("push", (event) => {
  let message = { title: "Flick", body: "Something needs you.", url: "/home", tag: "flick" };
  try {
    message = { ...message, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.tag,
      icon: "/pwa-icon/192",
      badge: "/pwa-icon/192",
      data: { url: message.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/home", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((open) => {
      const tab = open.find((c) => new URL(c.url).origin === self.location.origin);
      return tab ? tab.navigate(url).then((c) => (c ?? tab).focus()) : self.clients.openWindow(url);
    }),
  );
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
