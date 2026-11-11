import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { aiKey, studioModels } from './ai.ts';
import { aiResponses } from './ai-proxy.ts';
import * as account from './account.ts';
import * as agent from './agent.ts';
import * as autopilot from './autopilot.ts';
import * as friends from './friends.ts';
import * as inbox from './inbox.ts';
import { cancelCheckout, captureCheckout, flickCheckout, frontendUrl } from './checkout.ts';
import { getDashboardData } from './dashboard-data.ts';
import { HttpError, readBody, send } from './http.ts';
import * as lens from './lens.ts';
import type { Checkout } from './model.ts';
import * as nudge from './nudge.ts';
import * as scout from './scout.ts';
import { PayPalApiError, type Saved } from './paypal.ts';
import * as push from './push.ts';
import { assign, split } from './split.ts';
import { hasWorkspace, inWorkspace, isWorkspaceId, reset, save, state } from './store.ts';

// Flick's API. The browser never calls it directly: the frontend rewrites /api/* to here
// (frontend/next.config.ts), so everything is same-origin and no CORS is needed. The frontend's
// server components call it at BACKEND_URL. Every route is listed in the README.

type Ctx = { req: IncomingMessage; res: ServerResponse; url: URL; body: () => Promise<Record<string, unknown>> };
// A handler either returns data, sent as JSON, or writes the response itself.
type Handler = (ctx: Ctx) => unknown;

const redirect = (res: ServerResponse, to: string) => res.writeHead(303, { Location: to }).end();
/** The frontend page a checkout started from: Autopilot's week, Scout's basket, or a Lens payment. */
const pages = { week: 'autopilot', basket: 'scout', scan: 'lens' } as const;
const pageFor = (orderId: string) => `${frontendUrl()}/${pages[state.checkouts[orderId]?.kind ?? 'scan']}`;

/** A paid checkout (on PayPal's page, or with a flick) goes to the agent that asked for it. */
async function settle(checkout: Checkout, captureId: string, saved?: Saved) {
  if (checkout.kind === 'week') await autopilot.approved(checkout, captureId, saved);
  if (checkout.kind === 'scan') await lens.paid(checkout);
  if (checkout.kind === 'basket') await scout.paid(checkout);
}

/** The session cookie: which workspace this browser is in (null signs out). A guest's comes from frontend/proxy.ts. */
function session(res: ServerResponse, workspace: string | null) {
  const secure = frontendUrl().startsWith('https:') ? '; Secure' : '';
  res.setHeader('Set-Cookie', `flick=${workspace ?? ''}; Path=/; Max-Age=${workspace ? 31_536_000 : 0}; SameSite=Lax; HttpOnly${secure}`);
}

const routes: Record<string, Handler> = {
  'GET /api/health': () => ({ ok: true }),

  /** Everything Flick knows, plus which services are configured. */
  // Not the saved PayPal's vault id, or a sign-in under way: the browser only needs who's signed in.
  'GET /api/state': () => ({
    ...state,
    signingIn: undefined,
    profile: state.profile && { ...state.profile, savedId: '' },
    config: { paypal: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET), ai: Boolean(aiKey()) },
  }),
  /** Back to the start: an empty workspace (the demo seed without a workspace cookie). */
  'POST /api/reset': () => (reset(), state),

  // Lens
  'POST /api/lens/read': async ({ body }) => lens.read(await body()),
  'POST /api/lens/pay': async ({ body }) => lens.pay(await body()),

  // Autopilot
  'POST /api/week/edit': async ({ body }) => autopilot.edit(await body()),
  'POST /api/week/approve': async ({ body }) => autopilot.approve(await body()),
  'POST /api/week/tick': () => autopilot.tick(),
  'POST /api/week/retry': () => autopilot.retry(),
  'POST /api/week/next': () => autopilot.nextWeek(),
  // Autopilot paying by itself, with PayPal saved for it
  'POST /api/autopay/cap': async ({ body }) => autopilot.setCap(await body()),
  'POST /api/autopay/stop': () => autopilot.stopAutopay(),

  // Friends, by their PayPal email
  'POST /api/friends/add': async ({ body }) => friends.add(await body()),
  'POST /api/friends/update': async ({ body }) => friends.update(await body()),
  'POST /api/friends/remove': async ({ body }) => friends.remove(await body()),

  // Splitter and Nudge
  'POST /api/split': async ({ body }) => split(await body()),
  'POST /api/split/assign': async ({ body }) => assign(await body()),
  'POST /api/nudge/draft': async ({ body }) => nudge.draft(await body()),
  'POST /api/nudge/send': async ({ body }) => nudge.send(await body()),
  'POST /api/debts/refresh': () => nudge.refresh(),

  // Scout: what you buy again and again, priced at every store; buying it through PayPal
  'GET /api/scout': () => scout.view(),
  'POST /api/scout/quote': async ({ body }) => scout.priceBasket(await body()),
  'POST /api/scout/read': async ({ body }) => scout.read(await body()),
  'POST /api/scout/online': async ({ body }) => scout.online(await body()),
  'POST /api/scout/buy': async ({ body }) => scout.buy(await body()),

  // What needs the person next, across the agents (inbox.ts), and what Flick did for them this month
  'GET /api/inbox': () => ({ items: inbox.items(), impact: inbox.impact() }),
  'POST /api/inbox/act': async ({ body }) => inbox.act(await body()),

  // Notifications for the installed app (push.ts)
  'GET /api/push/key': () => push.publicKey(),
  'POST /api/push/subscribe': async ({ body }) => push.subscribe(await body()),
  'POST /api/push/unsubscribe': async ({ body }) => push.unsubscribe(await body()),

  // Ask Flick: the agent proposes, the person decides (agent.ts)
  'POST /api/agent': async ({ body }) => agent.ask(await body()),
  'POST /api/agent/decide': async ({ body }) => agent.decide(await body()),

  // PayPal sends the person back here after approving (or cancelling) a checkout; ?token= is the order id.
  'GET /api/paypal/return': async ({ res, url }) => {
    const orderId = url.searchParams.get('token') ?? '';
    try {
      const { checkout, captureId, saved } = await captureCheckout(orderId);
      if (captureId) await settle(checkout, captureId, saved);
      redirect(res, `${pageFor(orderId)}?paid=${checkout.kind}`);
    } catch (err) {
      // An order Flick never made (a stale or made-up link) needs no stack trace.
      console.error('PayPal return:', err instanceof HttpError ? err.message : err);
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
  // Signed in, a flick pays the checkout from the saved PayPal: no PayPal page. Returns the page to show, as PayPal's return would.
  'POST /api/paypal/flick': async ({ body }) => {
    const orderId = String((await body()).orderId ?? '');
    const { checkout, captureId } = await flickCheckout(orderId);
    if (captureId) await settle(checkout, captureId);
    return { to: `${new URL(pageFor(orderId)).pathname}?paid=${checkout.kind}` };
  },

  // Signing in with PayPal (account.ts): PayPal's page saves PayPal with Flick, and comes back here.
  'GET /api/auth/paypal/start': async ({ res, url }) => redirect(res, await account.start(url.searchParams.get('next'))),
  'GET /api/auth/paypal/return': async ({ res, url }) => {
    try {
      const signedIn = await account.finish(url.searchParams.get('approval_token_id') ?? '');
      const isNew = !hasWorkspace(signedIn.workspace);
      const welcome = () => inWorkspace(signedIn.workspace, () => account.welcome(signedIn, isNew));
      // Signing in again in the same browser is already in that workspace (and holds its lock).
      await (signedIn.workspace === signedIn.from ? welcome() : serially(signedIn.workspace, welcome));
      push.move(signedIn.from, signedIn.workspace);
      session(res, signedIn.workspace);
      redirect(res, `${frontendUrl()}${signedIn.next}${signedIn.next.includes('?') ? '&' : '?'}signedin=1`);
    } catch (err) {
      console.error('PayPal sign-in:', err instanceof HttpError ? err.message : err);
      redirect(res, `${frontendUrl()}/login?signin=failed`);
    }
  },
  'GET /api/auth/paypal/cancel': ({ res }) => {
    delete state.signingIn;
    save();
    redirect(res, `${frontendUrl()}/login?signin=cancelled`);
  },
  // Signing out: this browser gets a new, empty guest Flick on its next visit (frontend/proxy.ts).
  'POST /api/auth/signout': ({ res }) => {
    session(res, null);
    return { signedOut: true };
  },

  // Every PayPal endpoint the demo reads, joined into the AG Studio dashboard's tables.
  'GET /api/dashboard': () => getDashboardData(),

  // AG Studio's assistant. Empty when AI is off, which hides it.
  'GET /api/ai/models': () => (aiKey() ? studioModels() : []),
  'POST /api/ai/responses': ({ req, res }) => aiResponses(req, res),
};

// A workspace's changes run one at a time, so two quick taps can never pay the same thing twice.
const writes = new Map<string, Promise<unknown>>();
function serially<T>(workspace: string, work: () => T | Promise<T>): Promise<T> {
  const run = (writes.get(workspace) ?? Promise.resolve()).then(work, work);
  const settled = run.catch(() => {});
  writes.set(workspace, settled);
  void settled.then(() => writes.get(workspace) === settled && writes.delete(workspace));
  return run;
}

/** The visitor's workspace, from the cookie the frontend gives each browser (frontend/proxy.ts). */
function workspaceOf(req: IncomingMessage) {
  const cookie = /(?:^|;\s*)flick=([^;]+)/.exec(req.headers.cookie ?? '')?.[1] ?? '';
  return isWorkspaceId(cookie) ? cookie : 'local';
}
const isWrite = (method: string, path: string) => method !== 'GET' || path === '/api/paypal/return' || path === '/api/paypal/cancel' || path.startsWith('/api/auth/');

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
  const workspace = workspaceOf(req);
  const run = () => inWorkspace(workspace, () => handler(ctx));
  try {
    // The AI proxy streams for as long as a chat lasts, so it doesn't hold the write lock.
    const data = await (isWrite(method, url.pathname) && url.pathname !== '/api/ai/responses' ? serially(workspace, run) : run());
    if (!res.headersSent) send(res, 200, data);
  } catch (err) {
    const status = errorStatus(err);
    // 503 means a key isn't set: the message says so, no stack trace needed.
    if (status >= 500 && status !== 503) console.error(`${method} ${url.pathname}:`, err);
    if (res.headersSent) res.destroy();
    else send(res, status, { error: { message: err instanceof Error ? err.message : String(err) } });
  }
}).listen(port, () => console.log(`Flick backend on http://localhost:${port}`));
push.start();
