// The frontend's only way to the backend (../backend). Server components call it directly; the browser
// goes through the /api/* rewrite in next.config.ts. Response types come from the backend's own source
// via the @backend/* path alias, as type-only imports, so no backend code is bundled here.

import type { Money } from '@backend/paypal';

export const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';

/** GET a backend route from a server component. */
export async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Backend ${res.status} on ${path}: ${await res.text()}`);
  return (await res.json()) as T;
}

// PayPal sends amounts as decimal strings; missing amounts count as 0.
export const amountOf = (m?: Money | null) => (m?.value === undefined ? 0 : Number(m.value));
