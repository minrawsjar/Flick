// PayPal REST client: every call Flick makes to PayPal goes through here, with plain fetch and
// no SDK. Reads: catalog products, billing plans, invoices, Transaction Search and balances.
// Money movement: orders (checkout), captures and refunds, payouts, and invoices (requests to
// friends, and reminders). It reads the client secret from the environment (backend/.env).

import { HttpError } from './http.ts';

const BASE_URL = 'https://api-m.sandbox.paypal.com';
const MAX_ATTEMPTS = 4;

export class PayPalApiError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(status: number, path: string, body: string) {
    super(`PayPal ${status} on ${path}: ${body.slice(0, 300)}`);
    this.name = 'PayPalApiError';
    this.status = status;
    this.path = path;
  }
}

let cachedToken: { value: string; expiresAt: number } | undefined;

async function accessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const { PAYPAL_CLIENT_ID: id, PAYPAL_SECRET: secret } = process.env;
  if (!id || !secret) throw new HttpError(503, 'PayPal is off: set PAYPAL_CLIENT_ID and PAYPAL_SECRET in backend/.env (see env.example).');

  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new PayPalApiError(res.status, '/v1/oauth2/token', await res.text());

  const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
  // Refresh a minute early so an in-flight request never carries an expired token.
  cachedToken = { value: access_token, expiresAt: Date.now() + (expires_in - 60) * 1000 };
  return access_token;
}

type CallOptions = {
  body?: unknown;
  /** PayPal-Request-Id: makes a POST idempotent, so it's safe to retry and to repeat. */
  requestId?: string;
  /** "return=representation" asks for the full resource back instead of a link to it. */
  prefer?: string;
};

/**
 * One REST call. Retries a rejected token once, and 429s and 5xxs with backoff: always for GETs,
 * and for writes only when they carry a request id, since only then can PayPal de-duplicate them.
 */
export async function call<T>(method: string, path: string, { body, requestId, prefer }: CallOptions = {}): Promise<T> {
  const retryable = method === 'GET' || Boolean(requestId);
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(requestId && { 'PayPal-Request-Id': requestId }),
        ...(prefer && { Prefer: prefer }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) {
      const text = await res.text();
      return (text ? JSON.parse(text) : undefined) as T;
    }

    // A revoked or expired token: drop it and mint a new one once.
    if (res.status === 401 && attempt === 1) {
      cachedToken = undefined;
      continue;
    }
    if (retryable && (res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 250));
      continue;
    }
    throw new PayPalApiError(res.status, path, await res.text());
  }
}

const get = <T>(path: string) => call<T>('GET', path);

/**
 * PayPal keeps handing out the same token, with the permissions the app had when it was issued, for
 * up to 9 hours. Revoking it makes features just switched on in the developer dashboard apply now.
 */
export async function revokeToken() {
  const { PAYPAL_CLIENT_ID: id, PAYPAL_SECRET: secret } = process.env;
  const token = await accessToken();
  await fetch(`${BASE_URL}/v1/oauth2/token/terminate`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token, token_type_hint: 'ACCESS_TOKEN' }),
  });
  cachedToken = undefined;
}

// `path` must already carry whatever flag makes the endpoint report `total_pages`.
async function listAll<T>(path: string, key: string, pageSize: number): Promise<T[]> {
  const items: T[] = [];
  const sep = path.includes('?') ? '&' : '?';
  for (let page = 1; ; page++) {
    const res = await get<{ total_pages?: number } & Record<string, unknown>>(
      `${path}${sep}page_size=${pageSize}&page=${page}`,
    );
    items.push(...((res[key] as T[] | undefined) ?? []));
    if (page >= (res.total_pages ?? 1)) return items;
  }
}

export type Money = { value: string; currency_code: string };

// PayPal sends amounts as decimal strings; missing amounts count as 0.
export const amountOf = (m?: Money | null) => (m?.value === undefined ? 0 : Number(m.value));

// --- Catalog products & billing plans ------------------------------------------

export type Product = {
  id: string;
  name: string;
  description?: string;
  type?: 'PHYSICAL' | 'DIGITAL' | 'SERVICE';
  category?: string;
  create_time: string;
};

export type IntervalUnit = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

export type BillingCycle = {
  frequency: { interval_unit: IntervalUnit; interval_count: number };
  tenure_type: 'REGULAR' | 'TRIAL';
  sequence: number;
  total_cycles: number;
  pricing_scheme?: { fixed_price?: Money };
};

export type Plan = {
  id: string;
  product_id: string;
  name: string;
  status: 'CREATED' | 'INACTIVE' | 'ACTIVE';
  create_time: string;
  billing_cycles: BillingCycle[];
  payment_preferences?: { setup_fee?: Money };
};

// The list endpoints return summaries (no product type/category, no billing cycles),
// so each record is fetched in full.
export async function listProducts(): Promise<Product[]> {
  const summaries = await listAll<{ id: string }>('/v1/catalogs/products?total_required=true', 'products', 20);
  return Promise.all(summaries.map((p) => get<Product>(`/v1/catalogs/products/${encodeURIComponent(p.id)}`)));
}

export async function listPlans(): Promise<Plan[]> {
  const summaries = await listAll<{ id: string }>('/v1/billing/plans?total_required=true', 'plans', 20);
  return Promise.all(summaries.map((p) => get<Plan>(`/v1/billing/plans/${encodeURIComponent(p.id)}`)));
}

// --- Invoicing -------------------------------------------------------------------

export type InvoiceStatus =
  | 'DRAFT'
  | 'SENT'
  | 'SCHEDULED'
  | 'UNPAID'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'MARKED_AS_PAID'
  | 'PARTIALLY_PAID'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'MARKED_AS_REFUNDED'
  | 'CANCELLED';

export type Invoice = {
  id: string;
  status: InvoiceStatus;
  detail: {
    invoice_number: string;
    currency_code: string;
    invoice_date?: string;
    payment_term?: { term_type?: string; due_date?: string };
  };
  primary_recipients?: {
    billing_info?: {
      name?: { full_name?: string };
      business_name?: string;
      email_address?: string;
    };
  }[];
  items?: {
    id?: string;
    name: string;
    quantity: string;
    unit_amount: Money;
    unit_of_measure?: string;
    tax?: { percent?: string; amount?: Money };
    discount?: { percent?: string; amount?: Money };
  }[];
  amount?: Money & { breakdown?: { tax_total?: Money; shipping?: { amount?: Money } } };
  due_amount?: Money;
  payments?: {
    paid_amount?: Money;
    transactions?: { payment_id?: string; payment_date?: string; method?: string; amount: Money }[];
  };
  refunds?: {
    refund_amount?: Money;
    transactions?: { recipient_transaction_id?: string; refund_date?: string; method?: string; amount: Money }[];
  };
};

// The list omits line items, payments and refunds; the detail endpoint has them.
export async function listInvoices(): Promise<Invoice[]> {
  const summaries = await listAll<{ id: string }>('/v2/invoicing/invoices?total_required=true', 'items', 100);
  return Promise.all(summaries.map((i) => get<Invoice>(`/v2/invoicing/invoices/${encodeURIComponent(i.id)}`)));
}

// --- Transaction Search & balances -------------------------------------------------

export type Transaction = {
  transaction_info: {
    transaction_id: string;
    paypal_reference_id?: string;
    transaction_event_code?: string;
    transaction_initiation_date?: string;
    transaction_amount?: Money;
    fee_amount?: Money;
    transaction_status?: string;
    ending_balance?: Money;
    transaction_subject?: string;
    transaction_note?: string;
    custom_field?: string;
  };
  payer_info?: { email_address?: string };
};

// Transaction Search allows ranges of at most 31 days and rejects fractional seconds.
export const TRANSACTION_SEARCH_MAX_DAYS = 31;

export function searchTransactions(start: Date, end: Date): Promise<Transaction[]> {
  const iso = (d: Date) => `${d.toISOString().slice(0, 19)}Z`;
  return listAll<Transaction>(
    `/v1/reporting/transactions?start_date=${iso(start)}&end_date=${iso(end)}&fields=all`,
    'transaction_details',
    500,
  );
}

export type Balances = {
  as_of_time?: string;
  balances?: { currency: string; total_balance?: Money; available_balance?: Money; withheld_balance?: Money }[];
};

export function getBalances(): Promise<Balances> {
  return get<Balances>('/v1/reporting/balances');
}

// --- Money movement ------------------------------------------------------------------

/** Two decimal places, as PayPal wants amounts. */
export const money = (value: number, currency_code = 'USD'): Money => ({ value: value.toFixed(2), currency_code });

type Link = { href: string; rel: string };

export type Order = {
  id: string;
  status: 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED' | 'PAYER_ACTION_REQUIRED';
  links?: Link[];
  purchase_units?: { payments?: { captures?: { id: string; status: string; amount: Money }[] } }[];
  /** After a capture that asked to save PayPal: the saved method ("payment token") and its customer. */
  payment_source?: { paypal?: { email_address?: string; attributes?: { vault?: { id?: string; status?: string; customer?: { id?: string } } } } };
};

/** A PayPal account saved for later (PayPal's vault): Flick charges it without the person present. */
export type Saved = { id: string; customerId?: string; email?: string };

export type OrderItem = { name: string; amount: number };

/**
 * A checkout for the person to approve in PayPal. It's captured into this app's own (sandbox
 * business) account; Flick then pays the billers out of it. Returns the order and the URL that
 * sends the person to PayPal to approve it.
 */
export async function createOrder({
  reference,
  description,
  items,
  currency = 'USD',
  returnUrl,
  cancelUrl,
  save = false,
}: {
  /** Our own id for this checkout; also makes the call idempotent. */
  reference: string;
  description: string;
  items: OrderItem[];
  currency?: string;
  returnUrl: string;
  cancelUrl: string;
  /** Also ask the person to save PayPal for payments Flick makes later (PayPal's vault). */
  save?: boolean;
}) {
  const total = items.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100;
  const order = await call<Order>('POST', '/v2/checkout/orders', {
    requestId: `order-${reference}`,
    body: {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: reference.slice(0, 256),
          description: description.slice(0, 127),
          amount: { ...money(total, currency), breakdown: { item_total: money(total, currency) } },
          items: items.map((item) => ({
            name: item.name.slice(0, 127),
            quantity: '1',
            unit_amount: money(item.amount, currency),
            category: 'DIGITAL_GOODS',
          })),
        },
      ],
      payment_source: {
        paypal: {
          ...(save && { attributes: { vault: { store_in_vault: 'ON_SUCCESS', usage_type: 'MERCHANT', customer_type: 'CONSUMER' } } }),
          experience_context: {
            brand_name: 'Flick',
            user_action: 'PAY_NOW',
            shipping_preference: 'NO_SHIPPING',
            return_url: returnUrl,
            cancel_url: cancelUrl,
          },
        },
      },
    },
  });
  const approveUrl = order.links?.find((l) => l.rel === 'payer-action' || l.rel === 'approve')?.href;
  if (!approveUrl) throw new Error(`PayPal returned order ${order.id} without an approval link`);
  return { id: order.id, approveUrl, total };
}

/** Takes the money for an approved order. Safe to repeat: the request id makes it idempotent. */
export async function captureOrder(orderId: string) {
  return completed(await captureOrderRaw(orderId));
}

/** The capture of a completed order, and the saved PayPal if the order saved one. */
function completed(order: Order) {
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  if (order.status !== 'COMPLETED' || !capture) throw new Error(`PayPal order ${order.id} is ${order.status}, not COMPLETED`);
  const vault = order.payment_source?.paypal?.attributes?.vault;
  // PayPal can complete the payment without saving the account; then the vault status isn't VAULTED.
  const saved: Saved | undefined =
    vault?.id && vault.status === 'VAULTED' ? { id: vault.id, customerId: vault.customer?.id, email: order.payment_source?.paypal?.email_address } : undefined;
  return { orderId: order.id, captureId: capture.id, amount: amountOf(capture.amount), saved };
}

/**
 * Pays with a saved PayPal account, without the person present (a merchant-initiated payment): no
 * approval page. The order is captured as it's created, or straight after if PayPal leaves it
 * APPROVED. Safe to repeat: the request ids make it idempotent.
 */
export async function chargeSaved({
  reference,
  description,
  items,
  savedId,
  present = false,
}: {
  reference: string;
  description: string;
  items: OrderItem[];
  savedId: string;
  /** The person is there, paying (a flick), rather than Flick paying for them later. */
  present?: boolean;
}) {
  const total = items.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100;
  const order = await call<Order>('POST', '/v2/checkout/orders', {
    requestId: `saved-${reference}`,
    prefer: 'return=representation',
    body: {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: reference.slice(0, 256),
          description: description.slice(0, 127),
          amount: { ...money(total), breakdown: { item_total: money(total) } },
          items: items.map((item) => ({ name: item.name.slice(0, 127), quantity: '1', unit_amount: money(item.amount), category: 'DIGITAL_GOODS' })),
        },
      ],
      payment_source: { paypal: { vault_id: savedId, stored_credential: { payment_initiator: present ? 'CUSTOMER' : 'MERCHANT', usage: 'SUBSEQUENT' } } },
    },
  });
  return completed(order.status === 'APPROVED' ? await captureOrderRaw(order.id) : order);
}

const captureOrderRaw = (orderId: string) =>
  call<Order>('POST', `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { requestId: `capture-${orderId}`, prefer: 'return=representation', body: {} });

/**
 * Asks the person to save their PayPal with Flick, with no purchase: signing in to Flick (account.ts).
 * Returns the setup token and the PayPal page where they approve it.
 */
export async function startSaving({ reference, returnUrl, cancelUrl }: { reference: string; returnUrl: string; cancelUrl: string }) {
  const token = await call<{ id: string; links?: { rel: string; href: string }[] }>('POST', '/v3/vault/setup-tokens', {
    requestId: `setup-${reference}`,
    body: {
      payment_source: {
        paypal: {
          usage_type: 'MERCHANT',
          customer_type: 'CONSUMER',
          experience_context: { brand_name: 'Flick', shipping_preference: 'NO_SHIPPING', return_url: returnUrl, cancel_url: cancelUrl },
        },
      },
    },
  });
  const approveUrl = token.links?.find((l) => l.rel === 'approve')?.href;
  if (!approveUrl) throw new Error(`PayPal returned setup token ${token.id} without an approval link`);
  return { setupTokenId: token.id, approveUrl };
}

type PaymentToken = {
  id: string;
  customer?: { id?: string };
  payment_source?: { paypal?: { email_address?: string; payer_id?: string; name?: { given_name?: string; surname?: string; full_name?: string } } };
};

/** Once the person approved saving their PayPal: the saved account, and whose it is. Safe to repeat. */
export async function finishSaving(setupTokenId: string) {
  const token = await call<PaymentToken>('POST', '/v3/vault/payment-tokens', {
    requestId: `saved-from-${setupTokenId}`,
    body: { payment_source: { token: { id: setupTokenId, type: 'SETUP_TOKEN' } } },
  });
  const paypal = token.payment_source?.paypal;
  const name = paypal?.name?.full_name ?? [paypal?.name?.given_name, paypal?.name?.surname].filter(Boolean).join(' ');
  return { savedId: token.id, email: paypal?.email_address, payerId: paypal?.payer_id, name: name || undefined };
}

/** Forgets a saved PayPal account, at PayPal too. */
export function deleteSaved(savedId: string) {
  return call<void>('DELETE', `/v3/vault/payment-tokens/${encodeURIComponent(savedId)}`, { requestId: `delete-${savedId}` });
}

/** Gives part (or all) of a capture back to the person who paid. */
export function refundCapture(captureId: string, amount: number, note: string, reference: string) {
  return call<{ id: string; status: string }>('POST', `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {
    requestId: `refund-${reference}`,
    body: { amount: money(amount), note_to_payer: note.slice(0, 255) },
  });
}

export type PayoutItem = { id: string; email: string; amount: number; note: string };

/** Sends money from this app's account to one or more people by email, in one batch. */
export async function createPayout(batchId: string, subject: string, items: PayoutItem[]) {
  const res = await call<{ batch_header: { payout_batch_id: string; batch_status: string } }>('POST', '/v1/payments/payouts', {
    requestId: `payout-${batchId}`,
    body: {
      sender_batch_header: { sender_batch_id: batchId.slice(0, 127), email_subject: subject, email_message: 'Paid by Flick, on your behalf.' },
      items: items.map((item) => ({
        recipient_type: 'EMAIL',
        receiver: item.email,
        amount: { value: item.amount.toFixed(2), currency: 'USD' },
        note: item.note.slice(0, 4000),
        sender_item_id: item.id.slice(0, 63),
      })),
    },
  });
  return { batchId: res.batch_header.payout_batch_id, status: res.batch_header.batch_status };
}

/** A request for money: a PayPal invoice to one person, sent by email. Returns its id and payer link. */
export async function sendInvoice({
  reference,
  to,
  name,
  item,
  amount,
  note,
}: {
  reference: string;
  to: string;
  name: string;
  item: string;
  amount: number;
  note: string;
}) {
  const created = await call<{ id?: string; href?: string }>('POST', '/v2/invoicing/invoices', {
    requestId: `invoice-${reference}`,
    prefer: 'return=representation',
    body: {
      detail: { currency_code: 'USD', note: note.slice(0, 4000), payment_term: { term_type: 'DUE_ON_RECEIPT' } },
      primary_recipients: [{ billing_info: { name: { given_name: name }, email_address: to } }],
      items: [{ name: item.slice(0, 200), quantity: '1', unit_amount: money(amount) }],
    },
  });
  // With return=representation the invoice comes back; otherwise a link ending in its id.
  const id = created.id ?? created.href?.split('/').pop();
  if (!id) throw new Error('PayPal created an invoice without an id');
  const sent = await call<{ href?: string } | undefined>('POST', `/v2/invoicing/invoices/${encodeURIComponent(id)}/send`, {
    requestId: `send-${reference}`,
    body: { send_to_invoicer: false, send_to_recipient: true, subject: `${item}`.slice(0, 4000) },
  });
  return { id, payerUrl: sent?.href };
}

/** PayPal's own reminder email for an unpaid invoice, carrying our note. */
export function remindInvoice(invoiceId: string, subject: string, note: string) {
  return call<undefined>('POST', `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/remind`, {
    body: { subject: subject.slice(0, 4000), note: note.slice(0, 4000), send_to_invoicer: false, send_to_recipient: true },
  });
}

export function getInvoice(invoiceId: string): Promise<Invoice> {
  return get<Invoice>(`/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}`);
}

export type WebhookHeaders = {
  authAlgo?: string;
  certUrl?: string;
  transmissionId?: string;
  transmissionSig?: string;
  transmissionTime?: string;
};

/** Verifies a webhook notification signature with PayPal before trusting the event. */
export async function verifyWebhookSignature({
  webhookId,
  headers,
  event,
}: {
  webhookId: string;
  headers: WebhookHeaders;
  event: Record<string, unknown>;
}): Promise<boolean> {
  const { authAlgo, certUrl, transmissionId, transmissionSig, transmissionTime } = headers;
  if (!webhookId || !authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
    return false;
  }
  try {
    const res = await call<{ verification_status: string }>('POST', '/v1/notifications/verify-webhook-signature', {
      body: {
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: event,
      },
    });
    return res.verification_status === 'SUCCESS';
  } catch (err) {
    console.error('Webhook signature verification error:', err instanceof Error ? err.message : err);
    return false;
  }
}
