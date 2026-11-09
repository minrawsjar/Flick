import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { id, type Agent, type State } from './model.ts';
import { seed } from './seed.ts';

// Everything Flick knows, in one JSON document: kept in memory, written to disk after each change.
// ponytail: single-process, single-user JSON store; move to Postgres when there's more than one person.

const file = process.env.STATE_FILE || fileURLToPath(new URL('../.data/state.json', import.meta.url));

function load(): State {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as State;
  } catch {
    return seed();
  }
}

export const state: State = load();

/** Writes the state to disk; call after every change. Atomic, so a crash never leaves half a file. */
export function save() {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(`${file}.tmp`, JSON.stringify(state, null, 2));
  renameSync(`${file}.tmp`, file);
}

/** Back to the demo's starting point. */
export function reset(now = new Date()) {
  Object.assign(state, seed(now));
  save();
}

/** Records what an agent just did, newest first. */
export function log(agent: Agent, text: string, amount?: number) {
  state.activity.unshift({ id: id('act'), at: new Date().toISOString(), agent, text, amount });
  state.activity.length = Math.min(state.activity.length, 200);
}

export const payee = (payeeId: string) => state.payees.find((p) => p.id === payeeId);
export const friend = (friendId: string) => state.friends.find((f) => f.id === friendId);
