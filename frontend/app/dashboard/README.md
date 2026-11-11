# Money Studio: AG Studio inside Flick

> **AG Studio 3 over PayPal's records and Flick's own, themed as part of the app, with Studio's AI assistant and Flick's agent side by side.**

Money Studio is the household's money HQ at [`/dashboard`](https://www.flickit.site/dashboard). It
joins what PayPal knows (products, plans, invoices, transactions, payouts and balances) with what
Flick knows (this week's payments, past payments, money owed and what each agent did) into one
report you can explore and change. Why it matters for the AG Grid track is in
[partner-docs/ag-grid.md](../../../partner-docs/ag-grid.md).

## How It Fits Together

```
GET /api/dashboard (backend/src/dashboard-data.ts): flat rows, from five PayPal endpoints and Flick
  → page.tsx: fetched per request, for this browser's Flick
  → dashboard.tsx: the shell (saved reports, page names, navigation) around one <AgStudio>
      ├── studio/data.ts            tables, relationships, a shared calendar, measures
      ├── studio/initial-report.ts  the built-in report, Flick's pages first
      ├── studio/custom-widgets.tsx "Who owes you" and "Week timeline", under "Flick"
      ├── studio/theme.ts           every value a Flick design token
      └── studio/ai.ts              Studio's assistant → /api/ai/responses (backend proxy)
  → components/AiAgentModal.tsx: Ask Flick in the corner (backend/src/agent.ts)
```

The shell drives Studio through its `AgStudioApi` (`setState`, `getState`, `undo`, `redo`), and Studio
reports every change through `onStateUpdated`, which only redraws the shell. Saved reports are kept
in this browser's `localStorage` ([`reports-store.ts`](reports-store.ts)).

## Files

| File | Purpose |
|---|---|
| [`page.tsx`](page.tsx) | Loads Money Studio's data for this browser's Flick, per request |
| [`dashboard.tsx`](dashboard.tsx) | The shell around AG Studio, and the state API |
| [`reports-store.ts`](reports-store.ts), [`use-reports.ts`](use-reports.ts) | Saved reports, kept in this browser |
| [`report-state.ts`](report-state.ts) | Pure helpers over Studio's report state: unsaved changes, editing pages |
| [`page-titles.ts`](page-titles.ts) | Page names, which Studio's state doesn't keep |
| [`studio/data.ts`](studio/data.ts) | AG Studio's data sources |
| [`studio/initial-report.ts`](studio/initial-report.ts) | The built-in report: KPI tiles, charts and grids on a 24-column canvas |
| [`studio/custom-widgets.tsx`](studio/custom-widgets.tsx) | Registers Flick's widgets beside Studio's own |
| [`studio/WhoOwesYouWidget.tsx`](studio/WhoOwesYouWidget.tsx) | Each friend with money out: how much, since when, how many reminders |
| [`studio/WeekTimelineWidget.tsx`](studio/WeekTimelineWidget.tsx) | Autopilot's week, each payment on its day, coloured by where it stands |
| [`studio/widget-parts.ts`](studio/widget-parts.ts) | What the widgets read from Studio's `context` |
| [`studio/theme.ts`](studio/theme.ts) | The AG Studio theme, from Flick's tokens; chart series in the agents' colours |
| [`studio/ai.ts`](studio/ai.ts) | Studio's AI harness: prompt starters and the model picker |
| [`studio/openai-adapter.ts`](studio/openai-adapter.ts) | AG Studio's Responses API adapter, copied unchanged from its docs |
| [`components/`](components/) | The shell's sidebar, header, dialogs, empty states, and Ask Flick |
| [`loading.tsx`](loading.tsx), [`error.tsx`](error.tsx) | While it loads, and if the backend doesn't answer |

## The AI, Safely

Studio's assistant runs in the browser but holds no key. It calls `/api/ai/responses`, which the
frontend rewrites to [`backend/src/ai-proxy.ts`](../../../backend/src/ai-proxy.ts). That proxy adds
the key, allows only the models in `STUDIO_MODELS`, caps output tokens, and counts the call against
the hourly AI budget. Ask Flick, in the corner, proposes actions that wait for your approval.

[Back to the frontend](../../) · [Partner evidence: AG Grid](../../../partner-docs/ag-grid.md)
