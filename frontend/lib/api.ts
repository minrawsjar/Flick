// The frontend's only way to the backend (../backend). Server components call it directly; the browser
// goes through the /api/* rewrite in next.config.ts. Response types come from the backend's own source
// via the @backend/* path alias, as type-only imports, so no backend code is bundled here.

// || not ??: an empty BACKEND_URL= line in .env.local should mean the default too.
export const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

/** GET a backend route from a server component. */
export async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, { cache: 'no-store' }).catch((err) => {
    throw new Error(`Can't reach the backend at ${BACKEND_URL}: is it running? (cd backend && npm run dev)`, { cause: err });
  });
  if (!res.ok) throw new Error(`Backend ${res.status} on ${path}: ${await res.text()}`);
  return (await res.json()) as T;
}
