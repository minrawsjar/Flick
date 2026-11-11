import { createHmac } from 'node:crypto';
import { frontendUrl } from './checkout.ts';
import { need } from './http.ts';
import type { Profile, State } from './model.ts';
import { deleteSaved, finishSaving, startSaving } from './paypal.ts';
import { save, state, workspaceId } from './store.ts';

// Signing in to Flick, with PayPal. The person approves saving their PayPal with Flick (PayPal's
// vault, no purchase), and that one approval says both who they are and how they pay:
// - who: their PayPal account picks their workspace, the same one on every device they sign in on;
// - how: a flick charges the saved PayPal straight away, with no PayPal page (checkout.ts).
// The first sign-in brings along what they did as a guest in that browser. Signing in is optional:
// a guest keeps their browser's own workspace and approves each payment on PayPal's page.
//
// server.ts does the moving between workspaces: `finish` runs in the guest's, `welcome` in theirs.

/**
 * A signed-in person's workspace: from their PayPal account, keyed with the server's secret so the
 * id can't be worked out from the account. It's the session cookie's value, as a guest's random id is.
 */
export function workspaceFor(account: string) {
  const key = process.env.SESSION_SECRET || process.env.PAYPAL_SECRET || 'flick-local';
  return `p${createHmac('sha256', key).update(account.trim().toLowerCase()).digest('hex').slice(0, 40)}`;
}

/** Only a page on Flick to come back to: never another site. */
export const onFlick = (next: unknown) => (typeof next === 'string' && /^\/(?!\/)[\w\-/?=&.%]*$/.test(next) ? next : '/home');

/** Starts signing in: returns the PayPal page that asks to save PayPal with Flick. `next`: the page to come back to. */
export async function start(next: unknown) {
  const { setupTokenId, approveUrl } = await startSaving({
    reference: crypto.randomUUID(),
    returnUrl: `${frontendUrl()}/api/auth/paypal/return`,
    cancelUrl: `${frontendUrl()}/api/auth/paypal/cancel`,
  });
  state.signingIn = { setupTokenId, next: onFlick(next), at: new Date().toISOString() };
  save();
  return approveUrl;
}

export type SignedIn = Awaited<ReturnType<typeof finish>>;

/**
 * PayPal sent the person back, approved: saves their PayPal and works out whose it is. Runs in the
 * browser's own workspace, which must be the one that started this sign-in. Returns their
 * workspace, their saved PayPal, and (from a guest workspace) a copy of what they did as a guest.
 */
export async function finish(setupTokenId: string) {
  const pending = state.signingIn;
  need(pending && pending.setupTokenId === setupTokenId, "This sign-in didn't start in this browser. Sign in again.");
  const saved = await finishSaving(setupTokenId);
  const account = saved.payerId ?? saved.email;
  need(account, "PayPal didn't say whose account this is.", 502);
  delete state.signingIn;
  save();
  const guest = workspaceId() === 'local' || state.profile ? undefined : (JSON.parse(JSON.stringify(state)) as State);
  return { workspace: workspaceFor(account), from: workspaceId(), saved, guest, next: pending.next };
}

/**
 * In the person's own workspace: who they are, and their newly saved PayPal. `isNew`: their first
 * sign-in, so the guest's things move in.
 */
export async function welcome({ saved, guest }: SignedIn, isNew: boolean) {
  if (isNew && guest) {
    for (const key of Object.keys(state)) delete state[key as keyof State];
    Object.assign(state, guest);
  }
  // Signing in again saves PayPal again: the one saved before isn't needed any more.
  const before = state.profile?.savedId;
  if (before && before !== saved.savedId) await deleteSaved(before).catch(() => {});
  const named = state.profile?.named;
  state.profile = {
    // PayPal's name for them, until they choose their own (PayPal's sandbox names everyone John Doe).
    name: named ? state.profile!.name : (saved.name ?? saved.email?.split('@')[0] ?? 'You'),
    email: saved.email ?? '',
    payerId: saved.payerId,
    savedId: saved.savedId,
    since: state.profile?.since ?? new Date().toISOString(),
    ...(named && { named }),
  } satisfies Profile;
  save();
  return state.profile;
}

/** The name Flick calls them by, chosen on /profile. */
export function rename(body: Record<string, unknown>) {
  need(state.profile, 'Sign in with PayPal first.', 409);
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  need(name.length >= 1 && name.length <= 60, 'name must be 1 to 60 characters.');
  state.profile.name = name;
  state.profile.named = true;
  save();
  return { ...state.profile, savedId: '' };
}
