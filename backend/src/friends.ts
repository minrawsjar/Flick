import { HttpError, need } from './http.ts';
import { id, type Friend } from './model.ts';
import { pickFace } from './rules.ts';
import { save, state } from './store.ts';

// Friends: the people you split with. Each has the email of their PayPal account, where Splitter's
// invoices and Nudge's reminders go and where Autopilot pays them, so each is also a payee.
// (PayPal has no public API to confirm whose account an email is; the email is the link.)

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const find = (friendId: unknown) => {
  const friend = state.friends.find((f) => f.id === friendId);
  if (!friend) throw new HttpError(404, `No friend ${String(friendId)}`);
  return friend;
};

function checkName(name: unknown, except?: string): asserts name is string {
  need(typeof name === 'string' && name.trim() && name.trim().length <= 40, 'name must be 1 to 40 characters.');
  need(name.trim().toLowerCase() !== 'you', "That's you! Pick another name.");
  const taken = state.friends.some((f) => f.id !== except && f.name.toLowerCase() === name.trim().toLowerCase());
  need(!taken, `You already have a friend called ${name.trim()}.`, 409);
}

function checkEmail(email: unknown): asserts email is string {
  need(typeof email === 'string' && email.length <= 120 && EMAIL.test(email.trim()), "email must be the friend's PayPal email address.");
}

/** Keeps the friend's payee (who Autopilot pays) in step with the friend. */
function syncPayee(friend: Friend) {
  const payee = state.payees.find((p) => p.id === friend.id);
  if (payee) Object.assign(payee, { name: friend.name, email: friend.email });
  else state.payees.push({ id: friend.id, name: friend.name, email: friend.email, icon: 'friend' });
}

export function add(body: Record<string, unknown>) {
  const { name, email } = body;
  checkName(name);
  checkEmail(email);
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'friend';
  // 'you' is the person using Flick, never a friend's id.
  const friendId = slug !== 'you' && !state.friends.some((f) => f.id === slug) && !state.payees.some((p) => p.id === slug) ? slug : `${slug}-${id('f').slice(2)}`;
  const friend: Friend = { id: friendId, name: name.trim(), email: email.trim(), ...pickFace([{ color: 'red', shape: 'circle' }, ...state.friends]) };
  state.friends.push(friend);
  syncPayee(friend);
  save();
  return friend;
}

/** Changes a friend's PayPal email (or name). Requests already sent stay with the old address. */
export function update(body: Record<string, unknown>) {
  const friend = find(body.id);
  if (body.name !== undefined) {
    checkName(body.name, friend.id);
    friend.name = body.name.trim();
  }
  if (body.email !== undefined) {
    checkEmail(body.email);
    friend.email = body.email.trim();
  }
  syncPayee(friend);
  save();
  return friend;
}

export function remove(body: Record<string, unknown>) {
  const friend = find(body.id);
  const open = state.debts.filter((d) => d.friendId === friend.id && d.status === 'requested');
  need(!open.length, `${friend.name} still owes you for ${open.map((d) => d.what).join(' and ')}. Settle that first.`, 409);
  state.friends = state.friends.filter((f) => f !== friend);
  save();
  return state.friends;
}
