import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionAsset, transitionPayment } from '../lib/domain.mjs';

const actor = { id: 'staff1', hospitalId: 'UTH', wardIds: ['ICU'], role: 'warehouse', deviceId: 'tablet1' };
const initial = () => ({ assets: [{ id: 'asset1', hospitalId: 'UTH', wardId: 'ICU', status: 'AVAILABLE', version: 4 }], receipts: [], conflicts: [], audit: [] });
const cmd = (overrides = {}) => ({ id: 'op1', assetId: 'asset1', baseVersion: 4, nextStatus: 'IN_USE', deviceId: 'tablet1', ...overrides });

test('คำสั่งซ้ำไม่เพิ่ม version หรือ audit และไม่แก้ state เดิม', () => {
  const state = initial();
  const first = transitionAsset(state, cmd(), actor);
  assert.equal(first.result.status, 'APPLIED');
  assert.equal(state.assets[0].version, 4);
  const repeated = transitionAsset(first.state, cmd(), actor);
  assert.equal(repeated.result.replayed, true);
  assert.equal(repeated.state.assets[0].version, 5);
  assert.equal(repeated.state.audit.length, 1);
  assert.equal(transitionAsset(first.state, cmd({ nextStatus: 'REPAIR' }), actor).result.code, 'IDEMPOTENCY_KEY_REUSED');
});

test('แท็บเล็ตที่สองส่งฐานเก่าต้องเข้าคิวข้อขัดแย้ง และ retry ไม่ซ้ำ', () => {
  const first = transitionAsset(initial(), cmd(), actor);
  const secondActor = { ...actor, deviceId: 'tablet2' };
  const secondCommand = cmd({ id: 'op2', deviceId: 'tablet2', nextStatus: 'REPAIR' });
  const second = transitionAsset(first.state, secondCommand, secondActor);
  assert.equal(second.result.status, 'CONFLICT');
  assert.equal(second.state.assets[0].status, 'IN_USE');
  assert.equal(second.state.conflicts.length, 1);
  assert.equal(second.state.audit.length, 2);
  assert.equal(transitionAsset(second.state, secondCommand, secondActor).state.conflicts.length, 1);
});

test('ป้องกันข้ามโรงพยาบาล ข้ามวอร์ด ปลอมเครื่อง และสิทธิ์อ่านอย่างเดียว', () => {
  for (const modified of [{ hospitalId: 'OTHER' }, { wardIds: ['ER'] }, { deviceId: 'fake' }, { role: 'auditor' }]) {
    const result = transitionAsset(initial(), cmd(), { ...actor, ...modified });
    assert.equal(result.result.status, 'REJECTED');
    assert.equal(result.state.audit.length, 0);
  }
});

test('prototype และข้อความแทรกไม่เปลี่ยน dictionary หรือสถานะ', () => {
  assert.equal(transitionAsset(initial(), cmd({ nextStatus: '__proto__' }), actor).result.code, 'INVALID_COMMAND');
  assert.equal(transitionAsset(initial(), cmd({ assetId: "x' OR 1=1 --" }), actor).result.code, 'INVALID_COMMAND');
  const inherited = Object.create(cmd());
  assert.equal(transitionAsset(initial(), inherited, actor).result.code, 'INVALID_COMMAND');
  const harmless = transitionAsset(initial(), cmd({ id: '__proto__' }), actor);
  assert.equal(harmless.result.status, 'APPLIED');
  assert.equal(Object.prototype.polluted, undefined);
});

test('ห้ามนำจำหน่ายแล้วกลับใช้ และซ่อมต้องผ่านการตรวจ', () => {
  for (const status of ['DISPOSED', 'REPAIR']) {
    const state = initial(); state.assets[0].status = status;
    assert.equal(transitionAsset(state, cmd({ nextStatus: 'AVAILABLE' }), actor).result.code, 'INVALID_TRANSITION');
  }
  const state = initial(); state.assets[0].status = 'REPAIR';
  assert.equal(transitionAsset(state, cmd({ nextStatus: 'QUARANTINED' }), actor).result.status, 'APPLIED');
});

const buyer = { ...actor, role: 'procurement' };
const finance = { ...actor, id: 'staff2', role: 'finance' };
test('PO ปิดแล้วการเงินคืนเอกสารได้ และส่ง revision ใหม่โดยไม่เปลี่ยนฉบับเดิม', () => {
  const original = { id: 'pay1', hospitalId: 'UTH', poStatus: 'CLOSED', status: 'DRAFT', revision: 1 };
  const submitted = transitionPayment(original, 'SUBMIT', buyer).payment;
  const returned = transitionPayment(submitted, 'RETURN', finance, { reason: 'ขาดใบตรวจรับ' }).payment;
  assert.equal(returned.status, 'RETURNED');
  const revised = transitionPayment(returned, 'RESUBMIT', buyer).payment;
  assert.equal(revised.revision, 2);
  assert.equal(returned.revision, 1);
  assert.equal(revised.poStatus, 'CLOSED');
  assert.equal(revised.evidenceComplete, false);
});

test('การอนุมัติต้องมีหลักฐานครบและห้ามผู้ทำอนุมัติเอง', () => {
  const submitted = { id: 'pay1', hospitalId: 'UTH', status: 'SUBMITTED', revision: 1, makerId: buyer.id };
  assert.equal(transitionPayment(submitted, 'APPROVE', finance).result.code, 'EVIDENCE_REQUIRED');
  assert.equal(transitionPayment(submitted, 'APPROVE', { ...finance, id: buyer.id }, { evidenceComplete: true, signatureVerified: true }).result.code, 'SEGREGATION_OF_DUTIES');
  assert.equal(transitionPayment(submitted, 'PAY', finance).result.status, 'REJECTED');
  const approved = transitionPayment(submitted, 'APPROVE', finance, { evidenceComplete: true, signatureVerified: true }).payment;
  assert.equal(transitionPayment(approved, 'PAY', finance).payment.status, 'PAID');
  assert.equal(transitionPayment(approved, 'RETURN', finance, { reason: 'แก้ไข' }).result.status, 'REJECTED');
});
