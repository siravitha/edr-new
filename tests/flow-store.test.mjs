import test from 'node:test';
import assert from 'node:assert/strict';
import {transitionFlow, emptyFlow} from '../lib/procurement-flow.ts';
import {emptyNumbering} from '../lib/asset-numbering.ts';
import {commitFlowState, getFlowState, listFlowEvents} from '../lib/flow-store.ts';

const TS = '2026-01-01T00:00:00.000Z';
const state = () => ({
  masterData: {vendors: [{id:'v1', name:'ผู้ค้าหนึ่ง', taxId:'0105555555555'}]},
  planning: {
    rounds: [{id:'r1', code:'R-2569', year:2569, status:'OPEN'}],
    demands: [{id:'d1', name:'เครื่องตรวจวัด', quantity:2, unit:'เครื่อง', budget:120000, roundId:'r1', status:'READY'}],
    plans: [{id:'p1', code:'P-2569-001', revision:1, roundId:'r1', status:'SENT', fund:'งบลงทุน', year:2569, department:'ICT',
      snapshots: [{demandId:'d1', name:'เครื่องตรวจวัด', quantity:2, unit:'เครื่อง', ceiling:60000, classification:'ASSET', vendor:{id:'v1', name:'ผู้ค้าหนึ่ง', taxId:'0105555555555'}}]}],
  },
  assets: [], assetNumbering: emptyNumbering(), procurementFlow: emptyFlow(),
});
const person = (role) => ({id: `user-${role}`, role, hospitalId: 'UTH', online: true});
const ev = (ref) => ({name: `${ref}.pdf`, size: 100, mime: 'application/pdf', dataUrl: 'data:application/pdf;base64,x', reference: ref, signed: true});

// Drive one transition in memory (via the real engine) and persist the resulting
// FlowState to the store, passing the pre-transition revision as the CAS expectedVersion.
const step = (h, data, cmd, actor) => {
  const prev = data.procurementFlow.revision;
  const next = transitionFlow(data, cmd, actor, prev, TS).data;
  commitFlowState(h, {state: next.procurementFlow, expectedVersion: prev, event: {actor: actor.id, action: cmd.type}});
  return next;
};

test('flow-store: persists a full procurement round-trip', async () => {
  const h = 'H1';
  assert.deepEqual(getFlowState(h), {version: 0, state: null});

  let data = state();
  const last = () => data.procurementFlow.cases.at(-1);
  data = step(h, data, {type:'CREATE_PR', planId:'p1', demandId:'d1', classification:'SERVICE'}, person('procurement'));
  data = step(h, data, {type:'SUBMIT_PR', id: last().id, evidence: ev('EV1')}, person('procurement'));
  data = step(h, data, {type:'APPROVE_PR', id: last().id, evidence: ev('EV2')}, person('executive'));
  data = step(h, data, {type:'SELECT', id: last().id, method:'เฉพาะเจาะจง', basis:'เฉพาะทาง', evidence: ev('EV3')}, person('procurement'));
  data = step(h, data, {type:'CONTRACT', id: last().id, reference:'CONTRACT-1', vendorId:'v1', unitCost:58000, date:'2026-01-25', delivery:'2026-01-30', annual:[{year:2569, amount:116000}], evidence: ev('EV4')}, person('procurement'));
  data = step(h, data, {type:'RECEIVE', id: last().id, quantity:2, date:'2026-01-28', prefix:'R', year:2569, wardId:'ICT', serials:['S1','S2'], evidence: ev('EV5')}, person('warehouse'));
  data = step(h, data, {type:'CLAIM', id: last().id, receiptId: last().receipts.at(-1).id, invoice:'INV-1', evidence: ev('EV6')}, person('procurement'));
  data = step(h, data, {type:'REVIEW_CLAIM', id: last().id, claimId: last().claims.at(-1).id, reason:'ok', paymentRef:'', evidence: ev('EV7')}, person('finance'));

  const {version, state: stored} = getFlowState(h);
  assert.equal(version, data.procurementFlow.revision);   // server version tracks the flow revision
  assert.deepEqual(stored, data.procurementFlow);          // JSON round-trip equality
  const events = listFlowEvents(h);
  assert.equal(events.length, 8);                           // one audit row per successful commit
  assert.ok(events.every((e) => e.hospitalId === h));
});

test('flow-store: rejects a stale revision (CAS) and keeps state unchanged', async () => {
  const h = 'H2';
  let data = state();
  data = step(h, data, {type:'CREATE_PR', planId:'p1', demandId:'d1', classification:'SERVICE'}, person('procurement'));
  const committed = getFlowState(h);
  assert.equal(committed.version, 1);
  // A replay with a stale expectedVersion must be rejected even though the state is valid.
  assert.throws(() => commitFlowState(h, {state: data.procurementFlow, expectedVersion: 0, event: {actor: 'x', action: 'REPLAY'}}), /conflict/i);
  assert.equal(getFlowState(h).version, committed.version);
  assert.deepEqual(getFlowState(h).state, committed.state);
  assert.equal(listFlowEvents(h).length, 1);               // no audit row for the rejected commit
});

test('flow-store: isolates hospitals', async () => {
  const hA = 'H3', hB = 'H4';
  let a = state();
  a = step(hA, a, {type:'CREATE_PR', planId:'p1', demandId:'d1', classification:'SERVICE'}, person('procurement'));
  commitFlowState(hB, {state: emptyFlow(), expectedVersion: 0, event: {actor: 'b', action: 'INIT'}});
  assert.equal(getFlowState(hA).state.cases.length, 1);
  assert.equal(getFlowState(hB).state.cases.length, 0);
  assert.equal(listFlowEvents(hB).length, 1);
});