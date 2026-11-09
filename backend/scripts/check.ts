import { aiBaseUrl, aiHeaders, aiKey, aiModel, askJson, studioModels } from '../src/ai.ts';
import { call, createOrder, createPayout, getBalances } from '../src/paypal.ts';

// `npm run check`: tries each PayPal sandbox feature and the AI connection Flick needs, and says
// what to switch on when one fails. Safe to run: the order is never captured, the invoice is a
// draft that's deleted again, and the payout is one sandbox cent.

const features = 'developer.paypal.com → Apps & Credentials → your sandbox app → Features';

async function check(name: string, fix: string, run: () => Promise<string | void>) {
  try {
    const detail = await run();
    console.log(`✓ ${name}${detail ? `: ${detail}` : ''}`);
    return true;
  } catch (err) {
    console.log(`✗ ${name}: ${err instanceof Error ? err.message.slice(0, 220) : err}\n    → ${fix}`);
    return false;
  }
}

const signedIn = await check('PayPal sign-in', 'set PAYPAL_CLIENT_ID and PAYPAL_SECRET in backend/.env, from a sandbox app', async () => {
  await getBalances().catch((err) => {
    if (String(err).includes(' 403 ')) return; // signed in fine; only Transaction search is off
    throw err;
  });
});

if (signedIn) {
  await check('Orders (paying bills and the week)', `turn on Accept payments: ${features}`, async () => {
    const order = await createOrder({ reference: `check-${Date.now()}`, description: 'Flick sandbox check', items: [{ name: 'Check', amount: 1 }], returnUrl: 'https://example.com/return', cancelUrl: 'https://example.com/cancel' });
    return `order ${order.id}, approve at ${new URL(order.approveUrl).host}`;
  });
  await check('Payouts (paying billers and friends)', `turn on Payouts: ${features}`, async () => {
    const batch = await createPayout(`check-${Date.now()}`, 'Flick sandbox check', [{ id: 'check', email: 'check@flick.example.com', amount: 0.01, note: 'Flick sandbox check' }]);
    return `batch ${batch.batchId} ${batch.status}`;
  });
  await check('Invoicing (splits and reminders)', `turn on Invoicing: ${features}`, async () => {
    const draft = await call<{ id?: string; href?: string }>('POST', '/v2/invoicing/invoices', {
      prefer: 'return=representation',
      body: { detail: { currency_code: 'USD' }, primary_recipients: [{ billing_info: { email_address: 'check@flick.example.com' } }], items: [{ name: 'Check', quantity: '1', unit_amount: { currency_code: 'USD', value: '1.00' } }] },
    });
    const id = draft.id ?? draft.href?.split('/').pop();
    await call('DELETE', `/v2/invoicing/invoices/${id}`);
    return 'created and deleted a draft';
  });
  await check('Transaction search (Money Studio)', `turn on Transaction search: ${features}. New apps can take a few hours to get access.`, async () => {
    await getBalances();
  });
}

if (!aiKey()) {
  console.log('✗ AI: AI_API_KEY is not set\n    → add an OpenRouter (or OpenAI) key to backend/.env');
} else {
  await check(`AI answers in JSON (${aiModel()})`, 'check AI_API_KEY, AI_BASE_URL and that AI_MODEL exists and supports structured outputs', async () => {
    const { ok } = await askJson<{ ok: boolean }>('check', { type: 'object', additionalProperties: false, required: ['ok'], properties: { ok: { type: 'boolean' } } }, [
      { role: 'user', content: 'Reply with {"ok": true}.' },
    ]);
    if (ok !== true) throw new Error('the model did not return {"ok": true}');
  });
  await check(`Studio assistant: Responses API (${studioModels()[0]})`, `the provider at ${aiBaseUrl()} must support /responses; OpenAI does, OpenRouter's is in beta`, async () => {
    const res = await fetch(`${aiBaseUrl()}/responses`, {
      method: 'POST',
      headers: aiHeaders(aiKey()!),
      body: JSON.stringify({ model: studioModels()[0], input: 'Say ok.', max_output_tokens: 16 }),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  });
}
