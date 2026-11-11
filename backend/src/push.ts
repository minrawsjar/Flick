import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign, type ECDH } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { frontendUrl } from './checkout.ts';
import { need } from './http.ts';
import { items } from './inbox.ts';
import { inWorkspace, workspaceId } from './store.ts';

// Notifications for the installed app, with Web Push and no library:
// - VAPID (RFC 8292) signs each request, so the browser's push service knows it's from Flick.
// - Each message is encrypted for one browser (RFC 8291, aes128gcm); tested against the RFC's example.
// - Every minute, new inbox items (inbox.ts) go out as notifications, once each, after a short delay
//   so what the person just did in the app doesn't ping them.
// Keys and subscriptions live in push.json beside the state file, so /api/reset keeps them.

const file = join(dirname(process.env.STATE_FILE || fileURLToPath(new URL('../.data/state.json', import.meta.url))), 'push.json');

/** `workspace`: whose inbox it hears about (store.ts); none on subscriptions made before workspaces. */
export type Subscription = { endpoint: string; keys: { p256dh: string; auth: string }; workspace?: string };
type Data = { vapid: { publicKey: string; privateKey: string }; subscriptions: Subscription[]; sent: string[]; seen: Record<string, number> };

const b64 = (data: Buffer | string) => Buffer.from(data).toString('base64url');

let data: Data | undefined;
function load(): Data {
  if (data) return data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8')) as Data;
  } catch {
    const ecdh = createECDH('prime256v1');
    ecdh.generateKeys();
    data = { vapid: { publicKey: b64(ecdh.getPublicKey()), privateKey: b64(ecdh.getPrivateKey()) }, subscriptions: [], sent: [], seen: {} };
    persist();
  }
  // Keys set in the environment win (they survive a new volume).
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) data.vapid = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  return data;
}
function persist() {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2));
  renameSync(`${file}.tmp`, file);
}

const hmac = (key: Buffer, ...parts: Buffer[]) => createHmac('sha256', key).update(Buffer.concat(parts)).digest();
const ONE = Buffer.from([1]);

/** Encrypts a message for one subscription (RFC 8291). `salt` and `local` are random except in the test. */
export function encrypt(sub: Subscription, payload: Buffer, salt = randomBytes(16), local?: ECDH) {
  const ecdh = local ?? createECDH('prime256v1');
  if (!local) ecdh.generateKeys();
  const uaPublic = Buffer.from(sub.keys.p256dh, 'base64url');
  const asPublic = ecdh.getPublicKey();
  // HKDF with one block of output each time: extract is an HMAC keyed by the salt, expand an HMAC of info || 0x01.
  const prkKey = hmac(Buffer.from(sub.keys.auth, 'base64url'), ecdh.computeSecret(uaPublic));
  const ikm = hmac(prkKey, Buffer.from('WebPush: info\0'), uaPublic, asPublic, ONE);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0'), ONE).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0'), ONE).subarray(0, 12);
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  // One record: the message, then 0x02 to say it's the last.
  const sealed = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, sealed]);
}

/** The VAPID Authorization header for a push service (RFC 8292): a JWT signed with Flick's key. */
function vapid(endpoint: string) {
  const { publicKey, privateKey } = load().vapid;
  const pub = Buffer.from(publicKey, 'base64url');
  const key = createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: privateKey, x: b64(pub.subarray(1, 33)), y: b64(pub.subarray(33, 65)) }, format: 'jwk' });
  const subject = frontendUrl().startsWith('https://') ? frontendUrl() : 'mailto:flick@flick.example.com';
  const unsigned = `${b64(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))}.${b64(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }))}`;
  return `vapid t=${unsigned}.${b64(sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' }))}, k=${publicKey}`;
}

// Only the browsers' own push services: the server never posts to an address someone made up.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /\.push\.apple\.com$/, /\.notify\.windows\.com$/];
const isPushService = (endpoint: string) => {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && PUSH_HOSTS.some((host) => host.test(url.hostname));
  } catch {
    return false;
  }
};

type Message = { title: string; body: string; url: string; tag: string };

/** Sends to these browsers; drops the ones that have gone (404, 410). Returns how many took it. */
async function sendTo(subs: Subscription[], message: Message) {
  const d = load();
  let delivered = 0;
  for (const sub of subs) {
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: { Authorization: vapid(sub.endpoint), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'normal' },
      body: encrypt(sub, Buffer.from(JSON.stringify(message))),
      signal: AbortSignal.timeout(10_000),
    }).catch((err: Error) => ({ ok: false, status: 0, text: async () => err.message }));
    if (res.ok) delivered++;
    else if (res.status === 404 || res.status === 410) d.subscriptions = d.subscriptions.filter((s) => s.endpoint !== sub.endpoint);
    else console.error(`push: ${new URL(sub.endpoint).hostname} answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  persist();
  return delivered;
}

export const publicKey = () => ({ publicKey: load().vapid.publicKey });

export async function subscribe(body: Record<string, unknown>) {
  const sub = body.subscription as Subscription | undefined;
  need(sub && typeof sub.endpoint === 'string' && isPushService(sub.endpoint), "That isn't a browser push subscription.");
  need(typeof sub.keys?.p256dh === 'string' && typeof sub.keys?.auth === 'string', 'The subscription is missing its keys.');
  const d = load();
  const added: Subscription = { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, workspace: workspaceId() };
  // ponytail: the 500 newest browsers across every workspace; a table per workspace past that.
  d.subscriptions = [...d.subscriptions.filter((s) => s.endpoint !== sub.endpoint), added].slice(-500);
  persist();
  const delivered = await sendTo([added], { title: 'Flick notifications are on', body: "Your agents tell you here when something needs you.", url: '/home', tag: 'welcome' });
  return { subscribed: true, delivered };
}

/** A browser's notifications follow it into the Flick it signs in to (account.ts). */
export function move(from: string, to: string) {
  const d = load();
  for (const s of d.subscriptions) if ((s.workspace ?? 'local') === from) s.workspace = to;
  persist();
}

export function unsubscribe(body: Record<string, unknown>) {
  const d = load();
  d.subscriptions = d.subscriptions.filter((s) => s.endpoint !== body.endpoint);
  persist();
  return { subscribed: false };
}

const DELAY = Number(process.env.PUSH_DELAY_MS ?? 120_000);

/** Sends each workspace's browsers its inbox items that are new since last time (at most three at once), each only once. */
export async function check() {
  const d = load();
  const now = Date.now();
  let sent = 0;
  for (const workspace of new Set(d.subscriptions.map((s) => s.workspace ?? 'local'))) {
    // Items are keyed by workspace too: two people's "Pay City Power" are two notifications.
    const open = inWorkspace(workspace, items).map((i) => ({ ...i, key: `${workspace}:${i.id}` }));
    const keys = new Set(open.map((i) => i.key));
    for (const key of Object.keys(d.seen)) if (key.startsWith(`${workspace}:`) && !keys.has(key)) delete d.seen[key];
    const fresh = open.filter((i) => !d.sent.includes(i.key));
    for (const i of fresh) d.seen[i.key] ??= now;
    const browsers = d.subscriptions.filter((s) => (s.workspace ?? 'local') === workspace);
    for (const item of fresh.filter((i) => now - d.seen[i.key] >= DELAY).slice(0, 3)) {
      await sendTo(browsers, { title: item.title, body: item.detail, url: item.href, tag: item.id });
      d.sent = [...d.sent, item.key].slice(-3000);
      sent++;
    }
  }
  persist();
  return sent;
}

export function start() {
  setInterval(() => void check().catch((err) => console.error('push:', err)), 60_000).unref();
}
