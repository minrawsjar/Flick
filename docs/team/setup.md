# Setting up Flick on your machine

Everyone on the team runs Flick **locally, with their own PayPal sandbox and their own AI key**. Don't use the live site to test, and don't use anyone else's keys: the live site runs on Swarnim's PayPal account.

Budget about 45 minutes. Everything here is free except the AI key (about $5 of credit lasts the hackathon).

## 1. Your own PayPal sandbox (20 min)

1. **Sign up** at https://developer.paypal.com with your own PayPal login (create a personal PayPal account first if you don't have one). Switch the toggle at the top left to **Sandbox**.
2. **Testing Tools → Sandbox Accounts → Create account**, and make:
   - one **Business** account, country **United States**: this plays "Flick", the account money flows through. It must be the US: sandbox accounts in India can't send Payouts, and Flick pays billers with Payouts.
   - one **Personal** account, **United States**: this is **"You"**, who approves payments on PayPal's page.
   - two or three more **Personal**, **United States**: your test friends (Maya, Leo, Priya…).

   For each, **⋮ → View/edit account** shows its email and password.
3. **Apps & Credentials → Create App**: type **Merchant**. In **Sandbox Account**, pick your **US business** account's email (not the default one, which is in your own country). Open the app, and check that **Sandbox Region** says **US**.
4. In the app's **Features**, tick **Payouts**, **Invoicing** and **Transaction search** as well as what's already ticked, and **Save Changes**.
5. Keep the app's **Client ID** and **Secret** (the eye icon shows it) for step 3.

## 2. Your own AI key (5 min)

Flick's AI (Lens, Nudge, Ask Flick, Money Studio's assistant) uses any OpenAI-compatible API. The simplest is OpenRouter: sign up at https://openrouter.ai, add about $5 of credit, create a key at https://openrouter.ai/keys, and set a spending limit on it.

Some tasks don't need AI at all; your brief says so. Without a key, Flick still runs, and the AI parts say they're off.

## 3. Run it (15 min)

Requires **Node.js 22.18 or later** (`node -v`).

```bash
git clone https://github.com/minrawsjar/Flick.git && cd Flick

# The backend: an API on http://localhost:4000
cd backend
npm install
cp env.example .env
```

Fill in `backend/.env`:

```
PAYPAL_CLIENT_ID=<your app's Client ID>
PAYPAL_SECRET=<your app's Secret>
AI_API_KEY=<your OpenRouter key, or leave empty>
AI_MODEL=google/gemini-2.5-flash-lite,openai/gpt-6-luna
STUDIO_MODELS=openai/gpt-6-luna,openai/gpt-5.4-mini
```

```bash
npm run check   # tries each PayPal feature and the AI; every line should be ✓
npm test        # the rules Flick's money depends on
npm run dev     # leave this running
```

`npm run check` tells you exactly what to switch on if a line fails. Transaction search can take a few hours to start working on a new app; everything else works straight away.

In a second terminal:

```bash
# The frontend: the site on http://localhost:3000
cd frontend
npm install
cp env.example .env.local   # leave both values empty
npm run dev
```

Open http://localhost:3000. Money Studio (`/dashboard`) shows an "AG Studio trial" watermark without a licence; that's fine for development.

### Your test data

Your backend keeps its own data in `backend/.data/state.json` (git-ignored), seeded with a demo week, friends and requests. To start over: `curl -X POST localhost:4000/api/reset`. On `/friends`, change the friends' emails to your sandbox personal accounts, so invoices and payouts land somewhere you can see (log in at https://www.sandbox.paypal.com as each account).

## 4. How we work

- **Branches and pull requests.** Branch from `main` (`git checkout -b yourname/what`), push, and open a PR. Swarnim reviews and merges. Don't push to `main`.
- **Before every PR**, all of these pass:
  ```bash
  cd backend && npm test && npm run typecheck
  cd ../frontend && npm run lint && npm run build
  ```
- **Never commit keys or passwords.** `.env` files are git-ignored; keep them that way. No logins in issues or PR descriptions either.
- **Stay in your area** (your brief lists your files), so three people don't edit the same lines. If you must change someone else's file, tell them first.
- **Commit as you go**, with messages that say what changed and why.
- **Bugs you find** outside your area: open a GitHub issue (steps, expected, what happened, screenshot) and tell the owner.

## Timeline (IST)

| When | What |
|---|---|
| **Tue 10 Nov** | Setup (this file). Read your area's code. Start your first task. |
| **Wed 11 Nov** | Build. First PRs in by the evening. |
| **Thu 12 Nov, 14:00** | **Feature freeze**: only bug fixes merge after this. |
| **Thu 12 Nov, 23:30** | Submission (10:00 PST). Hard deadline: Fri 13 Nov, 01:30 IST. |

## Where to read first

- [`README.md`](../../README.md): how everything fits together, and every API route.
- [`PLAN.md`](../../PLAN.md): the plan and decisions so far.
- The one-pager (`/`) is an animated demo; the navbar pages (Ask Flick, Lens, Autopilot, Split, Nudge, Friends, Money Studio) are the working app.
