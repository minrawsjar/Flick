# Flick — PayPal AI Hackathon build plan (frontend first, Air Agents theme)

## Context
- Hackathon https://paypalaihackathon.devpost.com/ — must meaningfully use PayPal (sandbox) + AI. **Deadline Nov 12, 2026 12:00pm PST** (today Nov 9 → ~2.5 days). Submit: hosted demo URL, public repo + LICENSE, <3 min YouTube video, tools write-up.
- Judging: Tech implementation · Design · Impact · Innovation · Presentation. Targets: Grand / Most Creative / Best Demo / Agentic Commerce + **Best Use of AG Grid** (wants polish: custom widgets, theming, layout + Studio Agent Framework: "custom agent talking to Studio's built-in agents").
- User + Claude build together. User's instruction: **start with the frontend, follow the theme of https://github.com/ahmedfahim21/Spatial-Agents** (Air Agents, MIT).

## The idea
"Flick" = working name for idea A (snap-to-pay) + B (weekly autopilot). Rename anytime.
**Snap anything you need to pay once — Flick pays it now, learns it, and runs your week's payments on autopilot with one PayPal approval every Sunday. Money Studio (AG Studio) is the household money HQ where an AI agent builds your dashboards.**

## Frontend & theme (built first)
**Web app, not SwiftUI**: AG Grid/AG Studio are web-only and judges need a hosted URL. Air Agents already ships a web port of its iOS design (`web/`), which drops straight into the AG boilerplate (both Tailwind v4 + React 19).

Port from Spatial-Agents (MIT, credit in README):
- `web/src/index.css` `@theme` tokens → `app/globals.css`: ink `#000` accent, grouped `#f5f5f7`, white cards radius 16, SF font stack, `--ease-spring`, `.pressable`, `.rise`, `.spinner`, reduced-motion rules.
- `web/src/Bot.tsx` → `components/Bot.tsx` (verbatim). "Colour belongs to the agents": **Lens** (cyan circle), **Autopilot** (green drop), **Splitter** (yellow squircle), **Nudge** (pink capsule); each friend gets a bot face too.
- `web/src/Frames.tsx` `Phone` → `components/Phone.tsx`: on desktop the app renders inside the iPhone frame (judges on laptops), full-screen on phones (one media query). Tabs swapped for Flick's.
- `web/src/Screens.tsx` primitives (`Title`, `Group`, `Row`, `Bubble`) + `Payments.tsx` `Meter` → `components/ui.tsx`.
- Design.swift rules: black capsule = the one primary action, grey capsule = secondary, grey circle icon buttons, small-caps section labels, 34px bold titles, floating pill tab bar, critically damped springs, presses answer on touch-down.
- AG Grid themed to match via Theming API (`themeQuartz.withParams`: SF font, ink accent, white bg, `#f5f5f7` header, 16px wrapper radius, hairline `#c6c6c8` rows); same tokens in AG Studio `app/dashboard/studio/theme.ts`.
- Add `lucide-react` (icons used by the ported components).

Screens (mobile, floating pill tab bar: **This Week · Lens · People · Studio**):
1. **Onboarding** — "Meet your agents" (the 4 bots) → Connect PayPal.
2. **This Week** (home) — Autopilot bot card ("I planned 6 payments, $142"), weekly-cap `Meter`, **editable AG Grid** of planned payments (payee, amount, due, reason, status pill), black capsule **Approve week · $142**, demo "Advance a day".
3. **Lens** — camera (`<input type="file" accept="image/*" capture="environment">`) + sample-photo shelf (bill, receipt, sneaker, tip jar) → Lens bot "speaking" while reading → bottom sheet (like Air Agents' Talk sheet) with extracted fields card + actions (Pay now / Split / Buy / Tip) + "Make it recurring" toggle.
4. **Split** — **AG Grid**: receipt items × friend columns (bot-face headers, checkbox cells), pinned totals row → "Send PayPal requests".
5. **People** — grouped rows of friends with bot faces, owed amount, status; Nudge → AI-drafted friendly message in a chat bubble → send reminder.
6. **Studio** (`/dashboard`, desktop) — AG Studio restyled with tokens; custom widgets "Who owes you" scoreboard + Week timeline; Autopilot agent chat.

All screens first run on **mock data** (`data/seed.json`), then get wired to real APIs.

## Stack
**Layout (2026-11-10, user's call): `frontend/` = Next.js app, no secrets; `backend/` = dependency-free `node:http` server (TS run directly, Node ≥22.18) holding PayPal + AI keys. Frontend server components call `BACKEND_URL`; browser `/api/*` is rewritten to the backend. Backend paths below now live in `backend/src/`, UI paths in `frontend/`.**

Fork `paypaldev/hackathon-paypal-ag-grid-boilerplate`: Next.js 16 + TS + AG Grid 36 + AG Studio 3 + Tailwind v4. Reuse:
- `backend/src/paypal.ts` — OAuth cache, paging, retries (add new calls here)
- `backend/src/dashboard-data.ts` — PayPal → related tables (extend with Flick tables)
- `frontend/app/dashboard/studio/*` — Studio data, theme, AI harness, OpenAI-format adapter
- `frontend/app/(endpoints)/data-grid.tsx` — AG Grid with money column type
- `backend/src/ai-proxy.ts` — server LLM proxy
Boilerplate has no license → add MIT; credit boilerplate + Air Agents. Host on Render.
Local path: `~/flick` (clone boilerplate, fresh git history, `git config user.name "Swarnim Raj"` / `user.email swarnim.raj78@gmail.com` per repo, no co-author trailers). Push to a new public GitHub repo only when the user says so.

## AI provider: OpenRouter
- Studio adapter speaks OpenAI Responses API; OpenRouter has compatible `/api/v1/responses` (beta) → change URL in `backend/src/ai-proxy.ts` + key env in `backend/src/ai.ts`.
- One cheap vision + tool-calling model (Gemini Flash-class, exact id from OpenRouter list), set via `OPENAI_MODELS`; same model for `backend/src/brain.ts`.
- Fallback: Gemini direct for `brain.ts` + new Studio adapter (~200 lines) only if OpenRouter beta fails.

## Backend (after frontend)
- `backend/src/paypal.ts` (+): `createOrder/captureOrder`, Vault v3 setup-token → payment-token, `chargeVaulted`, `createPayout`, `createAndSendInvoice`, `remindInvoice`, `getInvoice`.
- `backend/src/store.ts`: JSON store on `globalThis`, seeded from `data/seed.json` on boot. `// ponytail: single-user JSON store, Postgres when multi-user`.
- `backend/src/brain.ts`: `understand(image)` → `{kind, fields}`; `planWeek(history, events)`; `decide(item, actual)`.
- Backend routes per action (`backend/src/server.ts`) + `POST /api/tick` (Advance a day → executor pays due items). Channel3 search for products. Poll `getInvoice` for friend-paid status.
- Studio: Flick data sources, 2 custom widgets, Autopilot = custom agent (directLlmRunner) with tools `getWeekPlan`, `explainPayment`, `nudgeFriend`, delegating to built-in data/widget agents.
- Money flow: user PayPal → Flick sandbox business acct (vaulted charge) → Payouts to biller/vendor sandbox accts. Fallback: one Orders checkout for week total → Payouts → refund leftover.

## Schedule
| When | Claude | User (parallel) |
|---|---|---|
| Nov 9 night | Fork boilerplate, port theme/Bot/Phone/ui, app shell + tab bar, seed.json, This Week screen (themed AG Grid) | PayPal sandbox app (Transaction search, Vault, Payouts, Invoicing on) + accounts (you, 3 friends, City Power, Corner Grocery, Mobile Co), OpenRouter key, AG Studio trial, Channel3 key |
| Nov 10 AM | Lens, Split, People, Onboarding, Studio restyle → **fully clickable frontend on mock data** | Run PayPal spike script; Render deploy |
| Nov 10 PM – Nov 11 | Wire brain.ts, PayPal actions, Autopilot executor, Studio agent + widgets | Test on phone, collect sample photos, script video |
| Nov 12 AM | Polish, README (setup, tools, sandbox buyer login, real vs simulated) | Record video; **submit by ~10am PST** |

## Cut
Calendar sync (manual events list), webhooks (poll), native app, multi-user auth, Render cron (Advance-a-day button).

## Verification
- Frontend: `npm run dev`, check each screen at 390px (phone) and desktop (phone frame); AG Grid edits update totals; reduced-motion respected.
- `scripts/spike.ts`: sandbox vault charge → payout → invoice create/send; asserts COMPLETED/SUCCESS/SENT.
- AI: boilerplate `/dashboard` assistant answers and adds a chart through OpenRouter; sample bill photo → correct JSON.
- E2E on phone via Render URL: each sample photo → right intent → PayPal effect visible in sandbox; Approve week → Advance days → items Paid; Studio "build my Sunday recap" → widgets appear; Nudge → reminder sent.
- Fresh-browser run of README before submitting.
