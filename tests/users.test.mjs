import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoUsers, saveDemoUser, toggleDemoUser, normalizeDemoUsers, cancelDemoUser } from '../lib/users.mjs';
const draft = { staffCode:'demo-003', fullName:'บุคลากรตัวอย่าง', position:'ผู้อำนวยการโรงพยาบาล', departmentId:'ICU', role:'nurse', authority:'NONE', orderRef:'', startsOn:'2026-11-01', endsOn:'' };
const context = { actorRole:'admin', allowedDepartments:['ICU','IT'], newId:'demo-new' };

test('เลขผู้ใช้ USR สี่หลักแยกจากเลขพนักงานและคงเดิมเมื่อแก้ไข', () => {
  const users = createDemoUsers();
  assert.deepEqual(users.map(user => user.code), ['USR-0001', 'USR-0002']);
  const added = saveDemoUser(users, { ...draft, code: 'USR-7777' }, context);
  assert.equal(added[2].code, 'USR-0003');
  assert.equal(added[2].staffCode, 'DEMO-003');
  const edited = saveDemoUser(added, { ...added[2], staffCode: 'NEW-STAFF', code: 'USR-8888' }, context);
  assert.equal(edited[2].code, 'USR-0003');
  assert.equal(edited[2].staffCode, 'NEW-STAFF');
  assert.match(edited[2].code, /^[A-Z]{1,3}-\d{4}$/);
});

test('ย้าย legacy โดยไม่แย่งเลขเดิม ไม่เติมช่องว่าง และไม่แก้ข้อมูลเดิม', () => {
  const legacy = createDemoUsers().map(({ code, ...user }) => user);
  legacy[1].code = 'USR-0010';
  const normalized = normalizeDemoUsers(legacy);
  assert.equal(normalized[0].code, 'USR-0011');
  assert.equal(normalized[1].code, 'USR-0010');
  assert.equal(legacy[0].code, undefined);
  assert.equal(normalized[0].staffCode, legacy[0].staffCode);
  assert.deepEqual(normalizeDemoUsers(normalized), normalized);
  assert.throws(() => normalizeDemoUsers([{ ...legacy[0], code: 'USR-0000' }]));
  assert.throws(() => normalizeDemoUsers([{ ...legacy[0], code: 'USR-12345' }]));
  assert.throws(() => normalizeDemoUsers([{ ...legacy[0], code: 'USR-0010' }, legacy[1]]));
});

test('ยกเลิกต้องมีเหตุผล เป็นสถานะสุดท้าย และเลขเดิมไม่ถูกใช้ซ้ำ', () => {
  const users = saveDemoUser(createDemoUsers(), draft, context);
  assert.throws(() => cancelDemoUser(users, 'demo-new', 'admin', '  '));
  assert.throws(() => cancelDemoUser(users, 'demo-new', 'nurse', 'ซ้ำ'));
  const cancelled = cancelDemoUser(users, 'demo-new', 'admin', '  บุคลากรลาออก  ');
  assert.equal(cancelled[2].status, 'CANCELLED');
  assert.equal(cancelled[2].cancellationReason, 'บุคลากรลาออก');
  assert.equal(cancelled[2].code, 'USR-0003');
  assert.equal(users[2].status, 'PENDING_IDENTITY');
  assert.throws(() => toggleDemoUser(cancelled, 'demo-new', 'admin'));
  assert.throws(() => saveDemoUser(cancelled, { ...cancelled[2], fullName: 'เปลี่ยนชื่อ' }, context));
  assert.throws(() => cancelDemoUser(cancelled, 'demo-new', 'admin', 'ยกเลิกซ้ำ'));
  const added = saveDemoUser(cancelled, { ...draft, staffCode: 'DEMO-004' }, { ...context, newId: 'fourth' });
  assert.equal(added[3].code, 'USR-0004');
  assert.equal(added.length, 4);
});

test('ยกเลิกผู้ดูแลที่ใช้งานจริงคนสุดท้ายไม่ได้แม้มี pending admin', () => {
  const users = saveDemoUser(createDemoUsers(), { ...draft, role: 'admin' }, context);
  assert.throws(() => cancelDemoUser(users, users[0].id, 'admin', 'ยกเลิก'));
  const suspended = toggleDemoUser(users, users[2].id, 'admin');
  assert.equal(toggleDemoUser(suspended, users[2].id, 'admin')[2].status, 'PENDING_IDENTITY');
});

test('หยุดที่ 9999 และยังแก้ไขผู้ใช้เดิมได้โดยไม่เพิ่มเลข', () => {
  const users = createDemoUsers(); users[1].code = 'USR-9999';
  assert.throws(() => saveDemoUser(users, draft, context));
  assert.equal(saveDemoUser(users, { ...users[1], fullName: 'แก้ชื่อ' }, context)[1].code, 'USR-9999');
  assert.throws(() => normalizeDemoUsers([...users, { ...draft, id: 'legacy', status: 'CANCELLED', identity: 'DEMO_NOT_LINKED' }]));
});
test('ตำแหน่งไม่ยกระดับสิทธิ์ และผู้ใช้ใหม่ยังรอยืนยันตัวตน', () => {
  const original=createDemoUsers(), result=saveDemoUser(original,draft,context);
  assert.equal(original.length,2); assert.equal(result[2].position,draft.position);
  assert.equal(result[2].role,'nurse'); assert.equal(result[2].status,'PENDING_IDENTITY');
  assert.equal(result[2].identity,'DEMO_NOT_LINKED');
});
test('ป้องกันรหัสซ้ำต่างตัวพิมพ์ บทบาทแปลก หน่วยงานปลอม และวันที่ผิด', () => {
  const users=createDemoUsers();
  for(const change of [{staffCode:'demo-001'},{role:'SUPERUSER'},{departmentId:'OTHER'},{endsOn:'2026-01-01'},{startsOn:'2026-02-30'},{position:'a\u0000b'}]) assert.throws(()=>saveDemoUser(users,{...draft,...change},context));
});
test('ต้องมีคำสั่งเมื่อเป็นกรรมการ ผู้อนุมัติ หรือระบุอำนาจ', () => {
  for(const change of [{role:'committee'},{role:'approver'},{authority:'DOCUMENTED'}]) assert.throws(()=>saveDemoUser(createDemoUsers(),{...draft,...change},context));
  assert.doesNotThrow(()=>saveDemoUser(createDemoUsers(),{...draft,role:'committee',orderRef:'คำสั่งตัวอย่าง 01/2569'},context));
});
test('บทบาทอื่นจัดการผู้ใช้ไม่ได้ และป้องกันระงับ/ลดสิทธิ์ผู้ดูแลคนสุดท้าย', () => {
  const users=createDemoUsers();
  assert.throws(()=>saveDemoUser(users,draft,{...context,actorRole:'executive'}));
  assert.throws(()=>toggleDemoUser(users,users[0].id,'admin'));
  assert.throws(()=>saveDemoUser(users,{...users[0],role:'nurse'},context));
});
test('ระงับแล้วคืนสถานะกลับไปรอยืนยัน โดยไม่เปิดสิทธิ์จริง', () => {
  const users=createDemoUsers();
  const suspended=toggleDemoUser(users,users[1].id,'admin');
  assert.equal(suspended[1].status,'SUSPENDED');
  assert.equal(toggleDemoUser(suspended,users[1].id,'admin')[1].status,'PENDING_IDENTITY');
});
test('ผู้ดูแลที่ยังรอยืนยันไม่นับแทนผู้ดูแลที่ใช้งานอยู่', () => {
  const users=saveDemoUser(createDemoUsers(),{...draft,role:'admin'},context);
  assert.equal(users[2].status,'PENDING_IDENTITY');
  assert.throws(()=>toggleDemoUser(users,users[0].id,'admin'));
  assert.throws(()=>saveDemoUser(users,{...users[0],role:'nurse'},context));
});
