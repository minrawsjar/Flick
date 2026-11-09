> [!TIP]
> **PayPal AI Hackathon**
> 
> Win part of $69,750 in total prizes
> 
> Build What's Next with PayPal and AI is a global online hackathon inviting developers, designers, founders, students, and builders to create something new using PayPal and AI.
> 
> There are no prescribed problem statements and no set of tracks. Build an agent, an app, an automation, a new payment experience, a business tool, a social product, or something we haven't thought of yet.
> 
> https://paypalaihackathon.devpost.com

# Flick

Snap anything you need to pay once: Flick pays it now, learns it, and runs your week's payments on autopilot with one PayPal approval every Sunday.

It has two parts so far:

- **The one-pager** (`/`): an animated, interactive tour. Phones show the app, and each section is a demo you can play with: Lens reading a bill, a receipt, a price tag or a tip jar and paying it; Autopilot's week in an editable [AG Grid](https://www.ag-grid.com/react-data-grid/); Splitter's who-had-what grid; Nudge drafting reminders. It runs on demo data for now.
- **Money Studio** (`/dashboard`): an [AG Studio](https://www.ag-grid.com/studio/) report over the PayPal sandbox data, read over the [PayPal REST API](https://developer.paypal.com/api/rest/) and joined together, which you can edit and save in the browser.

Built on the [PayPal + AG Grid hackathon starter](https://github.com/paypaldev/hackathon-paypal-ag-grid-boilerplate). The design language (bot faces, phone frame, colours and motion) is ported from [Air Agents](https://github.com/ahmedfahim21/Spatial-Agents) (MIT).

## Layout

```
backend/    Node API server: every PayPal call, the dashboard's data joins, the AI proxy. Holds all secrets.
frontend/   Next.js app: pages, AG Grid, AG Studio. Holds no secrets.
```

The browser only ever talks to the frontend. The frontend's server components call the backend at `BACKEND_URL`, and [`next.config.ts`](frontend/next.config.ts) rewrites the browser's `/api/*` requests to it, so there is no CORS. The frontend imports the backend's response types through the `@backend/*` path alias, as type-only imports, so no backend code is bundled into it.

## Run locally

Requires Node.js 22.18 or later (the backend runs its TypeScript directly, with no build step) and a PayPal sandbox REST app ([developer.paypal.com](https://developer.paypal.com/dashboard/applications/sandbox)) with these **Features** turned on: Accept payments, Payouts, Invoicing and Transaction search. For the AI parts, an [OpenRouter](https://openrouter.ai/keys) key (or any OpenAI-compatible one).

In one terminal:

```bash
cd backend
npm install
cp env.example .env   # then fill in the PayPal and AI keys
npm run check         # tries each PayPal feature and the AI, and says what to fix
npm run dev           # http://localhost:4000
```

In another:

```bash
cd frontend
npm install
cp env.example .env.local   # optional: BACKEND_URL, AG_STUDIO
npm run dev                 # http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000). Both env files are git-ignored, so credentials stay out of the repo.

Other scripts: `npm test` (the rules money depends on) and `npm run typecheck` in `backend/`; `npm run build`, `npm run start` and `npm run lint` in `frontend/`. `BACKEND_URL` is read at build time for the rewrite, so set it before `npm run build`.

### AG Studio licence (optional)

Set `AG_STUDIO` in `frontend/.env.local` to your AG Studio licence key. The dashboard passes it to `AgStudioProvider`.

### AI (optional)

Lens (reading photos), Nudge's drafts and the Money Studio assistant use one OpenAI-compatible API, set in `backend/.env`:

- `AI_API_KEY`: the key. Without it Lens and the assistant are off, and Nudge drafts from templates.
- `AI_BASE_URL`: OpenRouter (`https://openrouter.ai/api/v1`) unless set; for OpenAI use `https://api.openai.com/v1`.
- `AI_MODEL`: the model Lens and Nudge call (`google/gemini-2.5-flash` unless set). It must read images and support structured outputs. List fallbacks after it, comma-separated; on OpenRouter they take over when the first is rate-limited or down. In a bake-off on a bill, a receipt and a price tag, `google/gemini-2.5-flash-lite,openai/gpt-6-luna` read everything right for about $0.0002 a scan.
- `STUDIO_MODELS`: model ids the Money Studio assistant may use, comma-separated, the first the default (`AI_MODEL` unless set). With two or more, the chat offers a picker. The assistant streams from the provider's Responses API: OpenAI's, or OpenRouter's (in beta); `npm run check` tries it.

The key never reaches the browser. Studio's adapter ([`openai-adapter.ts`](frontend/app/dashboard/studio/openai-adapter.ts), copied from the AG Studio docs) runs client-side and posts to `/api/ai/responses`, which the frontend rewrites to the backend's [proxy](backend/src/ai-proxy.ts). That adds the key, only allows the configured models, caps output tokens, and streams the reply back.

In production, set the variables in your host's environment (e.g. Render's environment settings) instead of the env files, and set `FRONTEND_URL` to the frontend's public URL so PayPal sends people back to it. The API has no auth or rate limiting: it's a single-person demo on the sandbox, so don't point it at live PayPal credentials.

## How it works

```
backend/src/server.ts           The API's routes
backend/src/paypal.ts           Every PayPal call: OAuth, retries, orders, payouts, invoices, refunds
backend/src/rules.ts            Pure rules: planning the week, splitting a bill, checking Lens (tested)
backend/src/lens.ts             Lens: reads a photo with the AI model, pays what it read
backend/src/autopilot.ts        Autopilot: one approval for the week, a payout on each day
backend/src/split.ts            Splitter: a PayPal invoice for each friend's share
backend/src/nudge.ts            Nudge: drafts reminders and sends them through PayPal
backend/src/checkout.ts         The PayPal approval round trip all payments share
backend/src/store.ts            The JSON store; seed.ts is the demo's starting point
backend/src/ai.ts               The AI connection; ai-proxy.ts serves the dashboard's assistant
backend/src/dashboard-data.ts   PayPal and Flick data as the dashboard's related tables
backend/scripts/check.ts        `npm run check`: tests each sandbox feature and the AI
frontend/lib/api.ts             How the frontend calls the backend
frontend/app/page.tsx           The one-pager
frontend/app/_landing/          Its interactive sections, and their demo data
frontend/components/            Bot faces, the phone frame, UI pieces, the themed AG Grid
frontend/app/dashboard/         The AG Studio dashboard
```

[`paypal.ts`](backend/src/paypal.ts) calls the REST API with plain `fetch`, no SDK. It gets an OAuth access token with the client-credentials grant and caches it until just before it expires. It follows `page`/`total_pages` paging, and retries on 401, 429 and 5xx responses. Its types are hand-written for the fields this demo reads, in the API's own snake_case.

The dashboard is a server component that calls `await connection()`, so it renders per request with live data instead of being prerendered at build time. PayPal credentials never leave the backend.

## The backend

### How the money moves

The sandbox REST app's own account plays Flick. You approve payments on PayPal's page, with a sandbox personal account, and the money is captured into Flick's account. Flick then pays each biller or friend from it with a [Payout](https://developer.paypal.com/docs/api/payments.payouts-batch/v1/):

- **Lens** reads a photo (`POST /api/lens/read`) and says who to pay, how much and when. Paying it (`POST /api/lens/pay`) opens a PayPal checkout; once approved, Flick captures it and pays the biller the same day. Ask it to, and Autopilot learns the bill as a monthly payment.
- **Autopilot** plans the week from what it has seen: bills Lens read that fall due, monthly payments, and weekly habits (the same payee on the same weekday in 3 of the last 4 weeks). It only plans payees and amounts it has seen. You approve the whole week in one checkout (`POST /api/week/approve`), and each payment goes out as a payout on its day (`POST /api/week/tick` moves the demo's clock on a day). Skipping an approved payment refunds it from the capture.
- **Splitter** works out who owes what on a receipt (tax and tip follow each person's share, and you take the rounding so it adds up to the cent) and sends each friend a PayPal invoice (`POST /api/split`).
- **Nudge** drafts a reminder in the tone you pick and sends it as PayPal's own invoice reminder (`POST /api/nudge/send`). `POST /api/debts/refresh` asks PayPal which invoices have been paid.

Out-of-the-box payee and friend emails are placeholders: payouts to them succeed in the sandbox as "unclaimed". Put your sandbox accounts' emails in [`seed.ts`](backend/src/seed.ts) to see the money arrive.

### Routes

| Route | Does |
|---|---|
| `GET /api/state` | Everything Flick knows (the week, scans, requests, activity), and whether PayPal and AI are configured |
| `POST /api/reset` | Back to the demo's starting point |
| `POST /api/lens/read` `{ image }` | Reads a photo (a data URL) and returns what's on it |
| `POST /api/lens/pay` `{ scanId, amount?, repeat? }` | Starts paying a bill, product or tip (`amount` for tips); returns `approveUrl` |
| `POST /api/week/edit` `{ id, amount?, day?, skip? }` | Changes a payment before approval, or skips one (refunded if approved) |
| `POST /api/week/approve` | One checkout for the week; returns `approveUrl` |
| `POST /api/week/tick` | Moves the demo a day on and pays what's due |
| `POST /api/week/retry` | Retries payments that failed |
| `POST /api/week/next` | Closes the week (paid payments become history) and plans the next |
| `POST /api/split` `{ merchant, items: [{ name, price, people }], tax, tip }` | Splits a bill and invoices each friend |
| `POST /api/nudge/draft` `{ debtId, tone }` | A reminder in a `Friendly`, `Funny` or `Straight` tone |
| `POST /api/nudge/send` `{ debtId, text }` | Sends it through PayPal |
| `POST /api/debts/refresh` | Marks requests that have been paid |
| `GET /api/paypal/return`, `/cancel` | Where PayPal sends people back after a checkout |
| `GET /api/dashboard` | Money Studio's tables |
| `GET /api/ai/models`, `POST /api/ai/responses` | Money Studio's assistant |

Errors are JSON, `{ "error": { "message" } }`: 400 for bad input, 404 for an unknown id, 409 when the state doesn't allow it, 502 when PayPal or the AI model failed, 503 when a key isn't set.

### Keeping money safe

- Every write to PayPal carries a `PayPal-Request-Id`, so a retry or a reloaded return page can't charge, pay out or invoice twice; captures are also recorded, so an agent acts on each only once.
- Changes run one at a time, so two quick taps can't pay the same thing twice.
- What the AI model reads is checked before it can become money ([`rules.ts`](backend/src/rules.ts)): unreadable amounts become 0, and Flick won't pay those.
- State is a JSON file (`backend/.data/state.json`), written atomically after each change.

## The one-pager

[`app/page.tsx`](frontend/app/page.tsx) lays out the sections. Each lives in [`app/_landing`](frontend/app/_landing) and starts playing when it scrolls into view.

The page runs **live** when the backend answers and PayPal is configured ([`lib/live.ts`](frontend/lib/live.ts)), and says so under the hero. Then every demo is real:

- **Lens**: tapping a sample draws it into a photo and sends it to the vision model; *Snap your own* takes a photo (or a file). Paying opens PayPal's sandbox checkout (sign in with a sandbox personal account) and comes back to the page; a receipt is handed to Split.
- **Autopilot**: the backend's week. Edit it in the grid, approve it through PayPal, and each *Next day* pays out.
- **Split**: sends real sandbox invoices and links to them.
- **Nudge**: the real requests, a reminder drafted by the AI model, sent as PayPal's own reminder; *Check who's paid* asks PayPal.

Without the backend, the page plays the same demos on [`data.ts`](frontend/app/_landing/data.ts), so it never breaks.

Colours, type and motion are tokens in [`globals.css`](frontend/app/globals.css). The grids use [`components/grid.tsx`](frontend/components/grid.tsx), AG Grid themed as an iOS grouped list from the same tokens. Everything respects `prefers-reduced-motion`.

## PayPal endpoints

The dashboard reads these, all through [`paypal.ts`](backend/src/paypal.ts):

| Function | REST calls |
|---|---|
| `listProducts()` | `GET /v1/catalogs/products`, then `GET /v1/catalogs/products/{id}` per product |
| `listPlans()` | `GET /v1/billing/plans`, then `GET /v1/billing/plans/{id}` per plan |
| `listInvoices()` | `GET /v2/invoicing/invoices`, then `GET /v2/invoicing/invoices/{id}` per invoice |
| `searchTransactions(start, end)` | `GET /v1/reporting/transactions` |
| `getBalances()` | `GET /v1/reporting/balances` |

Things worth knowing about these endpoints:

- **List endpoints return summaries.** Products have no type or category, plans no billing cycles, and invoices no line items, payments or refunds. So each record is fetched again in full, which is why the dashboard takes a second or two to load.
- **Billing plans keep their price in `billing_cycles`.** There is an optional `TRIAL` cycle, then the `REGULAR` cycle; `total_cycles: 0` means it bills until cancelled.
- **Transaction Search covers at most 31 days per request** and rejects fractional seconds in dates. New activity can take up to three hours to appear. `fields=all` adds `payer_info` to each `transaction_info`. Event codes are [PayPal T-codes](https://developer.paypal.com/docs/transaction-search/transaction-event-codes/) (`T0001` = payout); status is `S` success, `P` pending, `D` denied, `V` reversed or `F` partially refunded.
- **Amounts are decimal strings with a currency**, e.g. `{ "value": "2.99", "currency_code": "USD" }`. `amountOf()` turns them into numbers.

## Money Studio

[`/dashboard`](frontend/app/dashboard/page.tsx) gets its data from the backend's `/api/dashboard`, which fetches all five endpoints at once. [`dashboard-data.ts`](backend/src/dashboard-data.ts) turns them into related tables: customers, invoices, invoice line items, invoice payments, products, plans, transactions, payouts and balances, plus Flick's own: this week's payments, past payments, money owed to you, and what each agent did. AG Studio's data sources, relationships, theme, default report and AI assistant are configured in [`app/dashboard/studio`](frontend/app/dashboard/studio). Reports you create or edit are saved in the browser's localStorage.
