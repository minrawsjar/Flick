import { chat, type ChatMessage, type Tool, type ToolCall } from './ai.ts';
import * as autopilot from './autopilot.ts';
import * as friends from './friends.ts';
import { HttpError, need } from './http.ts';
import * as lens from './lens.ts';
import { cents, DAYS, usd, ymd } from './model.ts';
import * as nudge from './nudge.ts';
import * as scout from './scout.ts';
import { shares, unapproved, type SplitItem } from './rules.ts';
import { split } from './split.ts';
import { friend, payee, state } from './store.ts';

// Ask Flick: an agent on top of the four. It reads the person's real state through tools, plans,
// and proposes actions (pay a bill, approve the week, split a receipt, remind a friend...). Reads run
// on their own; every action comes back as a pending card and only runs once the person approves it
// (POST /api/agent/decide). Money that leaves through a checkout is approved again on PayPal's page.
//
// The conversation lives in the browser and comes back with each request (OpenAI's chat format).

const MAX_STEPS = 6;

const PROMPT = () => `You are Flick, a payments assistant inside the Flick app. Today is ${ymd(new Date())}.
Flick's agents: Lens reads photos of bills, receipts, price tags and tip jars; Autopilot plans the week's
payments and pays each on its day after one PayPal approval (or by itself, with PayPal saved for it);
Splitter splits receipts and sends friends PayPal invoices; Nudge reminds friends who owe money; Scout
knows the groceries the person buys again and again, prices them at every store and buys them.

How you work:
- Call get_overview first, and again after changes, to see the person's real data. Never invent payees,
  amounts, people or ids: use only what it returns. "you" is the person; friends have their own ids.
- To do something, call the action tools. Every action is shown to the person to approve before it runs,
  and you get the outcome back. Propose everything a request needs in one go.
- Paying a scan, approving the week or buying groceries opens PayPal for the person to approve the payment;
  say so. With PayPal saved for Autopilot, approving the week pays it straight away instead.
- For groceries, call get_groceries: buy at the cheapest store that has everything, unless the person
  names one, and say what it saves against where they usually shop and what's getting dearer.
- For a split, use the receipt's own items, prices, tax and tip, and the people the person names.
- Point out anything unusual: a payment well above its usual amount, a request open a long time.
- Answer briefly and plainly, in dollars. No markdown tables or headings.`;

// --- What the agent can see ----------------------------------------------------------------

function overview() {
  const { week } = state;
  const usual = new Map<string, number[]>();
  for (const p of state.history) usual.set(p.payeeId, [...(usual.get(p.payeeId) ?? []), p.amount]);
  return {
    today: week.today < 0 ? `the Sunday before the week of ${week.starts} (planning day)` : `${DAYS[week.today]}, week of ${week.starts}`,
    week: {
      approval: week.approval?.status ?? 'not approved',
      payments: week.payments.map((p) => ({ id: p.id, payee: p.payee, what: p.what, amount: p.amount, day: p.day, status: p.status, why: p.why })),
    },
    usual_amounts: [...usual].map(([id, amounts]) => ({ payee: payee(id)?.name ?? id, average: cents(amounts.reduce((a, b) => a + b, 0) / amounts.length), times: amounts.length })),
    friends: state.friends.map((f) => ({ id: f.id, name: f.name, paypal_email: f.email })),
    owed_to_you: state.debts
      .filter((d) => d.status === 'requested')
      .map((d) => ({ request_id: d.id, friend: friend(d.friendId)?.name, friend_id: d.friendId, amount: d.amount, for: d.what, days_open: Math.round((Date.now() - Date.parse(d.createdAt)) / 86_400_000), reminders_sent: d.reminders })),
    recent_scans: state.scans.slice(0, 6).map((s) => ({
      scan_id: s.id,
      kind: s.kind,
      title: s.title,
      amount: s.amount,
      due: s.due,
      status: s.status,
      ...(s.kind === 'receipt' && { items: s.items, tax: s.tax, tip: s.tip }),
    })),
    recent_activity: state.activity.slice(0, 8).map((a) => `${a.at.slice(0, 10)} ${a.agent}: ${a.text}`),
  };
}

/** Scout's view, cut down to what the agent needs: the next shop at every store, and the usuals' trends. */
function groceries() {
  const v = scout.view();
  const name = (id: string) => v.products.find((p) => p.id === id)?.name ?? id;
  const store = (id: string) => v.stores.find((s) => s.id === id)!;
  return {
    today: v.today,
    usual_store: store(v.basket.usualStore).name,
    next_shop: v.basket.items.map((i) => ({ product_id: i.productId, product: name(i.productId), qty: i.qty })),
    quotes: v.basket.quotes.map((q) => ({
      store_id: q.storeId,
      store: store(q.storeId).name,
      where: store(q.storeId).kind === 'online' ? 'online' : `${store(q.storeId).miles} miles away`,
      total: q.total,
      delivery: q.delivery,
      missing: q.missing.map(name),
    })),
    usuals: v.products.filter((p) => p.usual).map((p) => ({ product_id: p.id, product: p.name, bought: p.usual!.label, due: p.usual!.due, you_paid: p.usual!.last.price, best_now: p.offers[0].price, trend: p.forecast.verdict, next_4_weeks: `${Math.round(p.forecast.change * 100)}%` })),
    autopilot_pays_by_itself: Boolean(state.autopay),
  };
}

const READS: Record<string, { label: string; run: () => unknown }> = {
  get_overview: { label: 'Read your week, scans, friends and requests', run: overview },
  get_groceries: { label: "Priced your usual groceries at every store", run: groceries },
};

// --- What the agent can do, once approved --------------------------------------------------

type Args = Record<string, unknown>;
type Link = { label: string; url: string };
type Action = { summary: (args: Args) => string; run: (args: Args) => Promise<{ result: unknown; link?: Link }> };

/** The agent's grocery list as Scout's items. */
const basketOf = (items: unknown) =>
  (Array.isArray(items) ? items : []).map((i: { product_id?: unknown; qty?: unknown }) => ({ productId: i?.product_id, qty: i?.qty ?? 1 }));
const scanOf = (id: unknown) => state.scans.find((s) => s.id === id) ?? fail(`No scan ${String(id)}`);
const paymentOf = (id: unknown) => state.week.payments.find((p) => p.id === id) ?? fail(`No payment ${String(id)} this week`);
const debtOf = (id: unknown) => state.debts.find((d) => d.id === id) ?? fail(`No request ${String(id)}`);
function fail(message: string): never {
  throw new HttpError(400, message);
}

const ACTIONS: Record<string, Action> = {
  pay_scan: {
    summary: ({ scan_id, every_month }) => {
      const s = scanOf(scan_id);
      return `Pay ${s.title} ${usd(s.amount)} with PayPal${every_month ? ', and every month from now' : ''}`;
    },
    run: async ({ scan_id, every_month }) => {
      const { approveUrl, amount } = await lens.pay({ scanId: scan_id, repeat: every_month === true });
      return { result: { opened_paypal_checkout: true, amount }, link: { label: `Approve ${usd(amount)} on PayPal`, url: approveUrl } };
    },
  },
  approve_week: {
    summary: () => {
      const waiting = unapproved(state.week);
      need(waiting.length, 'Nothing in this week is waiting for approval.');
      return `Approve this week's ${waiting.length} payments, ${usd(waiting.reduce((s, p) => s + p.amount, 0))}, with PayPal`;
    },
    run: async () => {
      const { approveUrl, amount } = await autopilot.approve();
      if (!approveUrl) return { result: { paid_with_saved_paypal: true, amount } };
      return { result: { opened_paypal_checkout: true, amount }, link: { label: `Approve the week on PayPal, ${usd(amount)}`, url: approveUrl } };
    },
  },
  buy_groceries: {
    summary: ({ store_id, items }) => {
      const q = scout.priceBasket({ items: basketOf(items) }).find((x) => x.storeId === store_id) ?? fail(`No store ${String(store_id)}`);
      const v = scout.view();
      const usual = scout.priceBasket({ items: basketOf(items) }).find((x) => x.storeId === v.basket.usualStore);
      const saving = usual && !usual.missing.length && usual.storeId !== q.storeId ? usual.total - q.total : 0;
      const store = v.stores.find((s) => s.id === store_id)!.name;
      return `Buy ${q.lines.length} groceries at ${store}, ${usd(q.total)}${q.delivery ? ` with ${usd(q.delivery)} delivery` : ''}, with PayPal${saving > 0.005 ? ` (${usd(saving)} less than your usual store)` : ''}`;
    },
    run: async ({ store_id, items }) => {
      const { approveUrl, amount } = await scout.buy({ storeId: store_id, items: basketOf(items) });
      return { result: { opened_paypal_checkout: true, amount }, link: { label: `Approve ${usd(amount)} on PayPal`, url: approveUrl } };
    },
  },
  change_payment: {
    summary: ({ payment_id, amount, day }) => {
      const p = paymentOf(payment_id);
      return `Change ${p.payee} to ${usd(typeof amount === 'number' ? amount : p.amount)} on ${typeof day === 'string' ? day : p.day}`;
    },
    run: async ({ payment_id, amount, day }) => ({ result: (await autopilot.edit({ id: payment_id, amount, day })).payments.find((p) => p.id === payment_id) }),
  },
  skip_payment: {
    summary: ({ payment_id }) => {
      const p = paymentOf(payment_id);
      return `Skip ${p.payee}, ${usd(p.amount)}, this week${p.status === 'scheduled' ? ' (refunded to you)' : ''}`;
    },
    run: async ({ payment_id }) => ({ result: (await autopilot.edit({ id: payment_id, skip: true })).payments.find((p) => p.id === payment_id) }),
  },
  next_day: {
    summary: () => `Move the week on to ${DAYS[state.week.today + 1] ?? 'next week'} and pay what's due`,
    run: async () => {
      const week = await autopilot.tick();
      return { result: { today: DAYS[week.today], paid_so_far: week.payments.filter((p) => p.status === 'paid').map((p) => p.payee) } };
    },
  },
  split_bill: {
    summary: ({ merchant, items, tax, tip }) => {
      need(Array.isArray(items) && items.length, 'items must list what was on the bill.');
      const { total, each } = shares(items as SplitItem[], Number(tax) || 0, Number(tip) || 0);
      const parts = Object.entries(each)
        .filter(([id, amount]) => id !== 'you' && amount > 0)
        .map(([id, amount]) => `${friend(id)?.name ?? id} ${usd(amount)}`);
      return `Split ${String(merchant)}, ${usd(total)}: send PayPal invoices to ${parts.join(', ') || 'nobody'} (you pay ${usd(each.you ?? 0)})`;
    },
    run: async (args) => {
      const { total, debts, failed } = await split({ merchant: args.merchant, items: args.items, tax: Number(args.tax) || 0, tip: Number(args.tip) || 0 });
      return { result: { total, invoiced: debts.map((d) => ({ friend: friend(d.friendId)?.name, amount: d.amount })), failed } };
    },
  },
  remind_friend: {
    summary: ({ request_id, tone }) => {
      const d = debtOf(request_id);
      return `Send ${friend(d.friendId)?.name} a ${String(tone ?? 'friendly').toLowerCase()} PayPal reminder about ${d.what}, ${usd(d.amount)}`;
    },
    run: async ({ request_id, tone }) => {
      const { text } = await nudge.draft({ debtId: request_id, tone });
      await nudge.send({ debtId: request_id, text });
      return { result: { sent: text } };
    },
  },
  add_friend: {
    summary: ({ name, email }) => `Add ${String(name)} as a friend, PayPal ${String(email)}`,
    run: async (args) => ({ result: friends.add(args) }),
  },
};

const object = (properties: object, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });
const fn = (name: string, description: string, parameters: object): Tool => ({ type: 'function', function: { name, description, parameters } });

const TOOLS: Tool[] = [
  fn('get_overview', "The person's week, usual amounts, friends, who owes them, recent scans (with receipt items) and activity.", object({})),
  fn('pay_scan', 'Pay a bill, product or tip that Lens read, through a PayPal checkout.', object({ scan_id: { type: 'string' }, every_month: { type: 'boolean', description: 'Also pay this bill every month.' } }, ['scan_id'])),
  fn('approve_week', "Approve all of this week's planned payments with one PayPal checkout.", object({})),
  fn('change_payment', "Change a planned payment's amount or day, before the week is approved.", object({ payment_id: { type: 'string' }, amount: { type: 'number' }, day: { type: 'string', enum: [...DAYS] } }, ['payment_id'])),
  fn('skip_payment', "Skip one of this week's payments (refunded if it was already approved).", object({ payment_id: { type: 'string' } }, ['payment_id'])),
  fn('next_day', "Move the week on a day; Autopilot pays whatever's due.", object({})),
  fn(
    'split_bill',
    'Split a bill and send each friend a PayPal invoice for their share. Each item is shared by the people who had it; tax and tip follow each share.',
    object(
      {
        merchant: { type: 'string' },
        items: {
          type: 'array',
          items: object({ name: { type: 'string' }, price: { type: 'number' }, people: { type: 'array', items: { type: 'string' }, description: 'Ids: "you" and friend ids.' } }, ['name', 'price', 'people']),
        },
        tax: { type: 'number' },
        tip: { type: 'number' },
      },
      ['merchant', 'items', 'tax', 'tip'],
    ),
  ),
  fn('remind_friend', 'Send a friend who owes money a reminder, written in the chosen tone, through PayPal.', object({ request_id: { type: 'string' }, tone: { type: 'string', enum: [...nudge.TONES] } }, ['request_id', 'tone'])),
  fn('add_friend', 'Add a friend by the email of their PayPal account.', object({ name: { type: 'string' }, email: { type: 'string' } }, ['name', 'email'])),
  fn('get_groceries', "Scout's view: the person's usual groceries (what, how often, what they paid), the next shop priced at every store with delivery, and which prices are rising.", object({})),
  fn(
    'buy_groceries',
    'Buy groceries at one store with one PayPal checkout. Use product ids from get_groceries.',
    object(
      {
        store_id: { type: 'string', description: 'A store_id from get_groceries.' },
        items: { type: 'array', items: object({ product_id: { type: 'string' }, qty: { type: 'integer' } }, ['product_id', 'qty']) },
      },
      ['store_id', 'items'],
    ),
  ),
];

// --- The conversation -----------------------------------------------------------------------

type Pending = { id: string; summary: string };
type Turn = { messages: ChatMessage[]; reply?: string; pending?: Pending[]; links: Link[]; steps: string[] };

const plain = (text: string) =>
  text
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g, '$1$2')
    .replace(/(^|\s)[*_]([^*_\s][^*_]*?)[*_](?=[\s.,!?]|$)/g, '$1$2')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1');

const args = (call: ToolCall): Args => {
  try {
    const parsed = JSON.parse(call.function.arguments || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};
const toolMessage = (call: ToolCall, content: unknown): ChatMessage => ({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(content) });
const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Tool calls in the last assistant message that haven't had an answer yet. */
function openCalls(messages: ChatMessage[]) {
  const last = [...messages].reverse().find((m) => m.role === 'assistant');
  if (!last || last.role !== 'assistant' || !last.tool_calls) return [];
  const answered = new Set(messages.filter((m) => m.role === 'tool').map((m) => (m as { tool_call_id: string }).tool_call_id));
  return last.tool_calls.filter((c) => !answered.has(c.id));
}

async function run(messages: ChatMessage[], links: Link[] = [], steps: string[] = []): Promise<Turn> {
  for (let step = 0; step < MAX_STEPS; step++) {
    const reply = await chat([{ role: 'system', content: PROMPT() }, ...messages], TOOLS);
    // The chat shows plain text: models add markdown anyway (**bold**, headings), so it goes.
    if (reply.content) reply.content = plain(reply.content);
    messages.push(reply);
    if (!reply.tool_calls) return { messages, reply: reply.content ?? '', links, steps };

    const pending: Pending[] = [];
    for (const call of reply.tool_calls) {
      const read = READS[call.function.name];
      const action = ACTIONS[call.function.name];
      if (read) {
        messages.push(toolMessage(call, read.run()));
        if (!steps.includes(read.label)) steps.push(read.label);
      } else if (action) {
        try {
          pending.push({ id: call.id, summary: action.summary(args(call)) });
        } catch (err) {
          // A proposal that can't work goes straight back to the model, not to the person.
          messages.push(toolMessage(call, { error: errorText(err) }));
        }
      } else {
        messages.push(toolMessage(call, { error: `There is no tool called ${call.function.name}.` }));
      }
    }
    // Actions wait for the person; their calls are answered in decide().
    if (pending.length) return { messages, pending, links, steps };
  }
  return { messages, reply: "I went round in circles there. Could you ask that more simply?", links, steps };
}

function checkMessages(raw: unknown): ChatMessage[] {
  need(Array.isArray(raw) && raw.length <= 80, 'messages must be the conversation so far (at most 80).');
  return (raw as ChatMessage[]).map((m) => {
    need(m && typeof m === 'object' && ['user', 'assistant', 'tool'].includes(m.role), 'Each message needs a role of user, assistant or tool.');
    if (m.role === 'user') {
      need(typeof m.content === 'string' && m.content.trim() && m.content.length <= 2000, 'Messages are 1 to 2,000 characters.');
      return { role: 'user', content: m.content };
    }
    if (m.role === 'tool') return { role: 'tool', tool_call_id: String(m.tool_call_id), content: String(m.content).slice(0, 20_000) };
    // Only the assistant is left: the role check above turned everything else away.
    const a = m as Extract<ChatMessage, { role: 'assistant' }>;
    const calls = Array.isArray(a.tool_calls)
      ? a.tool_calls.map((c) => ({ id: String(c.id), type: 'function' as const, function: { name: String(c.function?.name), arguments: String(c.function?.arguments ?? '{}') } }))
      : undefined;
    return { role: 'assistant', content: typeof a.content === 'string' ? a.content.slice(0, 8000) : null, ...(calls?.length && { tool_calls: calls }) };
  });
}

/** A new message from the person. Any proposal they didn't decide on counts as declined. */
export async function ask(body: Record<string, unknown>) {
  const messages = checkMessages(body.messages);
  const last = messages.at(-1);
  need(last?.role === 'user', 'The last message must be from the person.');
  const user = messages.pop()!;
  for (const call of openCalls(messages)) messages.push(toolMessage(call, { declined: 'The person moved on without approving this.' }));
  messages.push(user);
  return run(messages);
}

/** The person's yes or no on each pending action. Approved ones run now; then the agent carries on. */
export async function decide(body: Record<string, unknown>) {
  const messages = checkMessages(body.messages);
  const decisions = (body.decisions ?? {}) as Record<string, unknown>;
  const calls = openCalls(messages);
  need(calls.length, 'There is nothing waiting for a decision.', 409);

  const links: Link[] = [];
  for (const call of calls) {
    const action = ACTIONS[call.function.name];
    if (!action || decisions[call.id] !== true) {
      messages.push(toolMessage(call, { declined: 'The person said no to this.' }));
      continue;
    }
    try {
      const { result, link } = await action.run(args(call));
      if (link) links.push(link);
      messages.push(toolMessage(call, { done: true, result }));
    } catch (err) {
      messages.push(toolMessage(call, { error: errorText(err) }));
    }
  }
  return run(messages, links);
}
