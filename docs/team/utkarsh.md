# Utkarsh: Money Studio

Hi Utkarsh! You own **Money Studio** (`/dashboard`), our AG Studio dashboard. Your work is aimed at the **Best Use of AG Grid** prize, which asks for "polish: custom widgets, theming, layout" and the **Studio Agent Framework**: "a custom agent talking to Studio's built-in agents". Theming and layout are done; custom widgets and the agent aren't. That's you.

**First:** follow [`setup.md`](setup.md) to run Flick locally with your own PayPal sandbox and AI key. You need both: Money Studio loads PayPal data, and task 2 is AI.

## Flick in one minute

Snap anything you need to pay, and Flick pays it. Four AI agents: **Lens** reads photos of bills and receipts, **Autopilot** plans and pays the week with one PayPal approval, **Splitter** invoices friends for their share, **Nudge** reminds them. **Ask Flick** plans across all four. **Money Studio** is AG Studio over all the data: this week's payments, past payments, who owes you, what each agent did, and the PayPal account's own data.

## Your area

```
frontend/app/dashboard/            Money Studio's page and shell
frontend/app/dashboard/studio/     data sources (data.ts), the report (initial-report.ts),
                                   theme (theme.ts), AI (ai.ts, openai-adapter.ts)
backend/src/dashboard-data.ts      the tables Money Studio gets (only if you need a new field)
```

Others: Manya owns Autopilot and Lens, Umang owns Ask Flick and webhooks.

## Task 1: Two custom widgets (do this first)

Build two AG Studio **custom widget types**, add them to the widget menu, and put them on the **This week** page of the built-in report:

1. **Who owes you**: a scoreboard of friends, each with their bot face, what they still owe and how many reminders have gone out. Data: the `flickRequests` source (`friend`, `outstanding`, `reminders`, `status`).
2. **Week timeline**: Monday to Sunday as seven columns, each payment a chip on its day, coloured by status (planned, scheduled, paid, skipped, failed). Data: the `flickPayments` source (`date`, `payee`, `amount`, `status`).

Where to look:

- AG Studio's custom widget API: `frontend/node_modules/ag-studio/dist/types/api/widgets/agCreateWidgetsParams.d.ts` (`additionalTypes`, `AgCustomWidgetDefinition`, `menu`), with the AG Studio docs at https://www.ag-grid.com/studio/.
- Studio is set up in [`frontend/app/dashboard/dashboard.tsx`](../../frontend/app/dashboard/dashboard.tsx) (the `<AgStudio>` props).
- The report's pages: [`initial-report.ts`](../../frontend/app/dashboard/studio/initial-report.ts) (the `week` page; the layout is a 24-column grid).
- Data sources and field ids: [`data.ts`](../../frontend/app/dashboard/studio/data.ts).
- Bot faces: `import { Bot } from "@/components/bot"` (friends' `color` and `shape` are in `GET /api/state` → `friends`). Colours come from CSS variables in [`globals.css`](../../frontend/app/globals.css) (`var(--color-card)`, `var(--color-paid)`…), which also handle dark mode: use those, not hex values.

**Done when:**
- [ ] Both widgets are on the This week page and in Studio's widget menu, so they can be added anywhere.
- [ ] They follow Studio's filters and update when the data changes (try Autopilot's **Next day** on `/autopilot`, then reload).
- [ ] They look right in light and dark mode.

Reports are cached in your browser: use **Reset demo** at the bottom of Money Studio's sidebar (or a private window) to see your new defaults.

## Task 2: A Flick agent inside Money Studio

Add a **Flick** agent to Money Studio's AI chat. It knows the household's money and hands the dashboard work to AG's own agents. Asked "Build my Sunday recap", it should:

1. Read the week through a tool that calls our backend (`GET /api/state` from the browser; `/api` is rewritten to the backend).
2. Delegate the layout and widgets to AG's lead agent (`builtIn.lead`), which builds the page, ideally using your two widgets.

Where to look:

- Our harness today: [`studio/ai.ts`](../../frontend/app/dashboard/studio/ai.ts) (`createAiHarness(api, { adapter, … })`).
- `node_modules/ag-studio/dist/types/studio/ai/createAiHarness.d.ts`: pass a *builder* instead of defaults; it receives the tools, Studio's tools and AG's agents as `builtIn`.
- AG's five agents (a lead, plus data, layout, planning and widget specialists): `…/studio/ai/defaultAgents/defaultAgents.d.ts`.
- Custom tools: `…/studio/ai/defineAiTool.d.ts`.
- The browser calls `/api/ai/responses`, which our backend proxies with your key ([`backend/src/ai-proxy.ts`](../../backend/src/ai-proxy.ts)), so the frontend needs no key.

Keep its tools **read-only**: paying and messaging people stays in Ask Flick, where every action needs approval.

**Done when:**
- [ ] "Build my Sunday recap" in Money Studio's chat produces a page about this week: what was paid, what's left, who owes what.
- [ ] "Why is City Power on Wednesday?" gets Autopilot's reason (`flickPayments.reason`).
- [ ] Ordinary requests still work ("add a chart of past payments by payee").

## Task 3: Polish, if there's time before the freeze

- The **Owed to you** page: put your scoreboard there too, with a chart of how long each request has been open.
- Check every Money Studio page at a laptop width (1280px) and on a big screen: nothing cramped or cut off.

## When you're stuck

The README's "Money Studio" and "How it works" sections, then Swarnim. Ask early rather than late.
