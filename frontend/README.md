# Frontend: The App, the One-Pager and Money Studio

> **Next.js 16, React 19 and Tailwind v4. Deployed on Vercel at [www.flickit.site](https://www.flickit.site).**

One build, three faces. The one-pager at `/` explains Flick with interactive sections. The working
pages are the app: phone-first, installable, and live on the [backend](../backend/). Money Studio
at `/dashboard` is AG Studio over PayPal's records and Flick's own. The frontend holds no secrets:
`/api/*` is rewritten to the backend, so every request is same-origin.

## Pages

| URL | File | Purpose |
|---|---|---|
| [`/`](https://www.flickit.site) | `app/page.tsx`, `app/_landing/` | The one-pager: the problem, each agent working on sample data, Money Studio, installing |
| [`/home`](https://www.flickit.site/home) | `app/(app)/home/` | **Today**: what needs you next, each with its one action, and this month |
| [`/chat`](https://www.flickit.site/chat) | `app/(app)/chat/` | **Flick Chat**: talk, request money and pay friends with a flick |
| [`/ask`](https://www.flickit.site/ask) | `app/(app)/ask/` | **Ask Flick**, typed or spoken, with approval cards |
| [`/lens`](https://www.flickit.site/lens) | `app/(app)/lens/` | **Lens**: snap a bill, upload an e-bill, or open one shared to Flick |
| [`/autopilot`](https://www.flickit.site/autopilot) | `app/(app)/autopilot/` | **Autopilot**: the week's editable grid, one approval, the weekly cap |
| [`/scout`](https://www.flickit.site/scout) | `app/(app)/scout/` | **Scout**: your usuals priced everywhere, forecasts, Channel3's live offers, buying |
| [`/split`](https://www.flickit.site/split) | `app/(app)/split/` | **Splitter**: the bill's items by friend, ticked by hand or by a sentence |
| [`/nudge`](https://www.flickit.site/nudge) | `app/(app)/nudge/` | **Nudge**: who owes you, and a reminder in a tone |
| [`/friends`](https://www.flickit.site/friends) | `app/(app)/friends/` | Friends, by their PayPal e-mail |
| [`/business`](https://www.flickit.site/business) | `app/(app)/business/` | Register a business, so bills with its name pay its PayPal |
| [`/profile`](https://www.flickit.site/profile), [`/login`](https://www.flickit.site/login) | `app/(app)/profile/`, `login/` | Signing in with PayPal; your money through Flick |
| [`/install`](https://www.flickit.site/install) | `app/(app)/install/` | Installing Flick on a phone, with a QR code |
| [`/dashboard`](https://www.flickit.site/dashboard) | `app/dashboard/` | **Money Studio** (AG Studio). See [its README](app/dashboard/) |

## Where the App Gets Everything

| Piece | Source |
|---|---|
| **Your Flick** | The backend, through the `/api/*` rewrite in [`next.config.ts`](next.config.ts). Server components call it directly with [`lib/api.ts`](lib/api.ts) |
| **Who you are** | A random workspace id in an HttpOnly cookie, made by [`proxy.ts`](proxy.ts) on the first request; signing in with PayPal swaps it for your own |
| **Live or sample** | [`lib/live.ts`](lib/live.ts): live whenever the backend answers, even when your Flick is empty. Sample data only on the one-pager, or when the backend is down |
| **Types** | The backend's own source, through the `@backend/*` alias, as type-only imports, so no backend code is bundled |
| **Flick to pay** | [`lib/flick.ts`](lib/flick.ts) reads the front camera in the browser; [`components/flick-confirm.tsx`](components/flick-confirm.tsx) asks for the flick |
| **Grids** | AG Grid, themed once in [`components/grid.tsx`](components/grid.tsx) |
| **Installed app** | [`app/manifest.ts`](app/manifest.ts), [`public/sw.js`](public/sw.js), [`components/pwa.tsx`](components/pwa.tsx) |

## Folder Structure

```
frontend/
├── app/
│   ├── page.tsx                # The one-pager
│   ├── _landing/               # Its sections, which are also the agents' screens
│   │   ├── lens.tsx, autopilot.tsx, split.tsx, nudge.tsx, scout.tsx, ask.tsx, friends.tsx
│   │   ├── studio.tsx          #   Money Studio's preview
│   │   ├── agents.tsx          #   The five agents' faces and colours
│   │   └── data.ts             #   Sample data, for the one-pager only
│   ├── (app)/                  # The working pages, with the tab bar (layout.tsx)
│   │   └── home, chat, ask, lens, autopilot, scout, split, nudge, friends,
│   │       business, profile, login, install
│   ├── dashboard/              # Money Studio: AG Studio, its data, widgets, theme and AI
│   ├── share/route.ts          # A bill shared before the service worker runs
│   ├── manifest.ts             # Installable: shortcuts, the share target
│   ├── pwa-icon/[size]/        # The app's icons, drawn at build time
│   ├── icon.svg, apple-icon.tsx
│   ├── layout.tsx              # Fonts, theme before paint, the nav
│   └── globals.css             # Design tokens, light and dark
├── components/
│   ├── flick-confirm.tsx       # "Flick to pay": the camera sheet
│   ├── grid.tsx                # AG Grid's modules and theme
│   ├── chat-alerts.tsx         # Unread counts and banners
│   ├── nav.tsx, phone.tsx      # The top bar; the iPhone frame on desktop
│   ├── pwa.tsx                 # The service worker, and installing
│   ├── bot.tsx, ui.tsx         # Agents' faces and building blocks, from Air Agents (MIT)
│   └── theme-toggle.tsx
├── lib/
│   ├── flick.ts                # The flick gesture, by frame differencing (tested)
│   ├── live.ts                 # Live backend or sample data
│   ├── api.ts                  # Server components to the backend
│   ├── mark.tsx, app-icon.tsx  # Flick's logo
│   └── format.ts
├── public/sw.js                # Offline pages, and bills shared from other apps
├── scripts/e2e.mjs             # npm run e2e: the whole site in headless Chrome
├── proxy.ts                    # The workspace cookie
└── next.config.ts              # The /api rewrite
```

## Rules the App Keeps

1. **No secrets, no other origins.** The browser talks only to `www.flickit.site`; keys live in the backend.
2. **The camera's frames never leave the phone.** The flick is read from tiny grayscale frames in the browser; nothing is recorded or sent.
3. **Nothing that moves money is cached or replayed.** The service worker keeps pages and your last state for offline, never a payment.
4. **No made-up data on working pages.** A new Flick shows empty states that say how to start.

## Setup

```bash
npm install
cp env.example .env.local   # optional: BACKEND_URL (default http://localhost:4000), AG_STUDIO
npm run dev                 # http://localhost:3000, with the backend running
```

| Command | What it proves |
|---|---|
| `npm test` | The flick gesture: flicks, and what isn't one |
| `npm run lint` | ESLint, including React's hook rules |
| `npm run build` | The production build |
| `npm run e2e` | The built site in headless Chrome: every page on phone and desktop, light and dark, no console errors or sideways scroll; every flow clicked through; bills shared through the service worker; real payments on PayPal's page, with a flick, and by themselves |

## Deployment

Vercel, from GitHub's `main`, with `frontend` as the root directory. Set `BACKEND_URL` (read at
build time for the rewrite) and `AG_STUDIO` in Vercel. `flickit.site` redirects to
`www.flickit.site`.

## Tech Stack

| Technology | Purpose |
|---|---|
| **Next.js 16, React 19** | Server components per request, route handlers, the rewrite |
| **Tailwind v4** | Styles from the design tokens in `globals.css` |
| **AG Grid 36, AG Studio 3** | The grids, and Money Studio |
| **lucide-react** | Icons |
| **Web APIs** | Camera (`getUserMedia`), Web Push, service worker, Web Share Target, speech recognition and synthesis |
| **Vercel** | Hosting |

The design language (bot faces, phone frame, colours and motion) is ported from
[Air Agents](https://github.com/ahmedfahim21/Spatial-Agents) (MIT).

[Back to the main README](../README.md) · [Backend](../backend/) · [Partner evidence](../partner-docs/)
