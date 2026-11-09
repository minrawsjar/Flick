# Umang: Story & submission track

Hi Umang! You're on **Story & submission**: the **demo video** (under 3 minutes) and the **Devpost write-up**. The judging weighs presentation as much as the code, and "Best Demo" is a prize of its own, so this track matters as much as the code.

## Flick in one minute

Flick is our PayPal AI Hackathon entry. Tagline: **"Snap it. Flick pays."** Four AI agents do the work:

- **Lens** reads a photo of a bill, receipt, price tag or tip jar (vision AI) and pays it through a PayPal checkout.
- **Autopilot** plans the week's payments from what it has seen, takes **one** PayPal approval, then pays each on its day.
- **Splitter** splits a receipt (you can just *say* who had what) and sends each friend a PayPal invoice.
- **Nudge** writes a reminder in the tone you pick, and PayPal sends it.
- **Ask Flick** is an agent over all four: one sentence becomes a plan of actions across them, and nothing runs until you approve.
- **Money Studio** is a dashboard (AG Studio) over all the data, which its own AI can build for you.

| | |
|---|---|
| Live site | https://flick-frontend-woad.vercel.app |
| Repo | https://github.com/minrawsjar/Flick |
| Hackathon page (rules, prizes, submission form) | https://paypalaihackathon.devpost.com |
| Technical details for the write-up | [`README.md`](../../README.md) |

The one-pager at `/` is the *story* (animated demos). The navbar pages are *live*: real AI and the real PayPal sandbox. **Record the live pages**; the one-pager is good for the opening and closing shots.

## Who does what

| Who | Track | Hands you |
|---|---|---|
| **Umang (you)** | Story & submission | |
| Manya | Test & sandbox | Sandbox logins (for recording and for judges), the best real photos, fresh demo data before you record |
| Utkarsh | Build: Money Studio widgets and agent | Finished features by the freeze |
| Swarnim | Reviews, deploys, final say on the submission | |

## Timeline (IST)

| When | What |
|---|---|
| **Tue 10 Nov** | Watch every flow on the live site. Write the voiceover script (task 1). Start the Devpost draft (task 2). |
| **Wed 11 Nov** | Record practice takes of what's stable (Lens, Split, Nudge, Ask Flick). Get the script reviewed by Swarnim. |
| **Thu 12 Nov, 14:00** | Feature freeze. Manya prepares demo data (about an hour). |
| **Thu 12 Nov, 15:30–20:00** | Record the final takes, edit, upload to YouTube. |
| **Thu 12 Nov, 23:30** | **Submit** (10:00 PST). Hard deadline: Fri 13 Nov, 01:30 IST. Don't cut it close. |

## Task 1: The demo video (≤ 3:00, hard limit)

### Storyboard

Times are targets. The story is **one person's week**: snap, pay, split, get paid back, and an agent that does it all from one sentence.

| Time | Scene | On screen | Say (roughly) |
|---|---|---|---|
| 0:00–0:12 | Hook | Phone camera on an electricity bill, then the one-pager hero "Snap it. Flick pays." | "Bills, receipts, IOUs. What if you could just snap them?" |
| 0:12–0:40 | Lens | `/lens` on a phone: **Snap your own** of a real bill → fields fill in → **Pay with PayPal** → PayPal sandbox approval → "Paid" → "Pay it every month" | "Lens reads it with AI. One tap and PayPal pays it, and Autopilot remembers it for next month." |
| 0:40–1:05 | Autopilot | `/autopilot`: the AG Grid of the week with Autopilot's reasons → change an amount → **Approve with PayPal** once → **Next day** → payments turn "Paid" | "Autopilot plans your week from what you actually pay, and why. One approval on Sunday, and it pays each bill on its day." |
| 1:05–1:30 | Split | `/split`: type "Maya and I shared the salmon…" → **Tick it for me** → **Send requests** → cut to Maya's PayPal showing the invoice | "Dinner with friends? Just say who had what. Each friend gets a PayPal invoice for their share." |
| 1:30–1:45 | Nudge | `/nudge`: pick Leo, tone **Funny** → AI draft types out → **Send** | "And when someone forgets, Nudge reminds them nicely, through PayPal." |
| 1:45–2:20 | Ask Flick | `/ask`: "Split last night's sushi with Maya and Leo, and remind Leo about the cab" → it reads your data → approval card → **Go ahead** → done | "Or just ask. Flick plans across every agent, and nothing happens until you say yes." |
| 2:20–2:45 | Money Studio | `/dashboard`: the This week page → AI chat "Build my Sunday recap" → widgets appear | "Everything lands in Money Studio, a dashboard an AI builds for you." |
| 2:45–3:00 | Close | One-pager closing band "Point. Snap. Paid." + live URL + "PayPal · AG Grid · AI" | "Flick. Snap it, and it's paid." |

### Recording tips

- **1920×1080**, browser zoom about 110%, bookmarks bar hidden, notifications off. Pick **one** theme (dark looks great) and stick to it.
- Record each scene **separately**; it's much easier to edit and redo.
- Before the final takes, Manya resets the demo data (her task 3). Use the **You** sandbox login she gives you to approve payments on PayPal's page.
- For the phone shots (Lens), record the phone screen (iOS/Android screen recording), or film the phone over the shoulder.
- The PayPal approval page is part of the story: keep it, but speed it up.
- Add captions; many judges watch muted. Keep music quiet under the voice.
- Upload to **YouTube** (public or unlisted) and check it plays in a private window.

**Done when:** the video is ≤ 3:00, on YouTube, playable without signing in, and Swarnim has watched it.

## Task 2: The Devpost write-up

Draft it in a doc first; Swarnim reviews it before it goes into the form. Use the README for facts, and keep the tone plain and confident.

### Sections

- **Inspiration**: the small, constant admin of money (bills, splitting, chasing friends) and how often it gets forgotten.
- **What it does**: the five bullets at the top of this file, in your words, plus "you approve every action".
- **How we built it**:
  - **PayPal (sandbox)**: Orders v2 (checkout, capture), Payments v2 (refunds when a payment is skipped), Payouts v1 (paying billers and friends), Invoicing v2 (create, send, remind, check paid), Transaction Search and Balances (Money Studio). OAuth client credentials; checkouts, captures, refunds, payouts and invoices carry a `PayPal-Request-Id`, so a retry or a reloaded page can never pay or invoice twice.
  - **AI (via OpenRouter)**: Lens uses Gemini 2.5 Flash-Lite with structured JSON output (with GPT-6 Luna as fallback), and every reading is checked before it can become money. Ask Flick is an agent on GPT-6 Luna with tool calling: read tools run on their own; action tools wait for the person's approval. Nudge drafts, "Tick it for me", and Money Studio's AI assistant.
  - **AG Grid and AG Studio**: the editable week plan, the split grid with bot-face headers and pinned totals, Money Studio's reports and custom widgets (Utkarsh's work: confirm with him what made it).
  - **Stack**: Next.js 16 and React 19 on Vercel; a Node.js backend with no dependencies on Railway; Tailwind; design language adapted from Air Agents (MIT).
- **Challenges**: PayPal sandbox accounts in India can't send payouts (we moved to a US sandbox business account); PayPal caches access tokens with old permissions (we revoke and re-issue); keeping the AI's output from ever becoming a wrong payment.
- **Accomplishments**: real end-to-end money flows on the sandbox; an agent that plans across four agents with a human approving every action.
- **What we learned** and **What's next**: real bank and bill integrations, scheduled Autopilot runs, shared household accounts.
- **Built with**: PayPal REST APIs, AG Grid, AG Studio, Next.js, React, TypeScript, Tailwind CSS, Node.js, OpenRouter, Gemini, GPT, Vercel, Railway.

### Also in the submission

- [ ] **Live demo URL**: https://flick-frontend-woad.vercel.app
- [ ] **Repo**: https://github.com/minrawsjar/Flick (public, MIT licence)
- [ ] **Video**: the YouTube link
- [ ] **Test login for judges**: the **You** sandbox account, from Manya, sent privately. Say it's a PayPal *sandbox* account and that no real money moves.
- [ ] **How to try it**, for judges: start at the one-pager, then try **Lens → Pay**, **Autopilot → Approve**, and **Ask Flick**. Say the one-pager is a demo and the navbar pages are live.
- [ ] **Gallery**: 5 or 6 screenshots (one-pager hero, Lens result, Autopilot grid, Split, Ask Flick approval card, Money Studio).
- [ ] **Prize categories**: Grand Prize, Most Creative, Best Demo, Agentic Commerce, Best Use of AG Grid (check the form for the exact options).
- [ ] Every team member added on Devpost.

**Done when:** submitted by **23:30 IST Thu 12 Nov**, and the Devpost page shows the video, the link and the repo.

## Task 3: The README's first screen (small)

Judges open the repo. Before submitting, ask Swarnim to put a screenshot, the live link and the video link at the top of `README.md`. Send him the screenshot and the YouTube link.
