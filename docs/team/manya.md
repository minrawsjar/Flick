# Manya: Autopilot & Lens intelligence

Hi Manya! You own the "brains" of **Autopilot** and **Lens**: making Autopilot notice what's unusual and learn monthly bills, and making Lens remember what you've snapped. Most of this is plain, testable TypeScript, the rules Flick's money depends on, plus the screens that show it.

**First:** follow [`setup.md`](setup.md) to run Flick locally with your own PayPal sandbox. Tasks 1 and 2 need **no AI key** (they're rules and tests); task 3 needs one to read photos.

## Flick in one minute

Snap anything you need to pay, and Flick pays it. **Lens** reads a photo of a bill, receipt, price tag or tip jar and pays it through PayPal. **Autopilot** plans the week's payments from what it has seen (bills Lens read, monthly payments, weekly habits), takes one PayPal approval, and pays each on its day. **Splitter** and **Nudge** handle friends. **Ask Flick** plans across all of them.

## Your area

```
backend/src/rules.ts         the pure rules: planning the week, splitting, checking Lens (start here)
backend/src/rules.test.ts    their tests (npm test)
backend/src/seed.ts          the demo's starting data
backend/src/lens.ts          Lens: reading a photo, paying it
backend/src/model.ts         the data's types
frontend/app/_landing/autopilot.tsx   the Autopilot page's phone, grid and controls
frontend/app/_landing/lens.tsx        the Lens page
```

Others: Utkarsh owns Money Studio, Umang owns Ask Flick and webhooks. Umang may also add a route to `backend/src/server.ts`; coordinate if you both touch it.

## Task 1: Flag unusual payments (rules + screens)

Autopilot should notice when a payment is out of the ordinary, and say so.

**The rule** (in `rules.ts`, with tests): a planned payment is **unusual** when
- its amount is at least **25% above** that payee's average in history (with at least 2 past payments), or
- it's a payee Flick has **never paid before**.

**Where it shows:**
- On `/autopilot`: a small warning chip in the grid ("▲ 18% above usual" or "New payee") and a marker on the phone's row.
- Autopilot's message on the phone mentions it ("City Power is 18% higher than usual: worth a look before you approve.").
- Ask Flick sees it: add the flag to each payment in `overview()` in [`backend/src/agent.ts`](../../backend/src/agent.ts). It's one line; tell Umang, since that's his file.

**Make the demo show it:** in `seed.ts`, give City Power three monthly bills in the history, around $52 to $56, so this week's $64.20 is flagged. The tests in `rules.test.ts` that check the seeded week must still pass; update them if the plan legitimately changes.

**Done when:**
- [ ] `npm test` has new tests: above the threshold, just below it, a new payee, and too little history.
- [ ] After `curl -X POST localhost:4000/api/reset`, `/autopilot` flags City Power, and nothing else.
- [ ] Ask Flick, asked "anything unusual this week?", mentions City Power.

## Task 2: Learn monthly bills from history

Today Autopilot learns **weekly** habits by itself, but **monthly** payments only when someone ticks "Pay it every month" in Lens. Teach `planWeek` to spot them too:

- A payee paid in **at least 2 of the last 3 months**, within **±2 days** of the same day of the month, is monthly.
- If that day falls in this week, plan it, for the most recent amount, with a reason like "You've paid Mobile Co around the 12th for the last 3 months."
- Never plan the same payee twice in a day (a bill Lens read, or a monthly rule, wins).

**Done when:**
- [ ] Tests: a clear monthly pattern; one that's too irregular; one in a month that already has a bill from Lens.
- [ ] Nothing in the seeded week changes unexpectedly (or the tests say why).

## Task 3: Lens remembers what you snapped (needs an AI key)

When you snap your own photo, Lens forgets the picture: reload `/lens` and it shows a drawing instead.

- **Backend:** when Lens reads a photo, keep a small copy with the scan, a JPEG at most 480px wide (about 40 KB), as a data URL. Do the shrinking in the browser before upload: `/lens` already scales photos down in `shrink()` in `lens.tsx`. Keep photos only on the **10 newest** scans, so the state file stays small.
- **`/lens`:** show your photo (not the drawing) for the current scan, even after a reload. Add a **Recent scans** row under the phone or the tiles: thumbnail, title, amount and status (read, waiting for PayPal, paid). Tapping one shows it in the phone, ready to pay if it isn't paid yet.

**Done when:**
- [ ] Snap your own → reload → your photo is still there.
- [ ] Recent scans lists the last few, and tapping a bill you haven't paid lets you pay it through your sandbox.
- [ ] `backend/.data/state.json` stays well under 1 MB after 20 snaps.

## When you're stuck

`rules.ts` is short and every function has a comment saying what it's for. The README's "The backend" section explains the money flow. Then Swarnim.
