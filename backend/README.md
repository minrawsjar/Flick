# Backend: The Agents and the Money

> **TypeScript on Node 22.18+, run directly: no build step and no runtime dependencies. Runs as one Railway service.**

Everything that holds a secret or moves money. The six agents, Flick Chat and Ask Flick live here,
along with every PayPal call and every AI call. The [frontend](../frontend/) reaches it only
through its `/api/*` rewrite, so the browser never holds a key or calls another origin.

Live at [flick-backend-production.up.railway.app](https://flick-backend-production.up.railway.app/api/health),
with a volume that keeps each person's Flick.

## Architecture

```
Browser → www.flickit.site/api/* (Vercel rewrite, cookie and all)
  → server.ts: the route table; the `flick` cookie picks the workspace
  → inWorkspace(): that person's JSON document, one write at a time
  → an agent: lens.ts, autopilot.ts, split.ts, nudge.ts, scout.ts, safe.ts, chat.ts, agent.ts
      → rules.ts / scout-rules.ts / safe-rules.ts: pure rules decide amounts, shares and what's due
      → ai.ts: a vision or chat model reads and drafts (never sets an amount)
      → paypal.ts: Orders, Vault, Payouts, Invoicing, refunds
  → store.ts writes the workspace atomically (.tmp, then rename)

PayPal → /api/paypal/webhook → verified → routed to the workspace it's about → applied once
```

**Our rule:** AI reads and proposes, rules check, a person approves, and PayPal moves the money.

## Folder Structure

```
backend/
├── src/
│   ├── server.ts             # The route table, a workspace per request, one write at a time
│   ├── store.ts              # A JSON workspace per person; findWorkspace for webhooks
│   ├── model.ts              # The data model and small pure helpers; imports nothing
│   ├── http.ts               # HttpError and need()
│   ├── seed.ts               # The empty start, and the demo week
│   │
│   ├── paypal.ts             # Every PayPal call: OAuth, retries, request ids
│   ├── checkout.ts           # A checkout on PayPal's page, or a flick from the saved PayPal
│   ├── account.ts            # Signing in with PayPal (Vault); your money through Flick
│   ├── webhooks.ts           # PayPal webhooks: verified, routed, applied once
│   │
│   ├── rules.ts              # Pure rules: the week, the unusual, shares, checking Lens (tested)
│   ├── lens.ts               # Lens: photos, PDFs and e-mails, read and paid
│   ├── autopilot.ts          # Autopilot: one approval a week, a payout each day
│   ├── split.ts              # Splitter: who had what, then invoices or chat requests
│   ├── nudge.ts              # Nudge: reminders through PayPal or the chat
│   ├── scout.ts              # Scout: prices, photos, Channel3's live offers, buying
│   ├── scout-rules.ts        # Scout's catalog, weekly prices, trends, forecasts (tested)
│   ├── safe.ts               # Safe: money for one purpose, spent against receipts that fit it
│   ├── safe-rules.ts         # What a receipt gets from a Safe, and what's refused (tested)
│   ├── friends.ts            # Friends, by their PayPal e-mail
│   ├── chat.ts               # Flick Chat: people.json, chats/, paying each other
│   ├── business.ts           # Businesses on Flick, paid at their own PayPal
│   ├── agent.ts              # Ask Flick: tools, and plan-then-approve
│   ├── inbox.ts              # What needs you next
│   ├── push.ts               # Web Push with no library (RFC 8291 and 8292)
│   │
│   ├── ai.ts                 # One OpenAI-compatible client: JSON reads, the hourly budget
│   ├── ai-proxy.ts           # AG Studio's Responses API proxy: the key, allowed models, a cap
│   ├── dashboard-data.ts     # Money Studio's rows, from PayPal and from Flick
│   └── *.test.ts             # Unit tests (node --test)
├── scripts/
│   ├── check.ts              # npm run check: is each PayPal feature and the AI on?
│   ├── api.ts                # npm run api: every route, used right and wrong, on the real sandbox
│   ├── loop.ts               # npm run loop: the whole money loop through PayPal's real page
│   └── harness.ts            # What those share: a backend on its own port and state
├── env.example               # Every variable, explained
├── railway.json              # Railway: npm start, the health check, restart on failure
└── .railwayignore            # Never uploads .env, state or node_modules
```

## The Agents

| Agent | File | Reads with AI | Pays with PayPal |
|---|---|---|---|
| **Lens** | [`lens.ts`](src/lens.ts) | A photo, an e-bill's PDF or an e-mail, into strict JSON | An order, or a Vault charge on a flick; a payout to the biller or business |
| **Autopilot** | [`autopilot.ts`](src/autopilot.ts) | Nothing: it plans with rules | One order (or a Vault charge) for the week; a payout batch each day; refunds |
| **Splitter** | [`split.ts`](src/split.ts) | "Maya and I shared the salmon", into who had what | An invoice to each friend not on Flick, or a request in Flick Chat |
| **Nudge** | [`nudge.ts`](src/nudge.ts) | A reminder in the tone you pick | PayPal's own invoice reminder |
| **Scout** | [`scout.ts`](src/scout.ts) | A shelf, fridge, cart or list, into products | An order priced on the server, then a payout to the store |
| **Safe** | [`safe.ts`](src/safe.ts) | A receipt, into its lines, each for the purpose or not, and signs of a fake | A Vault charge to give it; a payout per receipt; a partial refund of what's left |
| **Flick Chat** | [`chat.ts`](src/chat.ts) | Nothing | A Vault charge, then a payout to the friend |
| **Ask Flick** | [`agent.ts`](src/agent.ts) | Plans across the others, with tools | Through the agents above, once you approve |

## Public Routes

Every route is listed in the [main README's API section](../README.md#api). By area:

| Area | Routes |
|---|---|
| **State** | `GET /api/health`, `GET /api/state`, `POST /api/reset` |
| **Lens** | `POST /api/lens/read`, `/lens/pay` |
| **Autopilot** | `POST /api/week/edit`, `/approve`, `/tick`, `/retry`, `/next`; `/autopay/cap`, `/stop` |
| **People** | `/api/friends/*`, `/api/split`, `/split/assign`, `/api/nudge/*`, `/api/debts/refresh`, `/api/chat/*` |
| **Scout** | `GET /api/scout`; `POST /api/scout/quote`, `/read`, `/online`, `/buy` |
| **Safe** | `GET /api/safes`; `POST /api/safe`, `/safe/spend`, `/safe/decide`, `/safe/close` |
| **Ask Flick, Today** | `POST /api/agent`, `/agent/decide`; `GET /api/inbox`, `POST /api/inbox/act`; `/api/push/*` |
| **PayPal** | `GET /api/paypal/return`, `/cancel`; `POST /api/paypal/flick`, `/paypal/webhook`; `/api/auth/paypal/*` |
| **You** | `POST /api/profile`, `GET /api/profile/money`, `/api/business` |
| **Money Studio** | `GET /api/dashboard`, `GET /api/ai/models`, `POST /api/ai/responses` |

## Environment

Copy [`env.example`](env.example) to `.env` (git-ignored). Variables already in your shell win.

| Variable | What it's for |
|---|---|
| `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET` | The sandbox REST app, on a US business account, with Accept payments, Payouts, Invoicing, Transaction search and Save payment methods on |
| `FRONTEND_URL` | Where PayPal sends people back (the site's public URL when deployed) |
| `SESSION_SECRET` | Keys signed-in workspaces (else `PAYPAL_SECRET`) |
| `PAYPAL_WEBHOOK_ID` | The webhook's id in the sandbox app, for verifying events |
| `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | The model, on OpenRouter unless set; fallbacks after the first, comma-separated |
| `STUDIO_MODELS`, `AGENT_MODEL` | Models Money Studio's assistant and Ask Flick may use |
| `AI_HOURLY_LIMIT` | AI calls an hour, across everyone (300) |
| `CHANNEL3_API_KEY` | Scout's live online prices (optional) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Web Push keys (made on first use unless set) |
| `STATE_FILE`, `PORT` | Where workspaces live (`.data/`), and the port (4000) |
| `SANDBOX_BUYER_EMAIL`, `SANDBOX_BUYER_PASSWORD` | A sandbox personal account that approves payments in the tests |

## Setup

### Run

```bash
npm install          # only TypeScript and Node's types, for checking
cp env.example .env  # PayPal and AI keys
npm run check        # tries each PayPal feature and the AI, and says what to fix
npm run dev          # http://localhost:4000, restarts on save
```

### Test

| Command | What it proves |
|---|---|
| `npm test` | The rules money depends on, Scout's rules, Safe's rules, businesses' names, webhooks routed to the right workspace, Web Push encryption against RFC 8291 |
| `npm run typecheck` | The types, with `tsc` |
| `npm run api` | Every route, used right and wrong, on the real sandbox and model |
| `npm run loop` | The whole money loop, through PayPal's real approval page in headless Chrome |

Each end-to-end script starts its own backend on a throwaway state folder, so your data is untouched.

### Deploy

```bash
railway up --service flick-backend --ci
```

Set the variables in Railway, never in the repo. The service keeps workspaces on a volume at
`/app/.data`. With `PAYPAL_WEBHOOK_ID` set, subscribe the sandbox app's webhook to
`https://<backend>/api/paypal/webhook`.

## Tech Stack

| Technology | Purpose |
|---|---|
| **Node 22.18+** | Runs TypeScript directly (type stripping), `node:http`, `node:test`, `fetch`, Web Crypto |
| **PayPal REST APIs** | Orders, Vault, Payouts, Invoicing, Payments, Webhooks, Reporting, Catalog and Billing, with plain `fetch` |
| **OpenRouter** | Any OpenAI-compatible API: vision with strict JSON, PDFs, tools, the Responses API |
| **Channel3** | Live online prices for Scout |
| **Frankfurter** | ECB exchange rates for bills in other currencies |
| **Railway** | Hosting, with a volume |

[Back to the main README](../README.md) · [Frontend](../frontend/) · [Partner evidence](../partner-docs/)
