# Utkarsh: Build track

Hi Utkarsh! You're on **Build**: the features that win **Best Use of AG Grid**, and fixing the bugs Manya finds. This file has everything you need; ask Swarnim for the keys.

## Flick in one minute

Flick is our PayPal AI Hackathon entry: **snap anything you need to pay, and Flick pays it**. Four AI agents do the work:

- **Lens** reads a photo of a bill, receipt, price tag or tip jar (vision model) and pays it through a PayPal checkout.
- **Autopilot** plans the week's payments from what it has seen, takes one PayPal approval, then pays each one on its day (PayPal Payouts).
- **Splitter** splits a receipt and sends each friend a PayPal invoice.
- **Nudge** writes reminders and sends them as PayPal invoice reminders.
- **Ask Flick** is an agent over all four: it reads your data, plans, and proposes actions you approve.
- **Money Studio** (`/dashboard`) is AG Studio over all of it.

| | |
|---|---|
| Live site | https://flick-frontend-woad.vercel.app |
| Backend (Railway) | https://flick-backend-production.up.railway.app/api/health |
| Repo | https://github.com/minrawsjar/Flick |
| How it all works | [`README.md`](../../README.md) (run locally, every API route) and [`PLAN.md`](../../PLAN.md) |
| Hackathon | https://paypalaihackathon.devpost.com |

## Who does what

| Who | Track | Hands you |
|---|---|---|
| **Utkarsh (you)** | Build: Money Studio widgets and agent, bug fixes | |
| Manya | Test & sandbox: accounts, end-to-end testing, bug list | Bugs, as GitHub issues |
| Umang | Story & submission: demo video, Devpost write-up | Needs your features finished by the freeze to record them |
| Swarnim | Reviews and merges PRs, deploys the backend | Keys for your `.env` files |

## Timeline (IST)

| When | What |
|---|---|
| **Tue 10 Nov** | Get it running locally. Read AG Studio's widget and AI docs. Start task 1. |
| **Wed 11 Nov** | Finish tasks 1 and 2. Fix P0 bugs as Manya files them. |
| **Thu 12 Nov, 14:00** | **Feature freeze.** After this, only bug fixes go into `main`. |
| **Thu 12 Nov, 23:30** | We submit (10:00 PST). Hard deadline: Fri 13 Nov, 01:30 IST (12:00 PST). |

## Ground rules

- **Work on a branch and open a PR.** Vercel builds a preview link for every PR; Swarnim merges into `main`, which deploys the live site. Don't push to `main` directly.
- **Never commit keys or passwords.** `.env` and `.env.local` are git-ignored; keep it that way.
- **Before every PR**, all four must pass:
  ```bash
  cd backend && npm test && npm run typecheck
  cd ../frontend && npm run lint && npm run build
  ```
- **The live backend is shared.** Don't `POST /api/reset` on Railway; it wipes everyone's demo data. Run your own backend locally instead.
- **AI calls cost credits** (cents each) and are capped at 300 an hour across everyone.

## Set up (30 minutes)

Requires Node.js 22.18 or later.

```bash
git clone https://github.com/minrawsjar/Flick.git && cd Flick

cd backend
npm install
cp env.example .env      # Swarnim sends you the values
npm run check            # every line should be ✓
npm run dev              # http://localhost:4000

cd ../frontend           # in a second terminal
npm install
cp env.example .env.local   # BACKEND_URL is fine empty; AG_STUDIO from Swarnim
npm run dev                 # http://localhost:3000
```

Your local backend keeps its own data in `backend/.data/state.json` (git-ignored), so you can't break the live demo. `POST localhost:4000/api/reset` puts it back to the starting data.

## Task 1: Two custom widgets in Money Studio (priority)

**Why:** the AG Grid prize asks for "polish: custom widgets, theming, layout". Theming and layout are done; custom widgets aren't.

Build two AG Studio **custom widget types** and put them on the **This week** page of the built-in report:

1. **Who owes you**: a scoreboard of friends, each with their bot face, the amount they still owe, and how many reminders have gone out. Data: the `flickRequests` source (`friend`, `outstanding`, `reminders`, `status`).
2. **Week timeline**: Monday to Sunday as seven columns, each payment a chip in its day, coloured by status (planned, scheduled, paid, skipped, failed). Data: the `flickPayments` source (`date`, `payee`, `amount`, `status`).

Where things are:

- AG Studio's custom widget API: `frontend/node_modules/ag-studio/dist/types/api/widgets/agCreateWidgetsParams.d.ts` (`additionalTypes`, `AgCustomWidgetDefinition`, `menu`). Pair it with the AG Studio docs on custom widgets at https://www.ag-grid.com/studio/.
- Where Studio is set up: [`frontend/app/dashboard/dashboard.tsx`](../../frontend/app/dashboard/dashboard.tsx) (the `<AgStudio>` props).
- The report's pages and widget layout: [`frontend/app/dashboard/studio/initial-report.ts`](../../frontend/app/dashboard/studio/initial-report.ts) (the `week` page; layout is a 24-column grid).
- The data sources and field ids: [`frontend/app/dashboard/studio/data.ts`](../../frontend/app/dashboard/studio/data.ts).
- Bot faces: `import { Bot } from "@/components/bot"`. Colours and dark mode come from the CSS variables in [`frontend/app/globals.css`](../../frontend/app/globals.css) (`var(--color-card)`, `var(--color-paid)`…), so use those, not hex values.

**Done when:**

- [ ] Both widgets appear on the This week page and in Studio's widget menu, so they can be added to any page.
- [ ] They respond to Studio's filters, and they update when the data changes.
- [ ] They look right in light and dark mode (the toggle is in the top bar).
- [ ] Reports are cached in the browser: open the dashboard in a private window, or use "Reset demo" in the sidebar, to see your new defaults.

## Task 2: A Flick agent inside Money Studio

**Why:** the AG Grid prize also mentions the **Studio Agent Framework**: "a custom agent talking to Studio's built-in agents". Today the Studio assistant is AG's default.

Add a **Flick** agent to Money Studio's AI chat that knows the household's money and delegates the dashboard work to AG's own agents. Ask it "Build my Sunday recap" and it should:

1. Read the week through a tool that calls our backend (`GET /api/state` from the browser; the `/api` path is rewritten to the backend).
2. Hand the layout and widget work to AG's lead agent (`builtIn.lead`), which adds the widgets to a page.

Where things are:

- Our harness today: [`frontend/app/dashboard/studio/ai.ts`](../../frontend/app/dashboard/studio/ai.ts) (`createAiHarness(api, { adapter, … })`).
- How to build your own: `node_modules/ag-studio/dist/types/studio/ai/createAiHarness.d.ts`. Pass a *builder* instead of defaults; it receives the tools, the Studio tools and AG's agents as `builtIn`, so `builtIn.lead` can be extended.
- AG's five agents (a lead plus data, layout, planning and widget specialists): `…/studio/ai/defaultAgents/defaultAgents.d.ts`.
- Custom tools: `…/studio/ai/defineAiTool.d.ts`.
- The model and the key: the browser talks to `/api/ai/responses`, which our backend proxies ([`backend/src/ai-proxy.ts`](../../backend/src/ai-proxy.ts)). You don't need any keys in the frontend.

Keep its tools **read-only**: paying and messaging people stay in Ask Flick (`/ask`), where every action needs approval.

**Done when:**

- [ ] "Build my Sunday recap" in Money Studio's chat produces a page of widgets about this week: what was paid, what's left, and who owes what.
- [ ] Asking "Why is City Power on Wednesday?" gets Autopilot's reason (from `flickPayments.reason`).
- [ ] The chat still works for ordinary dashboard requests ("add a chart of past payments by payee").

## Task 3: Bugs

Manya files bugs as **GitHub issues** labelled `P0` (breaks the demo), `P1` or `P2`. **P0s come before tasks 1 and 2.** Comment on an issue when you start it, and link your PR.

## If you have time after the freeze

Don't start anything new after 14:00 Thursday. Before then, if 1 to 3 are done:

- Lens: show the photo you snapped next to the result on `/lens` after a reload (it's dropped today).
- `/ask`: put the "Approve on PayPal" link inside the approval card.

## Help

Swarnim built most of this and knows where everything is. Most answers are in the README's "How it works" and "The backend" sections.
