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

- **The one-pager** (`/`): an animated, interactive tour (a mock demo; the navbar leads to the working pages, below). Phones show the app, and each section is a demo you can play with: Lens reading a bill, a receipt, a price tag or a tip jar and paying it; Autopilot's week in an editable [AG Grid](https://www.ag-grid.com/react-data-grid/); Splitter's who-had-what grid; Nudge drafting reminders. It runs on demo data for now.
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

In production, set the variables in your host's environment (e.g. Render's environment settings) instead of the env files, and set `FRONTEND_URL` to the frontend's public URL so PayPal sends people back to it. The API has no auth or rate limiting: it's a demo on the sandbox, so don't point it at live PayPal credentials.

### Everyone gets their own Flick

Every browser gets its own workspace, with no sign-up: [`proxy.ts`](frontend/proxy.ts) gives it a random id in a cookie on its first visit, the `/api/*` rewrite and Money Studio pass it on, and the backend keeps each workspace in its own file ([`store.ts`](backend/src/store.ts)). A workspace starts empty, and what you snap, add, plan and pay is yours alone, as is your Money Studio.

Until you have something of your own, each page shows a sample as a walkthrough: the sample photos in Lens, the sample week in Autopilot, sample friends in Splitter, sample requests in Nudge, a sample shop and list in Scout, and sample data in Money Studio. Their buttons play the flow out and never reach PayPal. Your own things go through the agents and PayPal's sandbox: snap a bill (one due this week also lands in Autopilot's plan), add friends by their PayPal email and split with them, snap a shopping list for Scout.

Without the cookie (the test scripts, curl) requests use the `local` workspace, the old single state file, which starts from the demo seed.

### Sign in with PayPal

`/login` signs you in with a PayPal sandbox account, so your Flick is yours on every device ([`account.ts`](backend/src/account.ts)). There's no password of Flick's own: one approval on PayPal's page saves your PayPal with Flick (PayPal's vault, without a purchase: `POST /v3/vault/setup-tokens`, then `POST /v3/vault/payment-tokens`), and that payment token tells Flick whose account it is. Your workspace's id is keyed from your PayPal account with the server's secret (`SESSION_SECRET`, or else `PAYPAL_SECRET`), so signing in anywhere opens the same one; the first time, what you did as a guest in that browser moves in with you. `/profile` shows who you're signed in as and what's in your Flick, lets you change the name Flick calls you (it starts as PayPal's, and the sandbox names everyone John Doe), and signs you out, which leaves it all kept. Signing in is optional: a guest can do everything, approving each payment on PayPal's page.

### Flick to pay

Every payment asks for one finger flicked up in front of the phone's front camera ([`flick-confirm.tsx`](frontend/components/flick-confirm.tsx)). The browser compares tiny 64×48 frames about 30 times a second and looks for a quick, mostly upward movement ([`lib/flick.ts`](frontend/lib/flick.ts), tested with `npm test` in `frontend/`). The camera is read, never shown, and frames never leave the device. Signed in, the flick pays there and then from your saved PayPal (`POST /api/paypal/flick`), with no PayPal page; as a guest it opens PayPal's page to approve. With no camera, or no permission, a tap does it instead; "Not now" cancels the PayPal checkout, as cancelling on PayPal's page would.

## How it works

```
backend/src/server.ts           The API's routes
backend/src/paypal.ts           Every PayPal call: OAuth, retries, orders, payouts, invoices, refunds
backend/src/rules.ts            Pure rules: planning the week, splitting a bill, checking Lens (tested)
backend/src/lens.ts             Lens: reads a photo with the AI model, pays what it read
backend/src/autopilot.ts        Autopilot: one approval for the week, a payout on each day
backend/src/split.ts            Splitter: a PayPal invoice for each friend's share
backend/src/nudge.ts            Nudge: drafts reminders and sends them through PayPal
backend/src/scout.ts            Scout: your usuals, priced everywhere, bought through PayPal; scout-rules.ts is its tested rules
backend/src/checkout.ts         The PayPal approval round trip all payments share
backend/src/store.ts            A JSON workspace per browser; seed.ts has the empty start and the demo seed
backend/src/ai.ts               The AI connection; ai-proxy.ts serves the dashboard's assistant
backend/src/dashboard-data.ts   PayPal and Flick data as the dashboard's related tables
backend/src/inbox.ts            What needs the person next, across the agents; push.ts sends it as notifications
backend/scripts/check.ts        `npm run check`: tests each sandbox feature and the AI
backend/scripts/loop.ts         `npm run loop`: the whole money loop on the sandbox, PayPal's approval page included
frontend/lib/api.ts             How the frontend calls the backend
frontend/app/page.tsx           The one-pager
frontend/app/_landing/          Its interactive sections, and their demo data
frontend/app/(app)/             The working pages (Today, Ask Flick, Lens, Autopilot, Split, Nudge, Friends, Get the app)
frontend/app/manifest.ts        The installed app: icons (pwa-icon/), shortcuts, share target
frontend/public/sw.js           Its service worker: opening offline, photos shared to Flick
frontend/components/pwa.tsx     Registering it, and how each browser installs it
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

Out-of-the-box payee and friend emails are placeholders: payouts to them succeed in the sandbox as "unclaimed". Change friends' emails to your sandbox personal accounts on `/friends` (or in [`seed.ts`](backend/src/seed.ts)) to see the invoices and money arrive.

### Routes

| Route | Does |
|---|---|
| `GET /api/state` | Everything Flick knows (the week, scans, requests, activity), and whether PayPal and AI are configured |
| `POST /api/reset` | Your workspace back to empty (the demo seed for `local`) |
| `POST /api/lens/read` `{ image }` | Reads a photo (a data URL) and returns what's on it |
| `POST /api/lens/pay` `{ scanId, amount?, repeat? }` | Starts paying a bill, product or tip (`amount` for tips); returns `approveUrl` |
| `POST /api/week/edit` `{ id, amount?, day?, skip? }` | Changes a payment before approval, or skips one (refunded if approved) |
| `POST /api/week/approve` `{ save? }` | One checkout for the week; returns `approveUrl`. `save`: also save PayPal so Autopilot pays later weeks by itself. With PayPal saved, it pays at once (`approveUrl` is null) |
| `POST /api/week/tick` | Moves the demo a day on and pays what's due |
| `POST /api/week/retry` | Retries payments that failed |
| `POST /api/week/next` | Closes the week (paid payments become history) and plans the next; with PayPal saved, pays it too, within the cap |
| `POST /api/autopay/cap` `{ cap }` | The most Autopilot pays in a week by itself |
| `POST /api/autopay/stop` | Stops it, and deletes the saved PayPal at PayPal |
| `POST /api/friends/add` `{ name, email }` | Adds a friend by their PayPal email (they become a payee too) |
| `POST /api/friends/update` `{ id, email?, name? }` | Changes a friend's PayPal email or name |
| `POST /api/friends/remove` `{ id }` | Removes a friend who owes nothing |
| `POST /api/split` `{ merchant, items: [{ name, price, people }], tax, tip }` | Splits a bill and invoices each friend |
| `POST /api/split/assign` `{ items, people, text }` | Who had what, from a sentence (AI) |
| `GET /api/inbox` | What needs the person, across the agents, each with its action; and what Flick did this month |
| `POST /api/inbox/act` `{ id }` | Does an inbox item's action (opens PayPal where money moves) |
| `GET /api/push/key`, `POST /api/push/subscribe` `{ subscription }`, `/unsubscribe` `{ endpoint }` | Notifications for the installed app |
| `POST /api/agent` `{ messages }` | Ask Flick: the agent reads, plans and replies, or proposes actions (`pending`) |
| `POST /api/agent/decide` `{ messages, decisions }` | Runs the approved actions, then the agent carries on |
| `POST /api/nudge/draft` `{ debtId, tone }` | A reminder in a `Friendly`, `Funny` or `Straight` tone |
| `POST /api/nudge/send` `{ debtId, text }` | Sends it through PayPal |
| `POST /api/debts/refresh` | Marks requests that have been paid |
| `GET /api/scout` | Scout: every product priced at every store this week, with its 12-week trend; your usuals; the next shop quoted everywhere |
| `POST /api/scout/quote` `{ items: [{ productId, qty }] }` | A basket priced at every store, delivery included |
| `POST /api/scout/read` `{ image }` | Every product in a photo of a shelf, fridge, cart or list (AI), priced |
| `POST /api/scout/online` `{ productId }` or `{ query }` | Live prices at online stores, from Channel3 |
| `POST /api/scout/buy` `{ storeId, items }` | One checkout for a basket at a store; returns `approveUrl` |
| `GET /api/paypal/return`, `/cancel` | Where PayPal sends people back after a checkout |
| `POST /api/paypal/flick` `{ orderId }` | Signed in: pays a checkout from the saved PayPal, on a flick, with no PayPal page; returns the page to show |
| `GET /api/auth/paypal/start?next=` | Signing in: PayPal's page to save PayPal with Flick; PayPal comes back to `/api/auth/paypal/return` (or `/cancel`) |
| `POST /api/profile` `{ name }` | Signed in: the name Flick calls you (signing in again keeps it) |
| `POST /api/auth/signout` | Ends this browser's session; its next visit is a new guest |
| `GET /api/dashboard` | Money Studio's tables |
| `GET /api/ai/models`, `POST /api/ai/responses` | Money Studio's assistant |

Errors are JSON, `{ "error": { "message" } }`: 400 for bad input, 402 when PayPal turned down a payment from a saved PayPal, 404 for an unknown id, 409 when the state doesn't allow it, 502 when PayPal or the AI model failed, 503 when a key isn't set.

### Autopilot that pays by itself

Approving a week with **Save PayPal** asks PayPal to keep the person's account for Flick (PayPal's vault: `payment_source.paypal.attributes.vault`, `store_in_vault: ON_SUCCESS`, `usage_type: MERCHANT`). The capture returns a payment token, which Flick keeps. From then on, `POST /api/week/next` plans the week and pays it with that token, as a merchant-initiated payment (`vault_id`, `stored_credential.payment_initiator: MERCHANT`): no approval page. A week over the cap ($200 to start) waits for approval as before, and so does any week PayPal refuses. Stopping deletes the token at PayPal (`DELETE /v3/vault/payment-tokens/{id}`). In the sandbox app, tick **Save payment methods** (Vault) under Features.

### The inbox and notifications

[`inbox.ts`](backend/src/inbox.ts) turns the state into what needs the person next, each with the one action that does it: approve the week (or pay it, with PayPal saved), retry a failed payment, pay a bill Lens read, remind a friend who has owed for a week, buy the usuals where Scout found them cheapest, stock up before a price rises. Today lists them; the first tap asks to be sure, the second does it, and money still goes through PayPal. It also says what Flick did this month: saved on groceries, paid back by friends, paid out, photos read.

[`push.ts`](backend/src/push.ts) sends each new item as a notification to the installed app, with Web Push and no library: VAPID-signed requests (RFC 8292), each message encrypted for its browser (RFC 8291, checked against the RFC's own example in `push.test.ts`). It only posts to the browsers' push services. On iPhone, notifications need Flick on the home screen.

### Testing it all

Four levels, each runnable on its own, with your keys in `backend/.env`. Each end-to-end script starts its own backend on a throwaway state file, so your data is untouched.

| Command | Where | What it proves |
|---|---|---|
| `npm test` | `backend/` | The rules money depends on, Scout's, and Web Push encryption against RFC 8291 |
| `npm run check` | `backend/` | Each PayPal sandbox feature and the AI are switched on |
| `npm run api` | `backend/` | Every route, used right and wrong: status codes, messages, validation, server-side prices, concurrent writes, real sandbox orders, invoices and reminders, AI answers |
| `npm run e2e` | `frontend/` | The built site in headless Chrome: every page on phone (light, dark) and desktop with no console errors, failed requests or sideways scroll; then the tab bar, theme, inbox, Lens, Autopilot, Scout, Splitter, Nudge, Friends, Ask Flick, install page and Money Studio, clicked through; and paying a bill on PayPal's page when the buyer login is set |
| `npm run loop` | `backend/` | The whole money loop, below |

`npm run loop` starts its own backend on a throwaway state file and walks every flow on the sandbox: Lens reads and pays a bill; Autopilot's week is approved with PayPal saved, paid out day by day, and the next week pays itself; Scout buys the usuals; Splitter invoices and Nudge reminds; the inbox acts; Ask Flick buys groceries after approval; Autopilot stops and forgets PayPal. Wherever money moves, it drives a headless Chrome through PayPal's real approval page as a sandbox personal account (`SANDBOX_BUYER_EMAIL`, `SANDBOX_BUYER_PASSWORD` in `backend/.env`).

### Keeping money safe

- Every write to PayPal carries a `PayPal-Request-Id`, so a retry or a reloaded return page can't charge, pay out or invoice twice; captures are also recorded, so an agent acts on each only once.
- Changes run one at a time, so two quick taps can't pay the same thing twice.
- What the AI model reads is checked before it can become money ([`rules.ts`](backend/src/rules.ts)): unreadable amounts become 0, and Flick won't pay those.
- State is a JSON file (`backend/.data/state.json`), written atomically after each change.

## The one-pager

[`app/page.tsx`](frontend/app/page.tsx) lays out the sections. Each lives in [`app/_landing`](frontend/app/_landing) and starts playing when it scrolls into view.

The one-pager is a **mock demo** of what Flick can do: its sections always play on demo data. The navbar leads to the **working pages**, one per agent, which run on the live backend ([`lib/live.ts`](frontend/lib/live.ts)):

- **`/home`** (Today): where the installed app opens. Where the week stands (paid so far, what's next, whether it needs your OK), who owes you, a way into each agent, and what the agents did lately. *Download statement* saves everything Flick has paid or asked for as a CSV.
- **`/ask`** (Ask Flick): one conversation that reaches every agent (and Scout: "get my usual groceries, cheapest"). The AI model reads your real data through tools (the week, scans with receipt items, friends, who owes what, usual amounts per payee), plans, and proposes actions: pay a scan, approve or change the week, split a bill, remind a friend, add a friend. Reads run on their own; **every action waits for your approval** before it runs, and checkouts are approved again on PayPal's page ([`agent.ts`](backend/src/agent.ts)).
- **`/lens`**: tapping a sample draws it into a photo and sends it to the vision model; *Snap your own* takes a photo (or a file). Paying opens PayPal's sandbox checkout (sign in with a sandbox personal account) and comes back to the page; a receipt goes to `/split`.
- **`/autopilot`**: the backend's week. Edit it in the grid, approve it through PayPal, and each *Next day* pays out.
- **`/scout`** (Scout): what you buy again and again, priced at every store this week, and bought with one PayPal approval. See [Scout](#scout) below.
- **`/split`**: sends real sandbox invoices and links to them. *Tick it for me* takes a sentence ("Maya and I shared the salmon, we all had tea") and the AI model ticks the grid.
- **`/nudge`**: the real requests, a reminder drafted by the AI model, sent as PayPal's own reminder; *Check who's paid* asks PayPal.
- **`/friends`**: the people you split with, each linked by their PayPal email (PayPal has no public API to confirm whose account an email is, so the email is the link). Add, change or remove them; Split's columns follow.
- **`/install`** (Get the app): installs Flick to a phone's home screen or a computer's dock, in whichever way the browser does it (one tap in Chrome, Edge and Android; the steps in Safari), with a QR code to open it on a phone from a computer.
- **`/dashboard`**: Money Studio.

If the backend can't be reached, the working pages say so and play the demo instead.

### Scout

Scout ([`scout.ts`](backend/src/scout.ts), rules in [`scout-rules.ts`](backend/src/scout-rules.ts), tested):

- **Learns your usuals** from what you've bought: Scout's history, plus every receipt Lens reads (each line matched to a product). Bought at least 3 times in 8 weeks at a steady pace makes a usual: "cornflakes every Sunday", "milk twice a week", "coffee every other Sunday". Chocolate twice isn't one.
- **Prices them everywhere** each week: three stores nearby (with distance) and two online (with delivery, free over a threshold), against what you pay now. The next shop (every usual due in the next two days) is quoted at every store; Corner Grocery's $45.13 is $37.33 at ValueBasket.
- **Sees prices coming**: a line through the log of each product's last 12 weeks of prices, carried 4 weeks on. Rising 3% or more on a good fit is "rising"; if it keeps (not perishable), Scout buys two. A trend, not a promise.
- **Reads a photo** of a shelf, a fridge, a cart or a shopping list: the AI model lists every product, how many, and any shelf price ("Here $9.49: $2.20 less at BulkBox"); Scout matches them to its catalog and prices the lot.
- **Buys it** through PayPal: one checkout for the basket, priced by the backend (never the browser), captured into Flick's account, then a payout to the store. What you bought becomes history.
- **Real online prices** from [Channel3](https://channel3.ai)'s product search (`CHANNEL3_API_KEY`): live offers at online stores, cheapest first, with links. Those you buy on the store's own site.

The stores are **sandbox stores**, like PayPal's sandbox accounts: their shelf prices are generated each week from each product's real-world trend (eggs and coffee climbing, olive oil easing), how each store prices, noise and the odd promotion, so the demo has history to learn from. Channel3's prices are real.

### On a phone, and as an app

Below laptop width the working pages have a tab bar at the bottom (Today, Lens, Week, People, Ask; People switches between Split, Nudge and Friends). On a phone each agent's screen fills the width instead of being drawn inside a phone ([`globals.css`](frontend/app/globals.css), the `data-app` rules). The bars respect the notch and home indicator.

Installed (it's a PWA: [`manifest.ts`](frontend/app/manifest.ts)), Flick opens full screen on Today, and:

- **opens offline**: [`sw.js`](frontend/public/sw.js) serves pages and the last `GET /api/state` from its cache when the network is gone, and the pages say they're showing what Flick last knew. Nothing else under `/api` is cached or replayed, so no payment can happen twice.
- **takes shared photos** (Android): share a photo from any app to Flick, and Lens reads it on `/lens`, ready to pay.
- **has shortcuts**: long-press the icon for Snap a bill, This week, Ask Flick or Get paid back.
- **badges its icon** with what needs you: the week waiting for approval, and any payment that failed.
- **catches up** whenever you come back to it (from PayPal's page, or another app).

The service worker only runs in production builds (`npm run build && npm start`): in `npm run dev` it would cache files you're editing. To try installing on a phone, the site needs HTTPS: use the deployed site, or a tunnel to port 3000.

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
