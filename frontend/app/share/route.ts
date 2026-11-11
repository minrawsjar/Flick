// A bill shared to Flick before its service worker is running (public/sw.js normally takes these):
// it can't be kept, so /lens says to snap or upload it there instead.
export function POST(request: Request) {
  return Response.redirect(new URL("/lens?shared=none", request.url), 303);
}
