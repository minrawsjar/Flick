import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { declined } from './checkout.ts';
import * as friends from './friends.ts';
import { HttpError, need } from './http.ts';
import { isPhoto } from './lens.ts';
import { cents, id, usd, type Debt } from './model.ts';
import * as nudge from './nudge.ts';
import { chargeSaved, createPayout, PayPalApiError, sendInvoice } from './paypal.ts';
import * as push from './push.ts';
import { inWorkspace, log, save, state, workspaceId } from './store.ts';

// Flick Chat: people signed in with PayPal (account.ts) talk to their friends, ask them for money,
// share a bill's photo, and pay a request in one tap, from the PayPal they saved when signing in.
//
// - Who's who: the PayPal email each person signed in with (people.json, beside the workspaces). A
//   friend whose email is there is on Flick; a friend who isn't still gets requests, as PayPal
//   invoices by email (as Splitter sends them), but not messages.
// - A conversation is one file under chats/, shared by its two people, so neither writes into the
//   other's workspace to talk. Paying does touch both: the asker's request (a Debt) is marked paid.
// - Paying: Flick charges the payer's saved PayPal into its own account (as a flick does), then pays
//   the asker out to their PayPal email (as Lens pays billers). The asker is who signed in with that
//   email, so the money goes to the right PayPal: no guessing from a bill.
// - Pays by itself: each person can let a friend's requests pay without a tap, up to an amount each.

const base = dirname(process.env.STATE_FILE || fileURLToPath(new URL('../.data/state.json', import.meta.url)));
const peopleFile = join(base, 'people.json');
const chatFile = (key: string) => join(base, 'chats', `${key}.json`);

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const norm = (email: string) => email.trim().toLowerCase();

function write(file: string, data: unknown) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(`${file}.tmp`, JSON.stringify(data));
  renameSync(`${file}.tmp`, file);
}

// --- Who's on Flick -------------------------------------------------------------------------

/** `peers`: whoever they have a chat with, so a chat someone else started shows in their list. */
type Person = { workspace: string; name: string; since: string; peers: string[] };
let people: Record<string, Person> | undefined;
function directory() {
  if (!people) {
    try {
      people = JSON.parse(readFileSync(peopleFile, 'utf8')) as Record<string, Person>;
    } catch {
      people = {};
    }
  }
  return people;
}

/** The signed-in person is on Flick, by their PayPal email. On each sign-in, rename and page load. */
export function register() {
  const profile = state.profile;
  if (!profile?.email) return;
  const all = directory();
  const email = norm(profile.email);
  const was = all[email];
  if (was?.workspace === workspaceId() && was.name === profile.name) return;
  all[email] = { workspace: workspaceId(), name: profile.name, since: was?.since ?? new Date().toISOString(), peers: was?.peers ?? [] };
  write(peopleFile, all);
}

/** Who's signed in, for chatting: their PayPal email and name. */
function me() {
  const profile = state.profile;
  if (!profile?.email) throw new HttpError(401, 'Sign in with PayPal to chat: your friends find you by your PayPal email.');
  register();
  return { email: norm(profile.email), name: profile.name };
}

export type Peer = { email: string; name: string; onFlick: boolean; friendId?: string; color: string; shape: string };

/** Someone to chat with: your friend by that email (their name and face), or whoever signed in with it. */
function peerOf(email: string): Peer {
  const friend = state.friends.find((f) => norm(f.email) === email);
  const there = directory()[email];
  return { email, name: friend?.name ?? there?.name ?? email.split('@')[0], onFlick: Boolean(there), friendId: friend?.id, color: friend?.color ?? 'blue', shape: friend?.shape ?? 'circle' };
}

/** A friend's chat side, if they're on Flick (Splitter sends their share here). */
export function onFlick(email: string) {
  const peer = peerOf(norm(email));
  return peer.onFlick && state.profile?.email && peer.email !== norm(state.profile.email) ? peer : undefined;
}

function peerFor(value: unknown, self: string) {
  need(typeof value === 'string' && value.length <= 120 && EMAIL.test(value.trim()), 'with must be a PayPal email address.');
  const email = norm(value);
  need(email !== self, "That's your own PayPal: chat with a friend.");
  return peerOf(email);
}

/** The friend in your own Flick for a peer, added if they aren't one yet (a request is a Debt, which is a friend's). */
function friendFor(peer: Peer) {
  const found = state.friends.find((f) => norm(f.email) === peer.email);
  if (found) return found;
  for (const name of [peer.name, `${peer.name} ${peer.email.split('@')[0]}`.slice(0, 40), peer.email.split('@')[0].slice(0, 40)]) {
    try {
      return friends.add({ name, email: peer.email });
    } catch {
      // Taken (or "you"): the next name.
    }
  }
  throw new HttpError(409, `Couldn't add ${peer.email} as a friend.`);
}

// --- Conversations --------------------------------------------------------------------------

export type Message = {
  id: string;
  at: string;
  /** The PayPal email of whoever sent it. */
  from: string;
  /** text; request (for money); paid (a request was paid); reminder (Nudge's, about a request); note (a change, like pays by itself). */
  kind: 'text' | 'request' | 'paid' | 'reminder' | 'note';
  text?: string;
  amount?: number;
  what?: string;
  /** A bill's photo, for a request: a small JPEG (Lens's copy). Only the newest few keep theirs. */
  photo?: string;
  status?: 'open' | 'paying' | 'paid' | 'declined';
  /** Paid with no tap, as the payer allowed. */
  auto?: boolean;
  /** Paid, but Flick couldn't send it on to the asker's PayPal (yet). */
  payout?: 'failed';
  /** A request's record in the asker's Flick, which Nudge, Today and Money Studio follow. */
  debtId?: string;
  /** A paid message's or reminder's request. */
  about?: string;
  tries?: number;
};

/** `autopay`: by payer email, the most one request from the other person may be to pay by itself. `v`: changes, for polling. */
type Conversation = { key: string; members: string[]; messages: Message[]; autopay: Record<string, number>; read: Record<string, string>; v: number };

const MESSAGES_KEPT = 300;
const PHOTOS_KEPT = 10;

const keyOf = (a: string, b: string) => createHash('sha256').update([a, b].sort().join('\n')).digest('hex').slice(0, 32);
const conversations = new Map<string, Conversation>();

function find(a: string, b: string, create = false): Conversation | undefined {
  const key = keyOf(a, b);
  let found = conversations.get(key);
  if (!found && existsSync(chatFile(key))) found = JSON.parse(readFileSync(chatFile(key), 'utf8')) as Conversation;
  if (!found && create) found = { key, members: [a, b].sort(), messages: [], autopay: {}, read: {}, v: 0 };
  if (found) conversations.set(key, found);
  return found;
}

function keep(c: Conversation) {
  c.v += 1;
  c.messages = c.messages.slice(-MESSAGES_KEPT);
  let photos = 0;
  for (const m of [...c.messages].reverse()) if (m.photo && ++photos > PHOTOS_KEPT) delete m.photo;
  write(chatFile(c.key), c);
}

/** Adds a message; the first one puts the chat in both people's lists. */
function post(c: Conversation, message: Omit<Message, 'id' | 'at'>) {
  const m: Message = { id: id('msg'), at: new Date().toISOString(), ...message };
  c.messages.push(m);
  c.read[m.from] = m.at;
  if (c.messages.length === 1) {
    const all = directory();
    const [a, b] = c.members;
    for (const [self, other] of [[a, b], [b, a]]) if (all[self] && !all[self].peers.includes(other)) all[self].peers.push(other);
    write(peopleFile, all);
  }
  keep(c);
  return m;
}

/** A notification on the other person's phone, if they turned them on (push.ts). */
function tell(email: string, title: string, body: string, url: string, tag: string) {
  const there = directory()[email];
  if (there) void push.notify(there.workspace, { title, body, url, tag }).catch((err) => console.error('chat push:', err));
}

const chatUrl = (email: string) => `/chat?with=${encodeURIComponent(email)}`;
const total = (list: Message[]) => cents(list.reduce((sum, m) => sum + (m.amount ?? 0), 0));

// --- Reading ---------------------------------------------------------------------------------

/** Your chats: every friend, and anyone who started one with you, newest first, with what's open between you. */
export function list() {
  const { email, name } = me();
  const emails = new Set([...state.friends.map((f) => norm(f.email)), ...(directory()[email]?.peers ?? [])]);
  emails.delete(email);
  const chats = [...emails].map((other) => {
    const peer = peerOf(other);
    const c = find(email, other);
    const messages = c?.messages ?? [];
    const readAt = c?.read[email] ?? '';
    const open = messages.filter((m) => m.kind === 'request' && m.status === 'open');
    return {
      peer,
      last: messages.at(-1) && { ...messages.at(-1)!, photo: undefined },
      unread: messages.filter((m) => m.from !== email && m.at > readAt).length,
      youOwe: total(open.filter((m) => m.from === other)),
      owedToYou: total(open.filter((m) => m.from === email)),
    };
  });
  chats.sort((a, b) => (b.last?.at ?? '').localeCompare(a.last?.at ?? '') || Number(b.peer.onFlick) - Number(a.peer.onFlick) || a.peer.name.localeCompare(b.peer.name));
  return { me: { email, name }, chats };
}

/** One chat. `v`: the version the page has; unchanged, only that comes back (the page polls). */
export function thread(query: URLSearchParams) {
  const { email, name } = me();
  const peer = peerFor(query.get('with'), email);
  const c = find(email, peer.email);
  const v = c?.v ?? 0;
  if (query.get('v') === String(v)) return { v, same: true };
  const last = c?.messages.at(-1);
  if (c && last && (c.read[email] ?? '') < last.at) {
    c.read[email] = last.at;
    write(chatFile(c.key), c);
  }
  return {
    v,
    me: { email, name },
    peer,
    messages: c?.messages ?? [],
    autopay: { mine: c?.autopay[email] ?? 0, theirs: c?.autopay[peer.email] ?? 0 },
  };
}

/** Requests friends on Flick are waiting for you to pay: Today's inbox (inbox.ts). None for a guest. */
export function waiting() {
  const email = state.profile?.email && norm(state.profile.email);
  if (!email) return [];
  return (directory()[email]?.peers ?? []).flatMap((other) =>
    (find(email, other)?.messages ?? []).filter((m) => m.kind === 'request' && m.status === 'open' && m.from === other).map((m) => ({ ...m, photo: undefined, peer: peerOf(other) })),
  );
}

// --- Talking ---------------------------------------------------------------------------------

const text = (value: unknown, max: number, what = 'text') => {
  need(typeof value === 'string' && value.trim() && value.trim().length <= max, `${what} must be 1 to ${max} characters.`);
  return value.trim();
};

export function send(body: Record<string, unknown>) {
  const { email, name } = me();
  const peer = peerFor(body.with, email);
  need(peer.onFlick, `${peer.name} isn't on Flick yet, so a message can't reach them. A money request can: it goes as a PayPal invoice by email.`, 409);
  const m = post(find(email, peer.email, true)!, { kind: 'text', from: email, text: text(body.text, 1000) });
  tell(peer.email, name, m.text!, chatUrl(email), m.id);
  return m;
}

/**
 * Asks a friend on Flick for money, in your chat: your record of it is a Debt (Nudge, Today and
 * Money Studio follow it). It pays at once if they let your requests pay by themselves.
 */
export async function ask(peer: Peer, amount: number, what: string, extra: { text?: string; photo?: string } = {}) {
  const { email, name } = me();
  const c = find(email, peer.email, true)!;
  const friend = friendFor(peer);
  const debt: Debt = { id: id('debt'), friendId: friend.id, amount, what, createdAt: new Date().toISOString(), status: 'requested', reminders: 0 };
  const m = post(c, { kind: 'request', from: email, amount, what, status: 'open', debtId: debt.id, ...extra });
  debt.chat = { with: peer.email, message: m.id };
  state.debts.unshift(debt);
  log('splitter', `Asked ${friend.name} for ${usd(amount)} in Flick Chat: ${what}`, amount);
  save();

  const cap = c.autopay[peer.email] ?? 0;
  if (cap >= amount) {
    // They allowed it: paid now, from their saved PayPal. If PayPal says no, it stays open for them.
    const payer = directory()[peer.email];
    const savedId = payer && inWorkspace(payer.workspace, () => state.profile?.savedId);
    if (savedId) await settle(c, m, { payer: peer.email, savedId, auto: true }).catch((err) => console.error('chat autopay:', err instanceof Error ? err.message : err));
  }
  if (m.status === 'open') tell(peer.email, `${name} asked you for ${usd(amount)}`, what, chatUrl(email), `chat-${m.id}`);
  return { message: m, debt };
}

/** A money request, in the chat (a friend on Flick) or as a PayPal invoice by email (a friend who isn't). */
export async function request(body: Record<string, unknown>) {
  const { email, name } = me();
  const peer = peerFor(body.with, email);
  const amount = Number(body.amount);
  need(Number.isFinite(amount) && amount >= 0.01 && amount <= 10_000, 'amount must be between $0.01 and $10,000.');
  const what = text(body.what, 80, 'what');
  const note = body.text === undefined || body.text === '' ? undefined : text(body.text, 600);
  need(body.photo === undefined || isPhoto(body.photo), 'photo must be a small JPEG data URL (480px at most).');

  if (peer.onFlick) return ask(peer, cents(amount), what, { ...(note && { text: note }), ...(isPhoto(body.photo) && { photo: body.photo }) });

  const friend = friendFor(peer);
  const debt: Debt = { id: id('debt'), friendId: friend.id, amount: cents(amount), what, createdAt: new Date().toISOString(), status: 'requested', reminders: 0 };
  const invoice = await sendInvoice({ reference: debt.id, to: peer.email, name: friend.name, item: what, amount: debt.amount, note: note ?? `From ${name}, with Flick.` });
  Object.assign(debt, { invoiceId: invoice.id, payerUrl: invoice.payerUrl });
  state.debts.unshift(debt);
  log('splitter', `Asked ${friend.name} for ${usd(debt.amount)} with a PayPal invoice: ${what}`, debt.amount);
  save();
  return { debt, invoice: true };
}

function requestIn(c: Conversation | undefined, messageId: unknown) {
  const m = c?.messages.find((x) => x.id === messageId && x.kind === 'request');
  if (!m) throw new HttpError(404, `No request ${String(messageId)} in this chat.`);
  return m;
}

const NOT_OPEN = { paying: 'This one is being paid right now.', paid: 'This one is already paid.', declined: 'This one was turned down.' } as const;

/** Pays a friend's request from your saved PayPal: no PayPal page. */
export async function pay(body: Record<string, unknown>) {
  const { email } = me();
  const peer = peerFor(body.with, email);
  const c = find(email, peer.email);
  const m = requestIn(c, body.id);
  need(m.from === peer.email, "That's your own request: your friend pays it.", 409);
  need(m.status === 'open', NOT_OPEN[m.status as keyof typeof NOT_OPEN] ?? 'This one is closed.', 409);
  const savedId = state.profile?.savedId;
  need(savedId, 'Sign in with PayPal again to pay from it.', 409);
  return settle(c!, m, { payer: email, savedId });
}

/**
 * Pays request `m` for `payer`: their saved PayPal into Flick's account, then on to the asker's
 * PayPal. Marks it paid in the chat and in the asker's Flick, and tells them.
 */
async function settle(c: Conversation, m: Message, { payer, savedId, auto = false }: { payer: string; savedId: string; auto?: boolean }) {
  const asker = m.from;
  const amount = m.amount!;
  const what = m.what!;
  // Taken before the first await: a second tap, or the request paying by itself, can't pay it twice.
  m.status = 'paying';
  m.tries = (m.tries ?? 0) + 1;
  keep(c);
  try {
    await chargeSaved({ reference: `chat-${m.id}-${m.tries}`, description: `Flick: ${what}`, items: [{ name: what, amount }], savedId, present: !auto });
  } catch (err) {
    m.status = 'open';
    keep(c);
    throw err instanceof PayPalApiError ? declined(err) : err;
  }
  m.status = 'paid';
  m.auto = auto || undefined;
  const people = directory();
  const payerName = people[payer]?.name ?? payer;
  try {
    await createPayout(`chat-${m.id}`, `${payerName} paid you ${usd(amount)} with Flick`, [{ id: m.id, email: asker, amount, note: `${what}, from ${payerName} in Flick Chat` }]);
  } catch (err) {
    console.error('chat payout:', err instanceof Error ? err.message : err);
    m.payout = 'failed';
  }
  post(c, { kind: 'paid', from: payer, about: m.id, amount, what, ...(auto && { auto }) });

  // Both people's Flick: the asker's request is paid; the payer's activity says so.
  const askerName = people[asker]?.name ?? asker;
  if (people[asker]) {
    inWorkspace(people[asker].workspace, () => {
      const debt = state.debts.find((d) => d.id === m.debtId);
      if (debt?.status === 'requested') debt.status = 'paid';
      log('splitter', `${payerName} paid you ${usd(amount)} for ${what}${auto ? ', by itself' : ''}, in Flick Chat`, amount);
      save();
    });
  }
  if (people[payer]) {
    inWorkspace(people[payer].workspace, () => {
      log('splitter', `Paid ${askerName} ${usd(amount)} for ${what}${auto ? ', by itself as you allowed' : ''}`, amount);
      save();
    });
  }
  tell(asker, `${payerName} paid you ${usd(amount)}`, `${what}${auto ? ', by itself' : ''}`, chatUrl(payer), `paid-${m.id}`);
  return m;
}

/** Turns down a friend's request; their Flick lets it go. */
export function decline(body: Record<string, unknown>) {
  const { email, name } = me();
  const peer = peerFor(body.with, email);
  const c = find(email, peer.email);
  const m = requestIn(c, body.id);
  need(m.from === peer.email, "That's your own request.", 409);
  need(m.status === 'open', NOT_OPEN[m.status as keyof typeof NOT_OPEN] ?? 'This one is closed.', 409);
  m.status = 'declined';
  post(c!, { kind: 'note', from: email, about: m.id, text: `${name} turned down ${usd(m.amount!)} for ${m.what}.` });
  const asker = directory()[peer.email];
  if (asker) {
    inWorkspace(asker.workspace, () => {
      const debt = state.debts.find((d) => d.id === m.debtId);
      if (debt?.status === 'requested') debt.status = 'cancelled';
      save();
    });
  }
  return m;
}

/** A reminder about your request, in the chat (Nudge's words, nudge.ts sends it here for a chat's request). */
export function remindIn(debt: Debt, words: string) {
  const { email, name } = me();
  const c = find(email, debt.chat!.with);
  const m = requestIn(c, debt.chat!.message);
  need(m.status === 'open', NOT_OPEN[m.status as keyof typeof NOT_OPEN] ?? 'This one is closed.', 409);
  const reminder = post(c!, { kind: 'reminder', from: email, about: m.id, text: words });
  tell(debt.chat!.with, `${name}: a reminder`, words, chatUrl(email), reminder.id);
  return reminder;
}

/** Nudge writes a reminder in your tone and sends it into the chat. */
export async function remind(body: Record<string, unknown>) {
  const { email } = me();
  const peer = peerFor(body.with, email);
  const m = requestIn(find(email, peer.email), body.id);
  need(m.from === email, "That's their request: pay it, or turn it down.", 409);
  const debt = state.debts.find((d) => d.id === m.debtId);
  need(debt, "This request isn't in your Flick any more.", 409);
  const { text: words } = await nudge.draft({ debtId: debt.id, tone: body.tone });
  return nudge.send({ debtId: debt.id, text: words });
}

/** Lets a friend's requests pay by themselves, from your saved PayPal, up to `cap` each (0 stops it). */
export function allow(body: Record<string, unknown>) {
  const { email, name } = me();
  const peer = peerFor(body.with, email);
  need(peer.onFlick, `${peer.name} isn't on Flick yet.`, 409);
  const cap = Number(body.cap);
  need(Number.isFinite(cap) && cap >= 0 && cap <= 500, 'cap must be between $0 (off) and $500.');
  need(cap === 0 || state.profile?.savedId, 'Sign in with PayPal again first.', 409);
  const c = find(email, peer.email, true)!;
  if ((c.autopay[email] ?? 0) === cap) return { mine: cap };
  if (cap) c.autopay[email] = cents(cap);
  else delete c.autopay[email];
  post(c, { kind: 'note', from: email, text: cap ? `${name}'s Flick now pays ${peer.name}'s requests up to ${usd(cap)} by itself.` : `${name} turned off paying ${peer.name}'s requests by themselves.` });
  return { mine: c.autopay[email] ?? 0 };
}
