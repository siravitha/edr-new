import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeOfflineCommand, barcodeSchema, INPUT_APPROVAL_POLICY } from '../backend/dist/policy.js';

const envelope = () => ({
  policy: { status: 'APPROVED', approvalReference: 'TEST-FIXTURE-ONLY', approvedBy: 'test-approver',
    approvedAtMs: 1000, ttlSeconds: 60, allowedActions: ['OBSERVE_PRESENT'] },
  command: { action: 'OBSERVE_PRESENT', assetId: 'asset1', deviceId: 'tablet1', barcode: 'UTH-69-00001' },
  trusted: {
    actor: { id: 'staff1', hospitalId: 'UTH', role: 'WAREHOUSE', wardIds: ['ICU'], active: true },
    device: { id: 'tablet1', hospitalId: 'UTH', active: true, assignedActorId: 'staff1' },
    asset: { id: 'asset1', hospitalId: 'UTH', wardId: 'ICU', barcode: 'UTH-69-00001' },
    serverReceivedAtMs: 2000, leaseIssuedAtMs: 1000, leaseRevoked: false,
  },
});

test('นโยบายยังไม่อนุมัติต้องไม่รับคำสั่งโดยปริยาย', () => {
  for (const input of [undefined, {}, { policy: { status: 'UNSPECIFIED' } }, { policy: { status: 'PENDING' } }]) {
    assert.deepEqual(authorizeOfflineCommand(input), { allowed: false, code: 'OFFLINE_POLICY_UNAPPROVED' });
  }
  assert.equal(INPUT_APPROVAL_POLICY.status, 'SCANNING_ONLY');
  assert.equal(INPUT_APPROVAL_POLICY.ocr, 'PENDING_APPROVAL');
});

test('barcode ยอมรับเฉพาะป้าย asset และตัด CRLF เฉพาะท้าย', () => {
  assert.equal(barcodeSchema.parse('uth-69-00001\r\n'), 'UTH-69-00001');
  for (const code of ['https://uth.test/?HN=123456', '1234567890123', "UTH-69-00001' OR 1=1", 'UTH-69-00\n001', 'UTH-69-00\u0000001', ' UTH-69-00001', 'UTH-69-00001\t']) {
    assert.equal(barcodeSchema.safeParse(code).success, false, code);
  }
});

test('อนุญาตเฉพาะ draft observation และไม่แก้ envelope', () => {
  const input = envelope();
  const before = structuredClone(input);
  assert.equal(authorizeOfflineCommand(input).code, 'DRAFT_OBSERVATION_ONLY');
  assert.deepEqual(input, before);
});

test('อายุ lease ใช้เวลารับที่เซิร์ฟเวอร์ ไม่ใช่นาฬิกาแท็บเล็ต', () => {
  const input = envelope();
  input.command.capturedAt = '1900-01-01T00:00:00Z';
  assert.equal(authorizeOfflineCommand(input).allowed, true);
  input.trusted.serverReceivedAtMs = 61000;
  input.command.capturedAt = '2999-01-01T00:00:00Z';
  assert.equal(authorizeOfflineCommand(input).code, 'OFFLINE_LEASE_EXPIRED_OR_INVALID');
  input.trusted.serverReceivedAtMs = 999;
  assert.equal(authorizeOfflineCommand(input).allowed, false);
});

test('ปฏิเสธ device ถอนสิทธิ์ ปลอมเครื่อง ข้ามวอร์ด ข้ามโรงพยาบาล และ unknown role', () => {
  for (const modify of [
    v => { v.trusted.device.active = false; },
    v => { v.trusted.actor.active = false; },
    v => { v.trusted.leaseRevoked = true; },
    v => { v.command.deviceId = 'tablet2'; },
    v => { v.trusted.device.assignedActorId = 'someone-else'; },
    v => { v.trusted.asset.wardId = 'ER'; },
    v => { v.trusted.device.hospitalId = 'OTHER'; },
    v => { v.trusted.actor.role = 'SUPERADMIN'; },
    v => { delete v.trusted.serverReceivedAtMs; },
  ]) {
    const input = envelope(); modify(input);
    assert.equal(authorizeOfflineCommand(input).allowed, false);
  }
});

test('นโยบายอนุมัติยังไม่ให้ offline money/writeoff หรือเปิด allowlist เอง', () => {
  for (const action of ['PAY', 'APPROVE_PAYMENT', 'DISPOSE', 'WRITE_OFF', 'RECEIVE_COMMISSION']) {
    const input = envelope(); input.command.action = action; input.policy.allowedActions.push(action);
    assert.equal(authorizeOfflineCommand(input).allowed, false, action);
  }
  const input = envelope(); input.command.action = 'REPORT_DAMAGE_DRAFT';
  assert.equal(authorizeOfflineCommand(input).code, 'OFFLINE_ACTION_NOT_APPROVED');
});

test('barcode รองรับเลขทางการ 4 และ 5 หลักโดยไม่รับศูนย์ทั้งชุด',()=>{for(const code of ['7110-010-0001/69','7110-010-00001/70'])assert.equal(barcodeSchema.safeParse(code).success,true);for(const code of ['7110-010-00000/70','7110-010-0000/69','7110-010-00001/70 OR 1=1'])assert.equal(barcodeSchema.safeParse(code).success,false);});
