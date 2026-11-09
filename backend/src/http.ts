import type { IncomingMessage, ServerResponse } from 'node:http';
import { json } from 'node:stream/consumers';

export const send = (res: ServerResponse, status: number, body: unknown) =>
  res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));

/** An error with the HTTP status the API should answer with. */
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Rejects a request (400 unless said otherwise) when `ok` is false. */
export function need(ok: unknown, message: string, status = 400): asserts ok {
  if (!ok) throw new HttpError(status, message);
}

// Lens photos arrive as data URLs; a phone photo, downscaled by the browser, is well under this.
const MAX_BODY = 8 * 1024 * 1024;

/** The request's JSON body, or {} when there is none. */
export async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  need(Number(req.headers['content-length'] ?? 0) <= MAX_BODY, 'Request body is too large (8 MB at most).', 413);
  if (!req.headers['content-length'] && !req.headers['transfer-encoding']) return {};
  let body: unknown;
  try {
    body = await json(req);
  } catch {
    throw new HttpError(400, 'Request body must be JSON.');
  }
  need(body && typeof body === 'object' && !Array.isArray(body), 'Request body must be a JSON object.');
  return body as Record<string, unknown>;
}
