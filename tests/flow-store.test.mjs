import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyFlow} from '../lib/procurement-flow.ts';
import {commitFlowState, getFlowState, listFlowEvents, FlowConflictError} from '../lib/flow-store.ts';

// A minimal valid per-hospital FlowState (the flow-store treats it as opaque JSON).
const flowState = (revision, nCases) => ({
  ...emptyFlow(),
  revision,
  cases: Array.from({length: nCases}, (_, i) => ({id: `c${i}`, status: 'DRAFT'})),
});

// In-memory stand-in for the Prisma client the flow-store talks to (DI).
// Models the exact calls flow-store makes: findUnique / updateMany (CAS) / create / findMany.
function makeDb() {
  const docs = new Map(); // hospitalId -> doc row
  const events = [];      // audit rows
  const flowStateDoc = {
    async findUnique({where}) { return docs.get(where.hospitalId) ?? null; },
    async updateMany({where, data}) {
      const d = docs.get(where.hospitalId);
      if (!d || d.version !== where.version) return {count: 0};
      Object.assign(d, {state: data.state, version: data.version, updatedAt: new Date()});
      return {count: 1};
    },
    async create({data}) {
      if (docs.has(data.hospitalId)) { const err = new Error('Unique constraint failed'); err.code = 'P2002'; throw err; }
      const row = {id: `doc-${data.hospitalId}`, hospitalId: data.hospitalId, state: data.state, version: data.version, createdAt: new Date(), updatedAt: new Date()};
      docs.set(data.hospitalId, row);
      return row;
    },
  };
  const flowEvent = {
    async create({data}) { const row = {id: `ev-${events.length + 1}`, at: new Date(), ...data}; events.push(row); return row; },
    async findMany({where, take}) {
      const rows = events.filter(e => (!where.hospitalId || e.hospitalId === where.hospitalId) && (!where.caseId || e.caseId === where.caseId));
      rows.sort((a, b) => b.at - a.at || b.id.localeCompare(a.id));
      return rows.slice(0, take ?? 5000);
    },
  };
  return {flowStateDoc, flowEvent, $transaction: (fn) => fn({flowStateDoc, flowEvent})};
}

test('getFlowState returns null before any commit', async () => {
  assert.equal(await getFlowState(makeDb(), 'H1'), null);
});

test('commitFlowState creates version 1 and getFlowState round-trips it', async () => {
  const db = makeDb();
  const rec = await commitFlowState(db, 'H1', flowState(1, 2), 0, {action: 'INIT', actorId: 'u1', actorRole: 'ADMIN'});
  assert.equal(rec.hospitalId, 'H1');
  assert.equal(rec.version, 1);
  assert.ok(typeof rec.updatedAt === 'string');
  const got = await getFlowState(db, 'H1');
  assert.equal(got.version, 1);
  assert.equal(got.state.revision, 1);
  assert.equal(got.state.cases.length, 2);
  assert.equal(got.state.cases[0].id, 'c0');
});

test('sequential commits advance the stored version and state', async () => {
  const db = makeDb();
  await commitFlowState(db, 'H1', flowState(1, 1), 0, {action: 'C1'});
  const rec = await commitFlowState(db, 'H1', flowState(2, 3), 1, {action: 'C2'});
  assert.equal(rec.version, 2);
  assert.equal((await getFlowState(db, 'H1')).state.cases.length, 3);
});

test('stale expectedVersion throws FlowConflictError and leaves the document unchanged', async () => {
  const db = makeDb();
  await commitFlowState(db, 'H1', flowState(1, 1), 0, {action: 'C1'});
  const before = await getFlowState(db, 'H1');
  await assert.rejects(() => commitFlowState(db, 'H1', flowState(9, 9), 0, {action: 'STALE'}), FlowConflictError);
  const after = await getFlowState(db, 'H1');
  assert.deepEqual(after.state, before.state);
  assert.equal(after.version, before.version);
});

test('the first commit must use expectedVersion 0', async () => {
  await assert.rejects(() => commitFlowState(makeDb(), 'H1', flowState(1, 1), 1, {action: 'BAD'}), FlowConflictError);
});

test('commitFlowState validates its inputs', async () => {
  const db = makeDb();
  await assert.rejects(() => commitFlowState(db, '', flowState(1, 1), 0), /hospitalId/);
  await assert.rejects(() => commitFlowState(db, 'H1', {revision: 'x'}, 0), /revision/);
  await assert.rejects(() => commitFlowState(db, 'H1', flowState(1, 1), -1), /expectedVersion/);
});

test('listFlowEvents returns the audit trail scoped by hospital and case', async () => {
  const db = makeDb();
  await commitFlowState(db, 'H1', flowState(1, 1), 0, {action: 'CREATE', actorId: 'u1', actorRole: 'ADMIN', caseId: 'c0'});
  await commitFlowState(db, 'H1', flowState(2, 2), 1, {action: 'SUBMIT', actorId: 'u2', actorRole: 'WAREHOUSE', caseId: 'c0'});
  await commitFlowState(db, 'H2', flowState(1, 1), 0, {action: 'OTHER', actorId: 'u9', caseId: 'x'});
  const all = await listFlowEvents(db, 'H1');
  assert.equal(all.length, 2);
  assert.equal(all[0].action, 'SUBMIT');
  assert.equal(all[0].revision, 2);
  assert.equal(all[0].actorId, 'u2');
  assert.ok(all.every(e => e.hospitalId === 'H1'));
  assert.equal((await listFlowEvents(db, 'H1', 'c0')).length, 2);
  assert.equal((await listFlowEvents(db, 'H1', 'missing')).length, 0);
});

test('hospitals are isolated with no crosstalk', async () => {
  const db = makeDb();
  await commitFlowState(db, 'H-A', flowState(1, 1), 0, {action: 'A'});
  await commitFlowState(db, 'H-B', flowState(1, 3), 0, {action: 'B'});
  assert.equal((await getFlowState(db, 'H-A')).state.cases.length, 1);
  assert.equal((await getFlowState(db, 'H-B')).state.cases.length, 3);
  assert.equal((await getFlowState(db, 'H-A')).hospitalId, 'H-A');
  assert.equal((await getFlowState(db, 'H-B')).hospitalId, 'H-B');
});