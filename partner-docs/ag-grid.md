<div align="center">

# Flick × AG Grid

### A household's money as data you can edit, explore and ask about.

[![AG Grid](https://img.shields.io/badge/AG%20Grid-36.2-1E6FD9?style=flat-square)](../frontend/components/grid.tsx)
[![AG Studio](https://img.shields.io/badge/AG%20Studio-3.0-1E6FD9?style=flat-square)](../frontend/app/dashboard/)
[![Widgets](https://img.shields.io/badge/custom%20widgets-Who%20owes%20you%20%C2%B7%20Week%20timeline-A78BFA?style=flat-square)](../frontend/app/dashboard/studio/custom-widgets.tsx)
[![AI](https://img.shields.io/badge/Studio%20AI-Responses%20API%20proxy-4ADE80?style=flat-square)](../backend/src/ai-proxy.ts)

**AG Grid is where Flick's agents show their work and take your edits. AG Studio is Money Studio,
the household's money HQ, where an AI assistant builds the pages.**

</div>

> **Track:** Best Use of AG Grid. The judges look for polish (custom widgets, theming, layout) and use of AG Studio's AI.

Flick uses AG Grid in the three places where a person has to check an agent's work before money
moves: Autopilot's week, Splitter's bill, and Scout's prices. It uses AG Studio for Money Studio,
which joins PayPal's own records to Flick's into one report. Studio's assistant changes that
report on request, and Flick's own agent works in the corner beside it. Every grid and every Studio
page is themed from the same design tokens as the rest of the app, so it all follows light and
dark mode together.

## Why Flick Wins This Track

| What the judges look for | What Flick does |
|---|---|
| **Custom widgets** | Two widgets of Flick's own in a *Flick* group in Studio's edit panel, *Who owes you* and *Week timeline*. They read Money Studio's data from Studio's `context`, so they work as soon as they're dropped on a page. |
| **Theming** | One set of design tokens for the grids (`themeQuartz.withParams`), AG Studio (`studioTheme.withParams`) and the app, so both follow dark mode. Studio's chart series take the five agents' colours. |
| **Layout** | A built-in report with Flick's own pages first (this week, who owes you, what the agents did), then the PayPal account's revenue, receivables, cash and catalogue, laid out on Studio's 24-column canvas with KPI tiles and sparklines. |
| **AG Studio's AI** | Studio's AI harness (`createAiHarness`) with the Responses API adapter, pointed at a backend proxy that holds the key, allows only listed models and caps output. It comes with prompt starters, such as "Build a Sunday recap page", and a model picker. |
| **Grids that do real work** | Edits in the week's grid change what PayPal is asked for. Ticks in the bill's grid decide what each friend is invoiced. Scout's grid prices the basket you buy. |

## What We Built

### Three AG Grids, each in front of a payment

[`components/grid.tsx`](../frontend/components/grid.tsx) registers only the modules Flick uses
(client-side rows, number and select editors, pinned rows, auto-height rows, row and cell styles)
and themes AG Grid as an iOS grouped list: a card with no frame, hairline rows, small grey headers,
and ink as the accent.

| Grid | Where | AG Grid features | What it decides |
|---|---|---|---|
| **The week** | Autopilot, [`_landing/autopilot.tsx`](../frontend/app/_landing/autopilot.tsx) | Number editor for amounts, select editor for days (single click), editable only while a payment is still planned, custom cells for the payee, the status pill and Autopilot's reason, wrapped auto-height rows | What the one weekly PayPal approval covers |
| **Who had what** | Splitter, [`_landing/split.tsx`](../frontend/app/_landing/split.tsx) | One column per friend with a custom header (their face), tick-box cell renderers, totals in a pinned bottom row | What each friend's PayPal invoice or Flick Chat request asks for |
| **Prices** | Scout, [`_landing/scout.tsx`](../frontend/app/_landing/scout.tsx) | Custom cells for the product, the best store this week, and a sparkline of 12 weeks with the 4-week forecast; select a row for every store's price | Where the basket is bought |

### Money Studio: AG Studio inside Flick

[`app/dashboard/`](../frontend/app/dashboard/), with data from [`dashboard-data.ts`](../backend/src/dashboard-data.ts)

| AG Studio feature | How Money Studio uses it |
|---|---|
| **Data sources** | A table for each kind of record: PayPal's products, plans, invoices with their items and payments, transactions, payouts and balances, read from five endpoints at once; and Flick's own this-week payments, past payments, money owed and agent activity |
| **Relationships, calendar, measures** | Invoices join to their customers, items and payments, and billing plans to their products. A shared calendar gives every date field the same weeks and months. Calculated measures: collection rate, overdue share and refund rate |
| **Report state** | A built-in report ([`initial-report.ts`](../frontend/app/dashboard/studio/initial-report.ts)) and saved reports: the shell drives Studio through `AgStudioApi` (`setState`, `getState`, `undo`, `redo`), and `onStateUpdated` redraws it |
| **Custom widgets** | [`WhoOwesYouWidget.tsx`](../frontend/app/dashboard/studio/WhoOwesYouWidget.tsx): each friend with money out, how much, since when, and how many times Nudge reminded them. [`WeekTimelineWidget.tsx`](../frontend/app/dashboard/studio/WeekTimelineWidget.tsx): Autopilot's week, Monday to Sunday, each payment on its day, coloured by where it stands |
| **Theme** | [`studio/theme.ts`](../frontend/app/dashboard/studio/theme.ts): every value points at a Flick design token, and the chart palette uses the agents' colours |
| **AI assistant** | [`studio/ai.ts`](../frontend/app/dashboard/studio/ai.ts) and AG Studio's own [OpenAI adapter](../frontend/app/dashboard/studio/openai-adapter.ts), kept unchanged so it diffs against new releases, calling `/api/ai/responses` |

Beside Studio's assistant, **Ask Flick** sits in Money Studio's corner
([`AiAgentModal.tsx`](../frontend/app/dashboard/components/AiAgentModal.tsx)). It's Flick's own
agent: it reads your week, bills, friends and requests, and proposes actions that wait for you. So
the dashboard has two agents with two jobs: Studio's builds the pages, and Flick's acts on what they
show.

## How We Meet the Criteria

**Polish.** The grids look like the rest of the app, at phone width and on a laptop, in light and
dark. Studio has the app's fonts, colours and radii, and its own page shell with saved reports and
page names.

**Custom widgets.** Two, drawn from Money Studio's own data, listed under *Flick* in the edit panel.

**Layout.** A finished report on first open, with Flick's pages first, and empty tables that say how
to fill them until you've paid something.

**AI.** Studio's assistant builds and changes pages through the Responses API. The key never reaches
the browser: the backend's [`ai-proxy.ts`](../backend/src/ai-proxy.ts) adds it, allows only the
models in `STUDIO_MODELS`, caps output tokens, and counts each call against an hourly budget.

**Core to the product.** The grids sit in front of real money: what you edit or tick there is what
PayPal is asked to move.

## Source Code

| File | Purpose |
|---|---|
| [`frontend/components/grid.tsx`](../frontend/components/grid.tsx) | AG Grid's modules and theme, shared by every grid |
| [`frontend/app/_landing/autopilot.tsx`](../frontend/app/_landing/autopilot.tsx) | The week's editable grid |
| [`frontend/app/_landing/split.tsx`](../frontend/app/_landing/split.tsx) | Splitter's who-had-what grid |
| [`frontend/app/_landing/scout.tsx`](../frontend/app/_landing/scout.tsx) | Scout's price grid |
| [`frontend/app/dashboard/dashboard.tsx`](../frontend/app/dashboard/dashboard.tsx) | The shell around AG Studio, and the state API |
| [`frontend/app/dashboard/studio/`](../frontend/app/dashboard/studio/) | Data sources, theme, built-in report, custom widgets, AI |
| [`backend/src/dashboard-data.ts`](../backend/src/dashboard-data.ts) | Studio's rows, from PayPal and from Flick |
| [`backend/src/ai-proxy.ts`](../backend/src/ai-proxy.ts) | The Responses API proxy for Studio's assistant |

## Product Feedback for AG Grid

### What worked well

- **The Theming API** took CSS variables directly, so one set of tokens themes the grids, Studio and the page, dark mode included.
- **Modules** let us ship only the features we use.
- **Custom widgets reading `context`** needed no data mapping: a widget drops onto a page and shows.
- **The AI adapter example** worked unchanged behind our proxy.

### Where we lost time

- **The Studio Responses adapter needs a provider with `/responses`.** OpenRouter's is in beta, so `npm run check` tests it before a demo.
- **Studio's state has no page names**, so the shell keeps them beside each saved report.

### Suggestions

- A documented way for an outside agent to drive Studio's assistant, so one assistant could build a page and act on it.
- Page names in Studio's own report state.

## Future Plans with AG Grid

1. **Let Ask Flick hand page-building to Studio's assistant**, so "show me what I spent on groceries" opens a page, not just an answer.
2. **More Flick widgets:** Scout's price forecasts and a Splitter balance between friends.
3. **Save reports to the backend** instead of the browser, so they follow you between devices.

## Why Flick and AG Grid

An agent that pays for you has to show its work in a form you can check and change. A grid is that
form: every payment a row, every share a tick, every price a cell. AG Grid gave Flick that, and AG
Studio turned the same data into a dashboard people explore and an AI can build on.

[Back to partner evidence](README.md) · [Main README](../README.md)
