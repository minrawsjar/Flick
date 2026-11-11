import { aiKey, askJson } from './ai.ts';
import * as chat from './chat.ts';
import { HttpError, need } from './http.ts';
import { usd, type Debt, type Friend } from './model.ts';
import { getInvoice, remindInvoice, sendInvoice } from './paypal.ts';
import { friend, log, save, state } from './store.ts';

// Nudge: drafts a reminder for a friend who owes you, in the tone you pick, and sends it as PayPal's
// own invoice reminder (or as the first request, if no invoice went out yet), or into your Flick
// Chat for a request made there (chat.ts). It also checks which invoices have been paid.

export const TONES = ['Friendly', 'Funny', 'Straight'] as const;
type Tone = (typeof TONES)[number];

const daysSince = (iso: string) => Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 86_400_000));

function find(debtId: unknown) {
  const debt = state.debts.find((d) => d.id === debtId);
  if (!debt) throw new HttpError(404, `No request ${String(debtId)}`);
  const who = friend(debt.friendId);
  if (!who) throw new HttpError(404, `No friend ${debt.friendId}`);
  return { debt, who };
}

// When AI is off, Nudge still works, with these.
const templates: Record<Tone, (who: Friend, debt: Debt, days: number) => string> = {
  Friendly: (who, d) => `Hey ${who.name}! Whenever you get a sec, it's ${usd(d.amount)} for ${d.what}. Link's below, no rush.`,
  Funny: (who, d) => `${who.name}, ${d.what} was great. The ${usd(d.amount)} would be even better. Settle up whenever!`,
  Straight: (who, d, days) => `Hi ${who.name}, ${usd(d.amount)} for ${d.what} has been open ${days} days. Here's the PayPal link.`,
};

const SCHEMA = { type: 'object', additionalProperties: false, required: ['message'], properties: { message: { type: 'string' } } };

/** A reminder in the chosen tone, written by the AI model (or a template when AI is off). */
export async function draft(body: Record<string, unknown>) {
  const { debt, who } = find(body.debtId);
  const tone = TONES.find((t) => t === body.tone) ?? 'Friendly';
  const days = daysSince(debt.createdAt);
  if (!aiKey()) return { text: templates[tone](who, debt, days), by: 'template' as const };

  const { message } = await askJson<{ message: string }>('nudge_draft', SCHEMA, [
    {
      role: 'system',
      content: `You are Nudge, inside Flick, a payments app. Write one short message (at most 240 characters) from the person to a friend who owes them money, in a ${tone.toLowerCase()} tone. Mention the amount and what it was for. Warm, never guilt-tripping or passive-aggressive; no emojis unless the tone is funny. Don't sign it, and don't include a link: PayPal adds one.`,
    },
    { role: 'user', content: JSON.stringify({ friend: who.name, amount: usd(debt.amount), for: debt.what, days_open: days, reminders_already_sent: debt.reminders }) },
  ]);
  const text = typeof message === 'string' ? message.trim().slice(0, 400) : '';
  return text ? { text, by: 'ai' as const } : { text: templates[tone](who, debt, days), by: 'template' as const };
}

/** Sends the reminder: PayPal's invoice reminder, or the first request if none was sent yet. */
export async function send(body: Record<string, unknown>) {
  const { debt, who } = find(body.debtId);
  const { text } = body;
  need(typeof text === 'string' && text.trim() && text.length <= 600, 'text must be the message, up to 600 characters.');
  need(debt.status === 'requested', `${who.name} has already ${debt.status === 'paid' ? 'paid' : 'been let off'}.`, 409);

  if (debt.chat) {
    chat.remindIn(debt, text.trim());
  } else if (debt.invoiceId) {
    await remindInvoice(debt.invoiceId, `Reminder: ${debt.what}`, text);
  } else {
    const invoice = await sendInvoice({ reference: debt.id, to: who.email, name: who.name, item: `Your share of ${debt.what}`, amount: debt.amount, note: text });
    debt.invoiceId = invoice.id;
    debt.payerUrl = invoice.payerUrl;
  }
  debt.reminders += 1;
  debt.remindedAt = new Date().toISOString();
  log('nudge', `Reminded ${who.name} about ${debt.what}`, debt.amount);
  save();
  return debt;
}

/** Asks PayPal which requests have been paid since. */
export async function refresh() {
  const open = state.debts.filter((d) => d.status === 'requested' && d.invoiceId);
  const invoices = await Promise.all(open.map((d) => getInvoice(d.invoiceId!)));
  open.forEach((debt, i) => {
    const status = invoices[i].status;
    if (status === 'PAID' || status === 'MARKED_AS_PAID') {
      debt.status = 'paid';
      log('nudge', `${friend(debt.friendId)?.name ?? 'A friend'} paid you back for ${debt.what}`, debt.amount);
    } else if (status === 'CANCELLED') {
      debt.status = 'cancelled';
    }
  });
  save();
  return state.debts;
}
