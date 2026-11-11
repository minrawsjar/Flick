import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onFlick, workspaceFor } from './account.ts';
import { isWorkspaceId } from './store.ts';

test("a PayPal account's workspace is the same every time, whatever the case, and a valid id", () => {
  const id = workspaceFor('Maya@Example.com');
  assert.equal(id, workspaceFor(' maya@example.com '));
  assert.notEqual(id, workspaceFor('leo@example.com'));
  assert.ok(isWorkspaceId(id), id);
});

test("the workspace id doesn't show the account it's for", () => {
  assert.ok(!workspaceFor('maya@example.com').includes('maya'));
});

test('after signing in, only a page on Flick: never another site', () => {
  assert.equal(onFlick('/lens'), '/lens');
  assert.equal(onFlick('/autopilot?x=1'), '/autopilot?x=1');
  for (const away of ['//evil.example', 'https://evil.example', '/\\evil.example', 'javascript:alert(1)', '', undefined, 42]) assert.equal(onFlick(away), '/home', String(away));
});
