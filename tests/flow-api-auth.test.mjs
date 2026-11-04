import test from 'node:test';
import assert from 'node:assert/strict';
import { can, ALL_ACTIONS } from '../lib/rbac.mjs';

// Locks in the RBAC POLICY enforced by the flow-state endpoints
// (app/api/flows/state and app/api/flows/state/events), which call
// lib/api-guard.requireAction() -> canDoAction(actor, action).
//
// We import lib/rbac.mjs (pure ESM, no Next/Prisma deps) because it carries
// the same role→action matrix and is testable under `node --test`.
//
//   GET  (read state / audit trail)  -> 'approvals:read'   all 4 roles
//   POST (commit / advance the flow) -> 'approvals:decide' ADMIN + WAREHOUSE only
//
// can(role: string, action: string) — first arg is the role string.
const READ = 'approvals:read';
const WRITE = 'approvals:decide';
const ALL_ROLES = ['ADMIN', 'WAREHOUSE', 'WARD', 'AUDITOR'];

test('flow-state actions are part of the RBAC action set', () => {
  assert.ok(ALL_ACTIONS.includes(READ), 'approvals:read must be a known action');
  assert.ok(ALL_ACTIONS.includes(WRITE), 'approvals:decide must be a known action');
});

test('reading flow state is allowed for every role', () => {
  for (const role of ALL_ROLES) {
    assert.equal(can(role, READ), true, `${role} should be able to read flow state`);
  }
});

test('committing flow state is restricted to the deciding roles (ADMIN, WAREHOUSE)', () => {
  assert.equal(can('ADMIN', WRITE), true, 'ADMIN may commit flow state');
  assert.equal(can('WAREHOUSE', WRITE), true, 'WAREHOUSE may commit flow state');
  assert.equal(can('WARD', WRITE), false, 'WARD must NOT commit flow state');
  assert.equal(can('AUDITOR', WRITE), false, 'AUDITOR must NOT commit flow state (read-only)');
});
