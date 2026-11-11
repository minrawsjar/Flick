// What the end-to-end scripts share (api.ts, loop.ts, and frontend/scripts/e2e.mjs through
// `node scripts/harness.ts <port>`): Flick's backend on its own port and a throwaway state file, so
// your data is untouched; a JSON client for it; and a checklist that prints as it goes.

import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type Json = Record<string, any>;
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Starts the backend on `port` with a fresh state file; it stops when this process does. */
export async function startBackend(port: number, env: Record<string, string> = {}) {
  const base = `http://localhost:${port}`;
  const server = spawn(process.execPath, [new URL('../src/server.ts', import.meta.url).pathname], {
    env: { ...process.env, PORT: String(port), STATE_FILE: join(mkdtempSync(join(tmpdir(), 'flick-test-')), 'state.json'), FRONTEND_URL: base, PUSH_DELAY_MS: '0', AI_HOURLY_LIMIT: '1000', ...env },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  process.on('exit', () => server.kill());
  // Killed (by e2e.mjs, or Ctrl-C), still take the backend down: 'exit' handlers don't run on signals.
  for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => process.exit(1));
  for (let i = 0; !(await fetch(`${base}/api/health`).then((r) => r.ok, () => false)); i++) {
    if (i > 50) throw new Error(`The backend didn't start on ${base}.`);
    await sleep(200);
  }
  return base;
}

/** A client for one backend: `call` returns the status and JSON; `api` expects success and returns the JSON. */
export function client(base: string) {
  async function call(path: string, body?: unknown, init: RequestInit = {}) {
    const res = await fetch(`${base}/api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      redirect: 'manual',
      ...init,
    });
    const text = await res.text();
    let json: Json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {}
    return { status: res.status, json, headers: res.headers };
  }
  async function api(path: string, body?: unknown) {
    const { status, json } = await call(path, body);
    if (status >= 300) throw new Error(`${path} answered ${status}: ${json?.error?.message ?? ''}`);
    return json;
  }
  /** Expects an error status, and that its message mentions `says`. */
  async function refuses(path: string, body: unknown, status: number, says?: string) {
    const res = await call(path, body);
    if (res.status !== status) throw new Error(`${path} answered ${res.status}, not ${status}: ${res.json?.error?.message ?? JSON.stringify(res.json).slice(0, 120)}`);
    if (says && !String(res.json?.error?.message ?? '').toLowerCase().includes(says.toLowerCase())) throw new Error(`${path}'s ${status} says "${res.json?.error?.message}", not "${says}"`);
  }
  return { call, api, refuses };
}

export function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}

/** A checklist: each step prints ✓ or ✗ as it finishes; `done` prints the tally and exits. */
export function checklist() {
  let passed = 0;
  const failed: string[] = [];
  async function step(name: string, work: () => Promise<string | void>) {
    const started = Date.now();
    try {
      const note = await work();
      passed++;
      console.log(`✓ ${name}${note ? `: ${note}` : ''} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    } catch (err) {
      failed.push(name);
      console.log(`✗ ${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const section = (title: string) => console.log(`\n${title}`);
  function done() {
    console.log(`\n${passed} of ${passed + failed.length} passed.${failed.length ? ` Failed: ${failed.join('; ')}` : ''}`);
    process.exit(failed.length ? 1 : 0);
  }
  return { step, section, done };
}

// `node scripts/harness.ts 4200`: just the throwaway backend, for the frontend's end-to-end test.
// STATE_FILE set: its folder holds the workspaces, so the test can add a person to it (Flick Chat).
if (import.meta.url === `file://${process.argv[1]}`) {
  const base = await startBackend(Number(process.argv[2] ?? 4200), {
    ...(process.argv[3] && { FRONTEND_URL: process.argv[3] }),
    ...(process.env.STATE_FILE && { STATE_FILE: process.env.STATE_FILE }),
  });
  console.log(`ready ${base}`);
  await new Promise(() => {});
}
