# Flick: the 3-minute submission video

> **3:00 in three parts: a 20-second hook cut from the "Gone in a Flick" intro, one minute of architecture on the two diagrams, then every feature live at www.flickit.site, ending on the install card.**

## Timing

| Section | Start–end | Seconds | Voiceover words |
|---|---|---|---|
| 1. Introduction and the problem | 0:00–0:20 | 20 | 40 |
| 2. Architecture | 0:20–1:20 | 60 | 135 |
| 3. Demo | 1:20–3:00 | 100 | 217 |
| **Total** | **0:00–3:00** | **180** | **392** (about 130 a minute) |

At 150 words a minute, a beat holds 2.5 words a second. Every beat below is at or under that, and
most leave a second or two for the screen to land.

**The demo, feature by feature**

| Feature | Start–end | Seconds | Words |
|---|---|---|---|
| Sign in with PayPal | 1:20–1:25 | 5 | 7 |
| Lens: photo, PDF, currency, one flick | 1:25–1:38 | 13 | 28 |
| Autopilot | 1:38–1:48 | 10 | 24 |
| Splitter and Nudge | 1:48–1:58 | 10 | 22 |
| Flick Chat | 1:58–2:07 | 9 | 22 |
| Safe | 2:07–2:29 | 22 | 51 |
| Scout | 2:29–2:38 | 9 | 20 |
| Ask Flick | 2:38–2:43 | 5 | 11 |
| Businesses on Flick | 2:43–2:47 | 4 | 9 |
| Money Studio | 2:47–2:54 | 7 | 16 |
| The install card | 2:54–3:00 | 6 | 7 |

In the demo, "I" is Swarnim. Maya is a friend on Flick; Leo is a friend who isn't.

---

## 1. Introduction and the problem (0:00–0:20) · 40 words

**0:00–0:04 · The street** (4 s · 4 words)
- **On screen:** the Wan cut's shot 1 ([wan.md](wan.md)): Nina walks down the brownstone street with the grey suits and their placards behind her.
- **Voiceover:** "Bills follow you everywhere."
- **Caption:** Bills follow you everywhere.

**0:04–0:10 · The problems** (6 s · 14 words)
- **On screen:** four 1.5-second cuts from the intro, problem halves only, before anyone vanishes: the `ELECTRIC $64.20` placard (shot 2), the line of grey suits in the aisle (shot 3), `DINNER SPLIT` at the table (shot 4), `LEO OWES YOU` on the pitch (shot 5).
- **Voiceover:** "Bills to retype. Dinners to split. Friends to chase. Groceries that keep costing more."
- **Caption:** none; the placards say it.

**0:10–0:14 · Money sent for a purpose** (4 s · 8 words)
- **On screen:** one new shot in the intro's style: a bill person holding a placard that reads `FOR CHOCOLATES $20` (made from `placards/blank.jpg`), while a friend behind them holds up a phone charger. No time to make it: a slow push-in on the blank placard, with the caption.
- **Voiceover:** "Money sent for one thing, spent on another."
- **Caption:** Sent for chocolates. Spent on a charger.

**0:14–0:20 · Flick** (6 s · 14 words)
- **On screen:** the installed Flick app opening on a phone, landing on Today (`/home`).
- **Voiceover:** "Flick is a team of AI agents that sorts it all out, on PayPal."
- **Caption:** Flick · www.flickit.site

---

## 2. Architecture (0:20–1:20) · 135 words

Show `diagrams/architecture.svg`, then `diagrams/money.svg`, full screen at 16:9, in a browser so
the text stays sharp. Move with slow zooms and pans; put a soft glow or outline on each box as it's
named.

**0:20–0:30 · The app and the site** (10 s · 24 words)
- **On screen:** `architecture.svg`, whole, for one second. Zoom into the first column, **YOUR PHONE OR LAPTOP** ("Flick, the installed app", "Flick to pay", "Service worker"), then pan right to **VERCEL · NEXT.JS 16** ("proxy.ts", "/api/* rewrite").
- **Voiceover:** "Here's how it fits together. Flick installs on your phone from the website. The site is Next.js on Vercel, and it holds no secrets."
- **Caption:** Installed app · Next.js 16 on Vercel

**0:30–0:44 · The backend and its agents** (14 s · 33 words)
- **On screen:** pan to **RAILWAY · NODE 22, NO DEPENDENCIES**. Highlight each box under AGENTS as it's named: Lens, Autopilot, Splitter, Nudge, Scout, then Safe (the blue hexagon, "money for one purpose", between Scout and Flick Chat). Then Flick Chat and Ask Flick.
- **Voiceover:** "Every request goes to one Node backend on Railway. Six agents live there: Lens, Autopilot, Splitter, Nudge, Scout, and our newest, Safe. Flick Chat connects friends, and Ask Flick plans across them all."
- **Caption:** Node 22 on Railway · six agents

**0:44–0:55 · The services** (11 s · 23 words)
- **On screen:** pan to **SERVICES**. Highlight "AI model, OpenRouter" ("Vision + JSON: Lens, Scout, Safe"), then "Channel3", then "Frankfurter". Jump back to the "AG Grid 36 · AG Studio 3" box in the Vercel column.
- **Voiceover:** "An AI model reads photos and PDFs. Channel3 gives Scout real online prices. Frankfurter converts foreign bills. AG Studio is our money dashboard."
- **Caption:** OpenRouter · Channel3 · Frankfurter · AG Studio

**0:55–1:08 · The money** (13 s · 29 words)
- **On screen:** cross-fade to `money.svg`. Highlight the middle box, **Flick's PayPal account**, then the left column (a guest, a flick, by itself, a friend not on Flick), then the right (billers, stores, friends, back to the payer). On "eight PayPal APIs", cut back for two seconds to the "PayPal REST, sandbox" box in `architecture.svg` (its Payouts and Refunds lines now name Safes), with the caption's eight names.
- **Voiceover:** "Now the money. Every payment is captured into Flick's PayPal account, then paid on to whoever is owed. Eight PayPal APIs, from Orders and Vault to Payouts and refunds."
- **Caption:** Orders · Vault · Payouts · Invoicing · Refunds · Webhooks · Reporting · Catalog and Billing

**1:08–1:20 · The rule** (12 s · 26 words)
- **On screen:** a plain card in Flick's colours. The rule appears one clause at a time as it's said. Under it, small: "Tested: 63 backend and 8 frontend unit tests, 90 API steps on the real sandbox, and a browser run that pays for real."
- **Voiceover:** "One rule runs through it all. AI reads and proposes. Rules check. A person approves. And PayPal moves the money. No model ever sets an amount."
- **Caption:** AI reads and proposes, rules check, a person approves, and PayPal moves the money.

---

## 3. Demo (1:20–3:00) · 217 words

Real screen recordings of www.flickit.site on the PayPal sandbox. Speed up waits (PayPal's page, a
model reading) in the edit; never fake a result.

**1:20–1:25 · Sign in with PayPal** (5 s · 7 words)
- **On screen:** `/login` → **Sign in with PayPal** → PayPal's sandbox page, approving "save PayPal with Flick" with no purchase (sped up) → back on Today.
- **Voiceover:** "First, I sign in with PayPal, once."
- **Caption:** Signed in with PayPal's vault. No password of Flick's own.

**1:25–1:38 · Lens** (13 s · 28 words)
- **On screen:** `/lens`. Snap the printed City Power bill: Lens shows City Power, $64.20, due Nov 14, and that it pays City Power's own PayPal. Pay → the "Flick to pay" sheet → a finger flicked up at the front camera → Paid (6 s). **Upload an e-bill** → `props/northwind-mobile-ebill.pdf`, read (3 s). A bill in rupees, shown as the original and in dollars, like "₹801.00 ($8.53)" (3 s).
- **Voiceover:** "Lens reads a paper bill. I flick a finger at the camera, and it's paid from my saved PayPal. It reads PDF e-bills too, and converts other currencies."
- **Caption:** One flick: paid from saved PayPal · PDF e-bill · ₹ to $ at today's rate

**1:38–1:48 · Autopilot** (10 s · 24 words)
- **On screen:** `/autopilot`. The week's grid, each payment with its reason; one row flagged (for example "27% above usual"). Edit an amount in the grid, tick **Save PayPal**, approve the week once. Then the weekly cap ($200 to start) and a payment marked "by itself".
- **Voiceover:** "Autopilot plans my week from what I've paid. It flags anything unusual. I approve once, or it pays by itself under a weekly cap."
- **Caption:** One approval a week · or by itself, under the cap

**1:48–1:58 · Splitter and Nudge** (10 s · 22 words)
- **On screen:** `/split` with Mama Lu's receipt ($64.71). **Tick it for me**: "Maya and I shared the dumplings, Leo had the wontons" → the who-had-what grid fills, totals in the bottom row. Send: Maya's share goes to Flick Chat, Leo's as a PayPal invoice. Cut to `/nudge`: Leo, tone **Funny**, the draft appears, Send.
- **Voiceover:** "Splitter works out each share of dinner, to the cent, and asks each friend to pay. Nudge reminds them, in my tone."
- **Caption:** Leo: a PayPal invoice · Nudge: PayPal's own reminder

**1:58–2:07 · Flick Chat** (9 s · 22 words)
- **On screen:** Maya, on a second phone, asks Swarnim for $21.45 for sushi with the bill's photo. Swarnim's installed app shows a push notification; tap it, Pay, flick, Paid. Then turn on **Pays by itself** for Maya and pick a limit.
- **Voiceover:** "Friends ask for money in Flick Chat. I get a notification, and pay with a flick, or let it pay by itself."
- **Caption:** Pays by itself, up to the limit you set

**2:07–2:13 · Safe: send it** (6 s · 14 words)
- **On screen:** Swarnim's chat with Maya: tap the lock button beside the $ button, type $20 and "chocolates" ("For what?"), tap the **14 days** chip, then **Give $20.00 for chocolates**. Flick at the camera; the sheet says "To Maya, in a Safe, from your PayPal". Split screen: both chats show the card "Safe · for chocolates", with Safe's blue hexagon face, "14 days left", "$20.00 left of $20.00" and a blue bar.
- **Voiceover:** "Safe is new. I give Maya twenty dollars for chocolates, locked to that purpose."
- **Caption:** Safe · $20 for chocolates · 14 days

**2:13–2:22 · Safe: spend it** (9 s · 20 words)
- **On screen:** Maya taps **Snap the receipt** (the card says "Only what's for chocolates comes out. Each receipt counts once.") and snaps the printed receipt: Chocolates $8.40, Phone charger $6.00, total $14.40. "Safe is checking it…", then the receipt card, "Maya spent from the Safe for chocolates": "A receipt · [the day] · $14.40", ✓ Chocolates, ✗ Phone charger struck through, "Safe paid Maya back $8.40". Cut to Swarnim's phone: the notification, then his chat: "$6.00 waits for you: Phone charger isn't for chocolates." He taps **Don't allow**: "Not allowed: $6.00."
- **Voiceover:** "She snaps the receipt. AI reads it. Rules decide. She's paid back for the chocolates. The charger waits for me."
- **Caption:** Chocolates $8.40: paid back to Maya · Phone charger $6.00: waits for Swarnim

**2:22–2:29 · Safe: reused, then closed** (7 s · 17 words)
- **On screen:** Maya snaps the same receipt again: "Not taken: This receipt was already used, on [the day]." Swarnim taps **Close it and get $11.60 back**: the card reads "$11.60 went back to your PayPal".
- **Voiceover:** "The same receipt again? Refused. I close the Safe, and the rest goes back to my PayPal."
- **Caption:** Already used · $11.60 refunded from the original payment

**2:29–2:38 · Scout** (9 s · 20 words)
- **On screen:** `/scout`. The usuals' price grid: best store this week, 12-week sparklines, one marked "rising". Open Eggs → **Real prices at online stores** → Channel3's offers, cheapest first, with buy links. Back, buy at the cheapest store, flick, paid.
- **Voiceover:** "Scout prices my usual groceries at every store, with real online prices from Channel3. One flick buys the cheapest basket."
- **Caption:** Live offers from Channel3

**2:38–2:43 · Ask Flick** (5 s · 11 words)
- **On screen:** `/ask`. Tap the mic and say "Remind Leo about dinner, and send Maya fifteen dollars for lunch as a Safe." The words fill the input; two cards come back with their agents' faces (Nudge, Safe). Approve both: the reminder goes, and the Safe is given from the saved PayPal at once, since approving the card is the yes. Keep the spoken request quiet under the voiceover.
- **Voiceover:** "I ask Flick out loud. Every action waits for my yes."
- **Caption:** Eleven actions, each a card you approve

**2:43–2:47 · Businesses on Flick** (4 s · 9 words)
- **On screen:** `/business`, signed in as the City Power sandbox business: its name on bills, "City Power", and the $64.20 Flick paid it in the Lens beat.
- **Voiceover:** "Businesses on Flick get paid at their own PayPal."
- **Caption:** A bill's name → that business's PayPal

**2:47–2:54 · Money Studio** (7 s · 16 words)
- **On screen:** `/dashboard`. The built-in report; drag **Who owes you** and **Week timeline** from the *Flick* group onto a page; ask Studio's assistant "Build a Sunday recap page" and the page appears (sped up).
- **Voiceover:** "Money Studio is AG Studio, with our own widgets. Its AI builds new pages on request."
- **Caption:** AG Studio · two Flick widgets · Studio's AI

**2:54–3:00 · Install Flick now** (6 s · 7 words)
- **On screen:** `cards/install-now.mp4` as it is: the logo flicks, then "Install Flick now", flickit.site and the QR code.
- **Voiceover:** (from 2:56, after the logo's flick) "Install Flick now, at flickit dot site."
- **Caption:** none; the card has it.

---

## Recording checklist

**Before recording**
- Safe is live on www.flickit.site and Railway (`npm run e2e` gives, spends, refuses and refunds one for real on the sandbox). The button names in this script are the build's.
- `npm run check` in `backend/` passes: Orders, Vault, Payouts, Invoicing, Transaction Search, the AI, and Studio's Responses API.
- Sandbox accounts (developer.paypal.com → Sandbox → Accounts):
  - **Swarnim**, personal: signed in, PayPal saved. Friends: Maya (on Flick) and Leo (an email that has never signed in, so he gets invoices).
  - **Maya**, personal: signed in on a second phone or browser, with Swarnim as a friend.
  - **City Power**, business: signed in on `/business` with the name "City Power".
- History: a new sign-in starts empty. A day ahead, give Swarnim's Flick enough past payments for Autopilot to plan a week with one flagged payment, and enough grocery receipts for Scout's usuals.
- Props, printed on paper: `props/city-power-bill.png`, `props/mama-lus-receipt.png`, and the Safe receipt. Have `props/northwind-mobile-ebill.pdf` on the phone. Make a bill in rupees for the currency shot.
- The Safe receipt: a shop not on Flick (so Safe pays Maya back), dated the recording day, Chocolates $8.40, Phone charger $6.00, total $14.40, no tax line. Keep the charger under $11.60: Safe never asks for more than is left. Print it: Safe treats a photo of a screen as a sign of a fake.
- Both phones, Swarnim's and Maya's: Flick installed from `/install`, notifications on (Safe notifies both ways), Do Not Disturb for everything else.
- Screens at 1920×1080, 30 fps, one theme throughout, no other tabs or bookmarks showing.

**Record in this order** (each step builds on the one before)
1. City Power registers on `/business` (Lens needs it).
2. Swarnim signs in on `/login`, in a fresh browser so PayPal's page shows.
3. `/lens`: the City Power bill with a flick, the PDF e-bill, the rupee bill.
4. `/autopilot`.
5. `/split`, then `/nudge`.
6. `/chat`: Maya's request, the notification, the flick, Pays by itself.
7. Safe: send, Maya's receipt, decline the charger, the same receipt again, close.
8. `/scout`.
9. `/ask`, by voice.
10. `/business` as City Power, now showing the $64.20.
11. `/dashboard`, last, so its tables hold the day's payments.
12. The diagrams: `architecture.svg` and `money.svg` in a browser, with slow zooms and pans.

If a PayPal call fails, take the beat again rather than cutting around it.

**Edit**
- Intro clips from the Wan cut ([wan.md](wan.md)), plus the one new placard shot.
- Voiceover recorded on its own, calm, about 130 words a minute. Captions small, white, lower third, as in `subtitles-30s.srt`.
- The same whoosh and chime on every "Paid", as in the intro.

**The hackathon's rules**
- **Under 3 minutes.** This plan is 3:00 to the frame, so end the voiceover by 2:58 and export at 2:59, trimming the end card's last second.
- **Public on YouTube**, with the link on Devpost.
- **No unlicensed music.** Use a licensed track (YouTube's Audio Library, for example), low under the voiceover. Keep generator music off.
