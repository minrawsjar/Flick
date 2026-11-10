// A photo shared to Flick before its service worker is running (public/sw.js normally takes these):
// the photo can't be kept, so /lens says to snap it there instead.
export function POST(request: Request) {
  return Response.redirect(new URL("/lens?shared=none", request.url), 303);
}
