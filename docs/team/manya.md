# Manya: Test & sandbox track

Hi Manya! You're on **Test & sandbox**: making sure every flow works for real, on desktop and on a phone, with good data for the judges and the video. You need no code for this; you need a PayPal developer login, a phone, and a sharp eye.

## Flick in one minute

Flick is our PayPal AI Hackathon entry: **snap anything you need to pay, and Flick pays it**. Four AI agents do the work:

- **Lens** reads a photo of a bill, receipt, price tag or tip jar and pays it through a PayPal checkout.
- **Autopilot** plans the week's payments, takes one PayPal approval, then pays each one on its day.
- **Splitter** splits a receipt and sends each friend a PayPal invoice.
- **Nudge** writes reminders and sends them through PayPal.
- **Ask Flick** is an agent over all four: you type what you want, it plans, you approve.
- **Money Studio** is a dashboard over all of it, which an AI can build for you.

| | |
|---|---|
| Live site | https://flick-frontend-woad.vercel.app |
| Repo (bugs go in Issues) | https://github.com/minrawsjar/Flick/issues |
| PayPal developer dashboard | https://developer.paypal.com (keep the toggle on **Sandbox**) |
| PayPal sandbox site (log in as test accounts) | https://www.sandbox.paypal.com |

**Important:** the one-pager at `/` is a *demo*: its animations aren't real. The pages in the top navbar (**Ask Flick, Lens, Autopilot, Split, Nudge, Friends, Money Studio**) are *live*: they use real AI and the real PayPal sandbox. Test those.

## Who does what

| Who | Track | You hand them |
|---|---|---|
| **Manya (you)** | Test & sandbox | |
| Utkarsh | Build: Money Studio widgets and agent, bug fixes | Bugs, as GitHub issues |
| Umang | Story & submission: video, Devpost | Sandbox logins for the video and for judges; your best real photos |
| Swarnim | Reviews and merges, deploys | Anything blocking you |

## Timeline (IST)

| When | What |
|---|---|
| **Tue 10 Nov** | Task 1 (accounts). Start task 2 (test pass 1). |
| **Wed 11 Nov** | Finish test pass 1; file bugs. Collect photos (task 4). |
| **Thu 12 Nov, 14:00** | Feature freeze. Test pass 2 on whatever changed. Then task 3 (demo data) before Umang records. |
| **Thu 12 Nov, 23:30** | We submit. |

## Ground rules

- **Never put passwords in GitHub**, not in issues and not in files. Share sandbox logins in the team chat only.
- **The live site's data is shared.** Ask Swarnim before anything that resets it.
- Sandbox money is fake, so pay, refund and invoice as much as you like.

## Task 1: Sandbox accounts (do this first)

Our PayPal app runs on a **US** sandbox business account (India accounts can't send payouts). The friends and the person paying should be US accounts too.

1. developer.paypal.com → **Sandbox** → **Testing Tools → Sandbox Accounts → Create account**:
   - one **Personal, United States**: this is **"You"**, the person who approves payments on PayPal's page;
   - three more **Personal, United States**: for **Maya**, **Leo** and **Priya**.
2. For each, open **⋮ → View/edit account** and note the email and password (in the team chat, not GitHub).
3. On the live site, open **Friends**, and change Maya's, Leo's and Priya's emails (the pencil) to their new sandbox emails.

**Done when:** each friend's row on `/friends` shows their sandbox email, and you can log in to https://www.sandbox.paypal.com as each of them.

## Task 2: Test every flow (pass 1 Wed, pass 2 after the freeze)

Test on a laptop (Chrome or Safari) **and** a phone. For each step, note whether it did what's written. Anything that doesn't is a bug (see the end of this task).

### Lens (`/lens`)
- [ ] Tap each sample (bill, receipt, price tag, tip jar): the phone shows a scan, then the result card; "What Lens read" fills in with sensible values.
- [ ] On the **bill**: tap **Pay with PayPal** → PayPal's sandbox page opens → log in as **You** → approve → you're back on `/lens` with a "Paid with PayPal" message.
- [ ] **Snap your own** on your phone: a real electricity or phone bill, a restaurant receipt, a price tag, a tip-jar QR. Note anything Lens reads wrong (amount, date, name).
- [ ] On a receipt, **Split with 3 friends** takes you to `/split` with that receipt's items.

### Autopilot (`/autopilot`)
- [ ] Change an amount and a day in the grid; the phone updates.
- [ ] **Approve with PayPal** → approve as **You** → back on `/autopilot`, every payment now "Scheduled".
- [ ] **Next day** until Sunday: payments turn "Paid" on their days. In the developer dashboard (or logged in as the business account) you can see the payouts.
- [ ] After approving, skip one (via Ask Flick: "skip the coffee tip"): it shows "Skipped", and You get that money refunded.
- [ ] **Plan next week** on Sunday plans a new week.

### Split (`/split`)
- [ ] Type a sentence in **Tick it for me** ("Maya and I shared the salmon, Leo had the miso, we all had tea"): the ticks match what you said.
- [ ] **Send 3 PayPal requests**: each friend shows "Sent", and the invoice links open.
- [ ] Log in to sandbox.paypal.com as **Maya**: the invoice is there. **Pay it.**

### Nudge (`/nudge`)
- [ ] Pick a friend and each tone: a new draft appears (written by AI).
- [ ] **Send**: log in as that friend; there's a reminder email or notification.
- [ ] **Check who's paid**: Maya (paid above) shows "Paid you back".

### Friends (`/friends`)
- [ ] Add a friend; they appear as a new column on `/split`.
- [ ] Bad email or duplicate name: a clear error. Removing someone who still owes you: refused, with a reason.

### Ask Flick (`/ask`)
- [ ] Each of the four suggestion chips gives a sensible answer or plan.
- [ ] Try three of your own, e.g. "split my last receipt with Maya and Priya", "remind Leo, make it funny", "approve my week".
- [ ] On the approval card, say **yes** to one action and **no** to another: only the yes runs.
- [ ] Ask "what was that bill again?" after a few messages; it should remember the conversation.

### Money Studio (`/dashboard`)
- [ ] The **This week**, **Owed to you** and **Agents** pages show data.
- [ ] Open the AI chat, try "Build my Sunday recap": it adds widgets.

### Everywhere
- [ ] Light and dark mode (the sun/moon button): nothing unreadable.
- [ ] On a phone: every page fits, nothing scrolls sideways, the navbar's second row scrolls.
- [ ] The one-pager (`/`): everything animates, the scrolling band never has a gap.

### Filing a bug

Open a **GitHub issue** at https://github.com/minrawsjar/Flick/issues with:

- **Title**: page + what's wrong ("/split: invoice link opens a blank page")
- **Steps**, **expected**, **what happened**, device and browser, and a screenshot or screen recording.
- A label: **P0** (breaks the demo: fix first), **P1** (looks wrong or confusing), **P2** (nice to fix).

Then tell Utkarsh in the chat about any P0.

**Done when:** every box above is ticked or has an issue, for laptop and phone.

## Task 3: Demo data (Thu, after the freeze, before Umang records)

The video and the judges should see a lived-in Flick, not an empty one. With Swarnim (who resets the live backend):

1. Reset the live demo to its starting data.
2. Set the friends' sandbox emails again (task 1, step 3).
3. Snap one real receipt in Lens and split it, so Money Studio has a real split.
4. Leave the week **unapproved** at Sunday, so Umang can approve it on camera.

**Done when:** `/autopilot` shows the six planned payments, `/nudge` shows Leo and Maya owing money, and Money Studio's pages all have data.

## Task 4: Photos and logins for Umang

- [ ] 6 to 8 **real photos** that Lens reads perfectly: a bill, a receipt, a price tag, a tip-jar QR. Clear, flat, good light. Share the best in the chat.
- [ ] A **judges' login**: the **You** sandbox account's email and password, for the Devpost submission. Send it to Umang privately.
