import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { need } from './http.ts';
import { cents, id } from './model.ts';
import { state, workspaceId } from './store.ts';

// Businesses on Flick. A business signs in with its own PayPal (account.ts) and registers the names
// its bills carry ("KFC", "Kentucky Fried Chicken"). When Lens reads a bill with one of those names,
// Flick pays that business's PayPal: the account that signed in, so where the money goes is PayPal's
// word, not a guess from the bill or an email someone typed. A bill from a business that hasn't
// registered still pays, to a placeholder whose payout waits unclaimed (lens.ts).
//
// One business per PayPal account, and each name belongs to one business: first come, as with a
// handle. businesses.json, beside the workspaces (as Flick Chat's people.json).

const file = join(dirname(process.env.STATE_FILE || fileURLToPath(new URL('../.data/state.json', import.meta.url))), 'businesses.json');

export type Business = {
  id: string;
  name: string;
  /** Every name its bills may carry, its name first. */
  names: string[];
  /** The PayPal it signed in with: where Flick pays it. */
  email: string;
  /** The workspace of whoever registered it. */
  workspace: string;
  since: string;
  /** What Flick has paid it: how many payments, how much, and the latest few. */
  paid: { count: number; amount: number; latest: { at: string; amount: number; what: string }[] };
};

let businesses: Business[] | undefined;
function all() {
  if (!businesses) {
    try {
      businesses = JSON.parse(readFileSync(file, 'utf8')) as Business[];
    } catch {
      businesses = [];
    }
  }
  return businesses;
}
function keep() {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(`${file}.tmp`, JSON.stringify(all()));
  renameSync(`${file}.tmp`, file);
}

/** A name as a bill or a person writes it, for matching: lower case, accents off, words only. */
export const words = (name: string) =>
  name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * The registered business a bill is from: one of its names, as whole words, in who Lens read it's
 * from ("KFC" in "KFC Koramangala", not in "KFCX"). The longest name that fits wins.
 */
export function businessFor(title: string): Business | undefined {
  const text = ` ${words(title)} `;
  let best: { business: Business; length: number } | undefined;
  for (const business of all()) {
    for (const name of business.names) {
      const w = words(name);
      if (w && text.includes(` ${w} `) && (!best || w.length > best.length)) best = { business, length: w.length };
    }
  }
  return best?.business;
}

const myEmail = () => state.profile?.email?.trim().toLowerCase() || undefined;
const mine = () => {
  const email = myEmail();
  return email ? all().find((b) => b.email === email) : undefined;
};
const shown = ({ workspace: _workspace, ...business }: Business) => business;

/** Your business, if you've registered one, and the names of every business on Flick. */
export function view() {
  const yours = mine();
  return {
    signedIn: Boolean(state.profile),
    email: state.profile?.email ?? null,
    yours: yours ? shown(yours) : null,
    all: all().map((b) => ({ id: b.id, name: b.name, names: b.names, since: b.since })),
  };
}

/** Registers your business, or changes its names. Flick pays it to the PayPal you signed in with. */
export function register(body: Record<string, unknown>) {
  const email = myEmail();
  need(email, "Sign in with your business's PayPal first: Flick pays the PayPal account that signed in.", 409);
  const tidy = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');
  const name = tidy(body.name);
  const others = Array.isArray(body.names) ? body.names : typeof body.names === 'string' ? body.names.split(',') : [];
  const names: string[] = [];
  for (const n of [name, ...others.map(tidy)]) if (n && !names.some((m) => words(m) === words(n))) names.push(n);
  need(name, 'name is required: what your bills say you are.');
  need(names.length <= 8, 'Up to 8 names, your name included.');
  for (const n of names) need(n.length <= 60 && words(n).length >= 2, `"${n}" can't be a name on Flick: 2 to 60 letters or digits.`);

  const yours = mine();
  for (const n of names) {
    const taken = all().find((b) => b !== yours && b.names.some((m) => words(m) === words(n)));
    need(!taken, `${n} is already on Flick, registered by another PayPal account.`, 409);
  }
  if (yours) Object.assign(yours, { name, names, workspace: workspaceId() });
  else all().push({ id: id('biz'), name, names, email, workspace: workspaceId(), since: new Date().toISOString(), paid: { count: 0, amount: 0, latest: [] } });
  keep();
  return view();
}

/** Takes your business off Flick: its bills pay a placeholder again. */
export function remove() {
  need(myEmail(), 'Sign in with PayPal first.', 409);
  const yours = mine();
  need(yours, "You haven't registered a business.", 404);
  businesses = all().filter((b) => b !== yours);
  keep();
  return view();
}

/** Flick paid a business (lens.ts, autopilot.ts): its tally, for its page. */
export function received(businessId: string, amount: number, what: string) {
  const business = all().find((b) => b.id === businessId);
  if (!business) return;
  business.paid = {
    count: business.paid.count + 1,
    amount: cents(business.paid.amount + amount),
    latest: [{ at: new Date().toISOString(), amount, what }, ...business.paid.latest].slice(0, 10),
  };
  keep();
}
