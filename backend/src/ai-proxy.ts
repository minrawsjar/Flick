import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { json } from 'node:stream/consumers';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream } from 'node:stream/web';
import { aiBaseUrl, aiHeaders, aiKey, studioModels } from './ai.ts';
import { send } from './http.ts';

// Proxy for AG Studio's OpenAI adapter (frontend/app/dashboard/studio/openai-adapter.ts). The adapter
// runs in the browser and POSTs to `${endpoint}/responses`; with its endpoint set to /api/ai it reaches the
// frontend, whose /api/* rewrite forwards it here. This adds the AI key (see ai.ts), forwards the body to
// the provider's Responses API (OpenAI's, or OpenRouter's compatible one) and streams the SSE reply
// straight back, so the adapter works unchanged and the key never leaves the backend.

// Bounds the cost of a single turn, whatever the client asks for. Reasoning tokens count towards it.
const MAX_OUTPUT_TOKENS = 32_000;

export async function aiResponses(req: IncomingMessage, res: ServerResponse) {
  const apiKey = aiKey();
  if (!apiKey) return send(res, 503, { error: { message: 'The AI assistant is off: set AI_API_KEY in backend/.env.' } });

  let body: Record<string, unknown>;
  try {
    body = (await json(req)) as Record<string, unknown>;
  } catch {
    return send(res, 400, { error: { message: 'Request body must be JSON.' } });
  }

  // Only the models offered in the picker (STUDIO_MODELS) may be called.
  const models = studioModels();
  const model = typeof body.model === 'string' && body.model ? body.model : models[0];
  if (!models.includes(model)) return send(res, 400, { error: { message: `Model "${model}" is not enabled.` } });

  // Stopping the chat in Studio drops the browser's connection, which cancels the upstream call too.
  const abort = new AbortController();
  res.on('close', () => abort.abort());

  const upstream = await fetch(`${aiBaseUrl()}/responses`, {
    method: 'POST',
    headers: aiHeaders(apiKey),
    body: JSON.stringify({ ...body, model, max_output_tokens: MAX_OUTPUT_TOKENS }),
    signal: abort.signal,
  });

  // Errors come back as JSON and the adapter reads `error.message` from them; success is an SSE stream.
  // no-transform stops the frontend's gzip (and any CDN) from buffering the stream until it ends.
  res.writeHead(upstream.status, {
    'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
    'Cache-Control': 'no-store, no-transform',
  });
  if (!upstream.body) return res.end();
  await pipeline(Readable.fromWeb(upstream.body as ReadableStream), res);
}
