import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { aiKey, studioModels } from './ai.ts';
import { aiResponses } from './ai-proxy.ts';
import * as autopilot from './autopilot.ts';
import { cancelCheckout, captureCheckout, frontendUrl } from './checkout.ts';
import { getDashboardData } from './dashboard-data.ts';
import { HttpError, readBody, send } from './http.ts';
import * as lens from './lens.ts';
import * as nudge from './nudge.ts';
import { PayPalApiError } from './paypal.ts';
import { split } from './split.ts';
import { reset, save, state } from './store.ts';

// Flick's API. The browser never calls it directly: the frontend rewrites /api/* to here
// (frontend/next.config.ts), so everything is same-origin and no CORS is needed. The frontend's
// server components call it at BACKEND_URL. Every route is listed in the README.

type Ctx = { req: IncomingMessage; res: ServerResponse; url: URL; body: () => Promise<Record<string, unknown>> };
// A handler either returns data, sent as JSON, or writes the response itself.
type Handler = (ctx: Ctx) => unknown;

const redirect = (res: ServerResponse, to: string) => res.writeHead(303, { Location: to }).end();
/** The frontend page a checkout started from: Autopilot's week, or a Lens payment. */
const pageFor = (orderId: string) => `${frontendUrl()}/${state.checkouts[orderId]?.kind === 'week' ? 'autopilot' : 'lens'}`;

const routes: Record<string, Handler> = {
  'GET /api/health': () => ({ ok: true }),

  /** Everything Flick knows, plus which services are configured. */
  'GET /api/state': () => ({ ...state, config: { paypal: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET), ai: Boolean(aiKey()) } }),
  /** Back to the demo's starting point. */
  'POST /api/reset': () => (reset(), state),

  // Lens
  'POST /api/lens/read': async ({ body }) => lens.read(await body()),
  'POST /api/lens/pay': async ({ body }) => lens.pay(await body()),

  // Autopilot
  'POST /api/week/edit': async ({ body }) => autopilot.edit(await body()),
  'POST /api/week/approve': () => autopilot.approve(),
  'POST /api/week/tick': () => autopilot.tick(),
  'POST /api/week/retry': () => autopilot.retry(),
  'POST /api/week/next': () => autopilot.nextWeek(),

  // Splitter and Nudge
  'POST /api/split': async ({ body }) => split(await body()),
  'POST /api/nudge/draft': async ({ body }) => nudge.draft(await body()),
  'POST /api/nudge/send': async ({ body }) => nudge.send(await body()),
  'POST /api/debts/refresh': () => nudge.refresh(),

  // PayPal sends the person back here after approving (or cancelling) a checkout; ?token= is the order id.
  'GET /api/paypal/return': async ({ res, url }) => {
    const orderId = url.searchParams.get('token') ?? '';
    try {
      const { checkout, captureId } = await captureCheckout(orderId);
      if (captureId && checkout.kind === 'week') await autopilot.approved(checkout, captureId);
      if (captureId && checkout.kind === 'scan') await lens.paid(checkout);
      redirect(res, `${pageFor(orderId)}?paid=${checkout.kind}`);
    } catch (err) {
      console.error('PayPal return:', err);
      redirect(res, `${pageFor(orderId)}?checkout=failed`);
    }
  },
  'GET /api/paypal/cancel': ({ res, url }) => {
    const checkout = cancelCheckout(url.searchParams.get('token') ?? '');
    if (checkout?.kind === 'week' && state.week.approval?.orderId === checkout.orderId) delete state.week.approval;
    if (checkout?.kind === 'scan') {
      const scan = state.scans.find((s) => s.id === checkout.scanId);
      if (scan?.status === 'awaiting') scan.status = 'read';
    }
    save();
    redirect(res, `${pageFor(url.searchParams.get('token') ?? '')}?checkout=cancelled`);
  },

  // Every PayPal endpoint the demo reads, joined into the AG Studio dashboard's tables.
  'GET /api/dashboard': () => getDashboardData(),

  // AG Studio's assistant. Empty when AI is off, which hides it.
  'GET /api/ai/models': () => (aiKey() ? studioModels() : []),
  'POST /api/ai/responses': ({ req, res }) => aiResponses(req, res),
};

// Changes run one at a time, so two quick taps can never pay the same thing twice.
// ponytail: one global lock for every write; fine for one person, per-account locks if it serves many.
let writes: Promise<unknown> = Promise.resolve();
function serially<T>(work: () => T | Promise<T>): Promise<T> {
  const run = writes.then(work, work);
  writes = run.catch(() => {});
  return run;
}
const isWrite = (method: string, path: string) => method !== 'GET' || path === '/api/paypal/return' || path === '/api/paypal/cancel';

function errorStatus(err: unknown) {
  if (err instanceof HttpError) return err.status;
  if (err instanceof PayPalApiError) return err.status === 401 || err.status === 403 ? 503 : 502;
  return 500;
}

const port = Number(process.env.PORT) || 4000;

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const method = req.method ?? 'GET';
  const handler = routes[`${method} ${url.pathname}`];
  if (!handler) return send(res, 404, { error: { message: `No route for ${method} ${url.pathname}` } });

  const ctx: Ctx = { req, res, url, body: () => readBody(req) };
  try {
    // The AI proxy streams for as long as a chat lasts, so it doesn't hold the write lock.
    const data = await (isWrite(method, url.pathname) && url.pathname !== '/api/ai/responses' ? serially(() => handler(ctx)) : handler(ctx));
    if (!res.headersSent) send(res, 200, data);
  } catch (err) {
    const status = errorStatus(err);
    // 503 means a key isn't set: the message says so, no stack trace needed.
    if (status >= 500 && status !== 503) console.error(`${method} ${url.pathname}:`, err);
    if (res.headersSent) res.destroy();
    else send(res, status, { error: { message: err instanceof Error ? err.message : String(err) } });
  }
}).listen(port, () => console.log(`Flick backend on http://localhost:${port}`));
