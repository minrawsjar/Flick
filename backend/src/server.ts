import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { aiModels, openAiKey } from './ai.ts';
import { aiResponses } from './ai-proxy.ts';
import { getDashboardData } from './dashboard-data.ts';
import { send } from './send.ts';

// Flick's API. The browser never calls it directly: the frontend rewrites /api/* to here
// (frontend/next.config.ts), so everything is same-origin and no CORS is needed. The frontend's
// server components call it at BACKEND_URL.

// A handler either returns data, sent as JSON, or writes the response itself.
type Handler = (req: IncomingMessage, res: ServerResponse) => unknown;

const routes: Record<string, Handler> = {
  'GET /api/health': () => ({ ok: true }),

  // Every PayPal endpoint the demo reads, joined into the AG Studio dashboard's tables.
  'GET /api/dashboard': () => getDashboardData(),

  // Empty when no OpenAI key is configured, which hides the assistant.
  'GET /api/ai/models': () => (openAiKey() ? aiModels() : []),
  'POST /api/ai/responses': aiResponses,
};

const port = Number(process.env.PORT) || 4000;

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  const handler = routes[`${req.method} ${pathname}`];
  if (!handler) return send(res, 404, { error: { message: `No route for ${req.method} ${pathname}` } });

  try {
    const data = await handler(req, res);
    if (!res.headersSent) send(res, 200, data);
  } catch (err) {
    console.error(`${req.method} ${pathname}:`, err);
    if (res.headersSent) res.destroy();
    else send(res, 500, { error: { message: err instanceof Error ? err.message : String(err) } });
  }
}).listen(port, () => console.log(`Flick backend on http://localhost:${port}`));
