import { need } from './http.ts';
import { id, usd, type Debt } from './model.ts';
import { sendInvoice } from './paypal.ts';
import { shares, type SplitItem } from './rules.ts';
import { friend, log, save, state } from './store.ts';

// Splitter: who had what on a receipt (often one Lens just read), worked out with rules.ts, then a
// PayPal invoice to each friend for their share. Each becomes a debt Nudge can follow up.

const money = (v: unknown, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;

export async function split(body: Record<string, unknown>) {
  const { merchant, items, tax = 0, tip = 0 } = body;
  const people = new Set(['you', ...state.friends.map((f) => f.id)]);

  need(typeof merchant === 'string' && merchant.trim() && merchant.length <= 80, 'merchant must be a name of up to 80 characters.');
  need(Array.isArray(items) && items.length >= 1 && items.length <= 50, 'items must list 1 to 50 things.');
  for (const item of items as SplitItem[]) {
    need(item && typeof item.name === 'string' && item.name.trim() && item.name.length <= 80, 'Each item needs a name of up to 80 characters.');
    need(money(item.price, 10_000) && item.price > 0, `${item.name}: price must be between 0 and 10,000.`);
    need(Array.isArray(item.people) && item.people.every((p) => people.has(p)), `${item.name}: people must be among ${[...people].join(', ')}.`);
  }
  need(money(tax, 10_000) && money(tip, 10_000), 'tax and tip must be amounts between 0 and 10,000.');

  const { total, each, nobody } = shares(items as SplitItem[], tax as number, tip as number);
  need(!nobody.length, `Nobody had the ${nobody.join(' or ')} yet: tick who did.`);

  const reference = id('split');
  const debts: Debt[] = [];
  const failed: { friendId: string; error: string }[] = [];
  for (const [friendId, amount] of Object.entries(each)) {
    const who = friend(friendId);
    if (!who || amount <= 0) continue;
    const had = (items as SplitItem[]).filter((i) => i.people.includes(friendId)).map((i) => i.name);
    try {
      const invoice = await sendInvoice({
        reference: `${reference}-${friendId}`,
        to: who.email,
        name: who.name,
        item: `Your share of ${merchant}`,
        amount,
        note: `Split with Flick: ${had.join(', ')}, plus your part of the tax and tip.`,
      });
      const debt: Debt = { id: id('debt'), friendId, amount, what: merchant as string, createdAt: new Date().toISOString(), invoiceId: invoice.id, payerUrl: invoice.payerUrl, status: 'requested', reminders: 0 };
      state.debts.unshift(debt);
      debts.push(debt);
    } catch (err) {
      failed.push({ friendId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  if (debts.length) {
    const names = debts.map((d) => friend(d.friendId)?.name).join(', ');
    log('splitter', `Split ${merchant} ${Object.keys(each).length} ways and asked ${names} for ${usd(debts.reduce((s, d) => s + d.amount, 0))}`, total);
  }
  save();
  return { total, each, debts, failed };
}
