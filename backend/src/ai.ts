// Configuration for the AG Studio AI assistant. The OpenAI key is read only here, in the backend:
// the frontend only ever sees the model ids (GET /api/ai/models).

const DEFAULT_MODELS = ['gpt-5.4-mini'];

// AG_STUDIO_OPENAI_API_KEY is specific to this app, so a key set for it in backend/.env always wins.
// OPENAI_API_KEY is the fallback, so a key already exported for other tools works with no setup.
// (Node's --env-file never overrides a variable already in the environment, which is why the
// generic name alone couldn't be overridden per project.)
const KEY_VARIABLES = ['AG_STUDIO_OPENAI_API_KEY', 'OPENAI_API_KEY'] as const;

let loggedKeySource = false;

/** The OpenAI key for the assistant, or undefined when none is configured. */
export function openAiKey(): string | undefined {
  const variable = KEY_VARIABLES.find((name) => process.env[name]);
  if (!loggedKeySource) {
    loggedKeySource = true;
    console.log(
      variable
        ? `[AI] AG Studio assistant enabled, using the OpenAI key from ${variable}`
        : `[AI] AG Studio assistant disabled: set AG_STUDIO_OPENAI_API_KEY in backend/.env to enable it`,
    );
  }
  return variable && process.env[variable];
}

/** The OpenAI models the assistant may use, from OPENAI_MODELS (comma-separated). The first is the default. */
export function aiModels(): string[] {
  const models = (process.env.OPENAI_MODELS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return models.length > 0 ? models : DEFAULT_MODELS;
}

/** The assistant is shown only when a key is configured. */
export function aiEnabled(): boolean {
  return Boolean(openAiKey());
}
