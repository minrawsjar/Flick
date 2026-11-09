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

Built on the PayPal + AG Grid hackathon starter, which reads PayPal sandbox data over the [PayPal REST API](https://developer.paypal.com/api/rest/) and shows it two ways:

- **Endpoint pages**: one [AG Grid](https://www.ag-grid.com/react-data-grid/) per PayPal endpoint the demo calls, showing what each returns.
- **Dashboard** (`/dashboard`): an [AG Studio](https://www.ag-grid.com/studio/) report over all of that data, joined together, which you can edit and save in the browser.

## Layout

```
backend/    Node API server: every PayPal call, the dashboard's data joins, the AI proxy. Holds all secrets.
frontend/   Next.js app: pages, AG Grid, AG Studio. Holds no secrets.
```

The browser only ever talks to the frontend. The frontend's server components call the backend at `BACKEND_URL`, and [`next.config.ts`](frontend/next.config.ts) rewrites the browser's `/api/*` requests to it, so there is no CORS. The frontend imports the backend's response types through the `@backend/*` path alias, as type-only imports, so no backend code is bundled into it.

## Run locally

Requires Node.js 22.18 or later (the backend runs its TypeScript directly, with no build step) and a PayPal sandbox REST app ([developer.paypal.com](https://developer.paypal.com/dashboard/applications/sandbox)). The transactions and balances pages also need the app's **Transaction search** feature enabled.

In one terminal:

```bash
cd backend
npm install
cp env.example .env   # then fill in the PayPal credentials
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

Other scripts: `npm run typecheck` in `backend/`; `npm run build`, `npm run start` and `npm run lint` in `frontend/`. `BACKEND_URL` is read at build time for the rewrite, so set it before `npm run build`.

### AG Studio licence (optional)

Set `AG_STUDIO` in `frontend/.env.local` to your AG Studio licence key. The dashboard passes it to `AgStudioProvider`.

### AI assistant (optional)

The AG Studio dashboard at `/dashboard` has an AI assistant backed by OpenAI. The backend takes the key from the first of these that is set; with neither, the assistant is hidden:

1. `AG_STUDIO_OPENAI_API_KEY`, specific to this app. Put it in `backend/.env` to choose the key for this demo.
2. `OPENAI_API_KEY`, the name OpenAI's own tools use. If you already export one (e.g. in `~/.zshrc`), the demo uses it with no setup, and spends against it.

A separate name is needed because Node's `--env-file` never overrides a variable already in the environment, so a globally exported `OPENAI_API_KEY` can't be overridden per project. The backend logs which variable it used (never the key) the first time the assistant is configured.

`OPENAI_MODELS` lists the model ids the assistant may use, comma-separated, first one the default (`gpt-5.4-mini` when unset); with two or more, the chat offers a model picker.

The key never reaches the browser. Studio's adapter ([`openai-adapter.ts`](frontend/app/dashboard/studio/openai-adapter.ts), copied from the AG Studio docs) runs client-side and posts to `/api/ai/responses`, which the frontend rewrites to the backend's [proxy](backend/src/ai-proxy.ts). That adds the key, only allows the configured models, caps output tokens, and streams OpenAI's reply back.

In production, set the variables in your host's environment (e.g. Render's environment settings) instead of the env files. The proxy has no auth or rate limiting, so don't deploy it publicly with a real key without adding one.

## How it works

```
backend/src/server.ts           The API's routes
backend/src/paypal.ts           Every PayPal call: OAuth token, paging, retries, response types
backend/src/dashboard-data.ts   Turns those responses into the dashboard's related tables
backend/src/ai-proxy.ts         Proxy for the dashboard's AI assistant
frontend/lib/api.ts             How the frontend calls the backend
frontend/app/(endpoints)/       One page per endpoint, each rendering an AG Grid
frontend/app/dashboard/         The AG Studio dashboard
```

[`paypal.ts`](backend/src/paypal.ts) calls the REST API with plain `fetch`, no SDK. It gets an OAuth access token with the client-credentials grant and caches it until just before it expires. It follows `page`/`total_pages` paging, and retries on 401, 429 and 5xx responses. Its types are hand-written for the fields this demo reads, in the API's own snake_case.

Every page is a server component that calls `await connection()`, so it renders per request with live data instead of being prerendered at build time. PayPal credentials never leave the backend.

## Endpoint pages

Each page in [`app/(endpoints)`](frontend/app/(endpoints)) fetches one backend route, which calls one function in `paypal.ts`; the page maps the response to flat rows and passes them with plain column definitions to the shared [`DataGrid`](frontend/app/(endpoints)/data-grid.tsx). The page header shows the REST calls behind it.

| Page | `paypal.ts` function | REST calls |
|---|---|---|
| [`/products`](frontend/app/(endpoints)/products/page.tsx) | `listProducts()` | `GET /v1/catalogs/products`, then `GET /v1/catalogs/products/{id}` per product |
| [`/plans`](frontend/app/(endpoints)/plans/page.tsx) | `listPlans()` | `GET /v1/billing/plans`, then `GET /v1/billing/plans/{id}` per plan |
| [`/invoices`](frontend/app/(endpoints)/invoices/page.tsx) | `listInvoices()` | `GET /v2/invoicing/invoices`, then `GET /v2/invoicing/invoices/{id}` per invoice |
| [`/transactions`](frontend/app/(endpoints)/transactions/page.tsx) | `searchTransactions(start, end)` | `GET /v1/reporting/transactions` |
| [`/balances`](frontend/app/(endpoints)/balances/page.tsx) | `getBalances()` | `GET /v1/reporting/balances` |

Things worth knowing about these endpoints:

- **List endpoints return summaries.** Products have no type or category, plans no billing cycles, and invoices no line items, payments or refunds. So each record is fetched again in full, which is why these pages take a second or two.
- **Billing plans keep their price in `billing_cycles`.** There is an optional `TRIAL` cycle, then the `REGULAR` cycle; `total_cycles: 0` means it bills until cancelled.
- **Transaction Search covers at most 31 days per request** and rejects fractional seconds in dates. New activity can take up to three hours to appear. `fields=all` adds `payer_info` to each `transaction_info`. Event codes are [PayPal T-codes](https://developer.paypal.com/docs/transaction-search/transaction-event-codes/) (`T0001` = payout); status is `S` success, `P` pending, `D` denied, `V` reversed or `F` partially refunded.
- **Amounts are decimal strings with a currency**, e.g. `{ "value": "2.99", "currency_code": "USD" }`. `amountOf()` turns them into numbers, and the grid formats money columns in each row's currency.

### The grid

Pages are server components, so the column definitions they pass to the grid must be plain data, with no functions. Money columns use the `type: 'money'` column type, defined in `data-grid.tsx`, which formats the value in the row's `currency`. Date columns use AG Grid's built-in `cellDataType: 'dateString'` or `'dateTimeString'`. Every column can be sorted and filtered, and the search box filters across all columns.

## Dashboard

[`/dashboard`](frontend/app/dashboard/page.tsx) gets its data from the backend's `/api/dashboard`, which fetches all five endpoints at once. [`dashboard-data.ts`](backend/src/dashboard-data.ts) turns them into related tables: customers, invoices, invoice line items, invoice payments, products, plans, transactions, payouts and balances. AG Studio's data sources, relationships, theme, default report and AI assistant are configured in [`app/dashboard/studio`](frontend/app/dashboard/studio). Reports you create or edit are saved in the browser's localStorage.
