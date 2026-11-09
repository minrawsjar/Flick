import { HttpError } from './http.ts';

// The AI behind Flick: Lens reading photos, Nudge drafting reminders, and AG Studio's assistant.
// Any OpenAI-compatible API works; OpenRouter by default, so one key reaches many models. The key
// stays in the backend: the frontend only ever sees model ids (GET /api/ai/models).

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
// Reads images and fills a JSON schema; cheap enough to call on every snap.
const DEFAULT_MODEL = 'google/gemini-2.5-flash';

let logged = false;

/** The API key, or undefined when AI isn't configured. */
export function aiKey(): string | undefined {
  const key = process.env.AI_API_KEY;
  if (!logged) {
    logged = true;
    console.log(key ? `[AI] using ${aiModels().join(', then ')} at ${aiBaseUrl()}` : '[AI] off: set AI_API_KEY in backend/.env to turn on Lens, Nudge drafts and the Studio assistant');
  }
  return key || undefined;
}

export const aiBaseUrl = () => (process.env.AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
/** AI_MODEL, then any fallbacks listed after it (comma-separated). */
export const aiModels = () => (process.env.AI_MODEL || DEFAULT_MODEL).split(',').map((m) => m.trim()).filter(Boolean);
export const aiModel = () => aiModels()[0];
// OpenRouter tries `models` in order when one is rate-limited or down; other providers take one `model`.
const modelParams = () => (aiBaseUrl().includes('openrouter.ai') && aiModels().length > 1 ? { models: aiModels() } : { model: aiModel() });

/** Models AG Studio's assistant may use, from STUDIO_MODELS (comma-separated); the first is the default. */
export function studioModels(): string[] {
  const models = (process.env.STUDIO_MODELS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return models.length ? models : [aiModel()];
}

export function aiHeaders(key: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
    // OpenRouter shows these on its dashboard; other providers ignore them.
    'HTTP-Referer': 'https://github.com/minrawsjar/Flick',
    'X-Title': 'Flick',
  };
}

export type Message =
  | { role: 'system' | 'assistant'; content: string }
  | { role: 'user'; content: string | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[] };

/**
 * Asks the model for an answer shaped by `schema` (strict JSON Schema: every property required,
 * no extras) and returns it parsed. The caller still validates it: model output is untrusted.
 */
export async function askJson<T>(name: string, schema: object, messages: Message[]): Promise<T> {
  const key = aiKey();
  if (!key) throw new HttpError(503, 'AI is off: set AI_API_KEY in backend/.env.');

  const res = await fetch(`${aiBaseUrl()}/chat/completions`, {
    method: 'POST',
    headers: aiHeaders(key),
    body: JSON.stringify({
      ...modelParams(),
      messages,
      temperature: 0.2,
      response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new HttpError(502, `The AI model answered ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const reply = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
  const content = reply.choices?.[0]?.message?.content;
  if (!content) throw new HttpError(502, 'The AI model sent back an empty answer.');
  try {
    // Some models wrap JSON in a ```json fence even when asked not to.
    return JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '')) as T;
  } catch {
    throw new HttpError(502, 'The AI model sent back something that is not JSON.');
  }
}
