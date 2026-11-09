# Umang: Ask Flick & PayPal webhooks

Hi Umang! You own **Ask Flick** (`/ask`), the AI agent that plans across all of Flick, and **PayPal webhooks**, so Flick hears about payments the moment they happen. This is the heart of the **Agentic Commerce** prize.

**First:** follow [`setup.md`](setup.md) to run Flick locally with your own PayPal sandbox and AI key. You need both.

## Flick in one minute

Snap anything you need to pay, and Flick pays it. **Lens** reads photos of bills and receipts; **Autopilot** plans and pays the week with one PayPal approval; **Splitter** invoices friends; **Nudge** reminds them. **Ask Flick** is one conversation over all four: the AI reads your real data through tools, plans, and proposes actions, and **nothing runs until you approve it**.

## Your area

```
backend/src/agent.ts                  Ask Flick: tools, the plan-then-approve loop
backend/src/checkout.ts, server.ts    PayPal's return after a checkout (webhooks join it here)
backend/src/nudge.ts                  checking which invoices are paid
backend/src/paypal.ts                 every PayPal call
frontend/app/_landing/ask.tsx         the /ask page and the one-pager's scripted version
```

New files are yours: `backend/src/webhooks.ts`, and its tests. Others: Utkarsh owns Money Studio; Manya owns Autopilot and Lens, and will ask you before adding one line to `overview()` in `agent.ts`.

## Task 1: PayPal webhooks (do this first)

Today Flick only learns that a friend paid when someone presses **Check who's paid**, and a checkout only completes if the person comes back from PayPal's page. Webhooks fix both.

**Build `POST /api/paypal/webhook`:**

1. **Verify every event with PayPal** before trusting it: `POST /v1/notifications/verify-webhook-signature` with the `paypal-transmission-*` and `paypal-auth-algo` / `paypal-cert-url` headers, your `PAYPAL_WEBHOOK_ID` (a new env var) and the event body. Only `verification_status: "SUCCESS"` gets processed. Answer 200 quickly either way, so PayPal doesn't keep retrying.
2. **Handle:**
   - `INVOICING.INVOICE.PAID`: mark that request paid (match `debt.invoiceId`), and log "Maya paid you back" as Nudge activity.
   - `PAYMENT.PAYOUTS-ITEM.SUCCEEDED`, `…FAILED`, `…UNCLAIMED`: update that week payment (the payout's `sender_item_id` is the payment's id).
   - `CHECKOUT.ORDER.APPROVED`: capture it if it's still waiting. That covers someone closing the tab on PayPal's page before coming back. Reuse what `/api/paypal/return` does in `server.ts` rather than copying it: pull it into one function both use.
3. **Apply each event only once:** remember the last 200 event ids in the state.
4. **Tests:** keep the handling a plain function (`applyEvent(state, event)`) that you can test without the network.

**To test it locally,** PayPal needs a public HTTPS address for your laptop: run `cloudflared tunnel --url http://localhost:4000` (or ngrok), then in your sandbox app → **Webhooks → Add Webhook**, enter `https://<your-tunnel>/api/paypal/webhook`, tick those events, and copy the **Webhook ID** into `backend/.env`. Try the **Webhook Simulator** (developer dashboard → Testing Tools), then real flows.

**Done when:**
- [ ] Paying a split invoice as a friend (log in at sandbox.paypal.com) turns that friend to "Paid you back" on `/nudge` within seconds, with no button pressed.
- [ ] Approving the week on PayPal and **closing the tab** still captures it.
- [ ] An event with a bad signature changes nothing.
- [ ] `npm test` covers each event type and a repeated event.

Document `PAYPAL_WEBHOOK_ID` in `backend/env.example`, and the route in the README's Routes table.

## Task 2: Talk to Flick

Flick's design comes from Air Agents, a voice-first app: let people talk to Ask Flick too. Use the browser's built-in speech, no libraries:

- A **mic button** in `/ask`'s input bar, using the Web Speech API (`SpeechRecognition`, which is `webkitSpeechRecognition` in Chrome and Safari). Tap to talk; the words appear in the input as you speak; it sends when you stop.
- A **"Read replies aloud"** switch using `speechSynthesis`.
- Hide the mic where the browser can't do it (Firefox), and handle "microphone permission denied" gracefully.

**Done when:** it works in Chrome on a laptop, Safari on an iPhone and Chrome on Android. Browsers only allow the microphone on `localhost` or HTTPS, so to try it on your phone, open a second tunnel to the site (`cloudflared tunnel --url http://localhost:3000`) and visit that HTTPS address; the site passes `/api` on to your local backend by itself.

## Task 3: Better approval cards

On `/ask`, the "Needs your OK" card lists actions as text. Make it clearer:

- Show **which agent** each action belongs to, with its bot face: paying a scan is Lens, the week is Autopilot, a split is Splitter, a reminder is Nudge. Return an `agent` field with each pending action from `agent.ts`.
- After you decide, keep the card in the conversation as a receipt: ✓ or ✗ on each line.
- When an action opens a PayPal checkout, put the **Approve on PayPal** button inside its line, not below the conversation.

**Done when:** a request with three actions across three agents shows three faces, and the card stays readable after you've decided.

## When you're stuck

[`agent.ts`](../../backend/src/agent.ts) starts with a comment explaining the plan-then-approve loop, and the README's "The backend" section explains the money flow. Then Swarnim.
