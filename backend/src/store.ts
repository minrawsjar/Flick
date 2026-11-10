import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { id, type Agent, type State } from './model.ts';
import { blank, seed } from './seed.ts';

// Everything Flick knows for one person, their workspace: one JSON document, kept in memory and
// written to disk after each change. Every browser gets its own workspace id from the frontend
// (frontend/proxy.ts), so what one visitor snaps, adds and pays is theirs alone, and starts empty.
// Without an id (the tests, scripts, curl) it's the "local" workspace, which starts from the demo seed.
//
// `state` is the current request's workspace (server.ts runs each request inside `inWorkspace`), so
// the agents read and write `state` as if there were only one.
// ponytail: every opened workspace stays in memory; evict idle ones, or move to Postgres, past a few thousand visitors.

const local = process.env.STATE_FILE || fileURLToPath(new URL('../.data/state.json', import.meta.url));
const fileOf = (workspaceId: string) => (workspaceId === 'local' ? local : join(dirname(local), 'workspaces', `${workspaceId}.json`));
const fresh = (workspaceId: string, now = new Date()) => (workspaceId === 'local' ? seed(now) : blank(now));

/** A workspace id the frontend made: random, so it can't name a file outside the workspaces folder. */
export const isWorkspaceId = (value: string) => /^[A-Za-z0-9_-]{16,64}$/.test(value);

type Workspace = { id: string; state: State };
const opened = new Map<string, Workspace>();
const current = new AsyncLocalStorage<Workspace>();

function open(workspaceId: string): Workspace {
  let workspace = opened.get(workspaceId);
  if (!workspace) {
    let state: State;
    try {
      state = JSON.parse(readFileSync(fileOf(workspaceId), 'utf8')) as State;
    } catch {
      state = fresh(workspaceId);
    }
    workspace = { id: workspaceId, state };
    opened.set(workspaceId, workspace);
  }
  return workspace;
}

/** Runs `work` in a workspace: everything it does to `state` is that workspace's. */
export const inWorkspace = <T>(workspaceId: string, work: () => T): T => current.run(open(workspaceId), work);
/** Runs `work` on a throwaway copy of the demo seed (Money Studio's sample, before you've paid anything). */
export const inSample = <T>(work: () => T): T => current.run({ id: 'sample', state: seed() }, work);

const here = () => current.getStore() ?? open('local');
export const workspaceId = () => here().id;

export const state = new Proxy({} as State, {
  get: (_, key) => Reflect.get(here().state, key),
  set: (_, key, value) => Reflect.set(here().state, key, value),
  deleteProperty: (_, key) => Reflect.deleteProperty(here().state, key),
  has: (_, key) => Reflect.has(here().state, key),
  ownKeys: () => Reflect.ownKeys(here().state),
  getOwnPropertyDescriptor: (_, key) => {
    const descriptor = Reflect.getOwnPropertyDescriptor(here().state, key);
    return descriptor && { ...descriptor, configurable: true };
  },
});

/** Writes the workspace to disk; call after every change. Atomic, so a crash never leaves half a file. */
export function save() {
  const { id: workspaceId, state: data } = here();
  if (workspaceId === 'sample') return;
  const file = fileOf(workspaceId);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2));
  renameSync(`${file}.tmp`, file);
}

/** Back to the start: empty for a visitor, the demo seed for "local". */
export function reset(now = new Date()) {
  // Clear first: anything the start doesn't have (e.g. Scout's purchases) starts over too.
  for (const key of Object.keys(state)) delete state[key as keyof State];
  Object.assign(state, fresh(workspaceId(), now));
  save();
}

/** Records what an agent just did, newest first. */
export function log(agent: Agent, text: string, amount?: number) {
  state.activity.unshift({ id: id('act'), at: new Date().toISOString(), agent, text, amount });
  state.activity.length = Math.min(state.activity.length, 200);
}

export const payee = (payeeId: string) => state.payees.find((p) => p.id === payeeId);
export const friend = (friendId: string) => state.friends.find((f) => f.id === friendId);
