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
const pick = (models: string[]) => (aiBaseUrl().includes('openrouter.ai') && models.length > 1 ? { models } : { model: models[0] });
const modelParams = () => pick(aiModels());

/** Models AG Studio's assistant may use, from STUDIO_MODELS (comma-separated); the first is the default. */
export function studioModels(): string[] {
  const models = (process.env.STUDIO_MODELS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return models.length ? models : [aiModel()];
}

// The API is public once deployed and the key is paid for, so AI calls are capped per hour: a
// runaway client gets a 429 instead of draining the credit.
// ponytail: one global in-memory budget; per-visitor limits if real abuse ever shows up.
const hourlyLimit = () => Number(process.env.AI_HOURLY_LIMIT) || 300;
let budget = { since: Date.now(), used: 0 };

/** Counts one AI call against the hourly cap; throws 429 once it's used up. */
export function spendAi() {
  if (Date.now() - budget.since > 3_600_000) budget = { since: Date.now(), used: 0 };
  if (budget.used >= hourlyLimit()) throw new HttpError(429, "Flick's AI has hit its hourly limit. Try again in a little while.");
  budget.used += 1;
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
  spendAi();

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

// --- Tool use (the Ask Flick agent, agent.ts) ------------------------------------------

export type ToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };
export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };
export type Tool = { type: 'function'; function: { name: string; description: string; parameters: object } };

/** The agent's models: AGENT_MODEL (comma-separated, fallbacks after), or else the Studio assistant's, which are chosen for tool use. */
export const agentModels = () => (process.env.AGENT_MODEL ? process.env.AGENT_MODEL.split(',').map((m) => m.trim()).filter(Boolean) : studioModels());

/** One turn of a conversation with tools: the assistant's reply, which may ask to call some. */
export async function chat(messages: ChatMessage[], tools: Tool[]): Promise<Extract<ChatMessage, { role: 'assistant' }>> {
  const key = aiKey();
  if (!key) throw new HttpError(503, 'AI is off: set AI_API_KEY in backend/.env.');
  spendAi();

  const res = await fetch(`${aiBaseUrl()}/chat/completions`, {
    method: 'POST',
    headers: aiHeaders(key),
    body: JSON.stringify({ ...pick(agentModels()), messages, tools, tool_choice: 'auto', temperature: 0.2 }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new HttpError(502, `The AI model answered ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const reply = (await res.json()) as { choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[] };
  const message = reply.choices?.[0]?.message;
  if (!message) throw new HttpError(502, 'The AI model sent back nothing.');
  return { role: 'assistant', content: message.content ?? null, ...(message.tool_calls?.length && { tool_calls: message.tool_calls }) };
}
