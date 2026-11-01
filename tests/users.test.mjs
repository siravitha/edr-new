import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoUsers, saveDemoUser, toggleDemoUser } from '../lib/users.mjs';
const draft = { staffCode:'demo-003', fullName:'บุคลากรตัวอย่าง', position:'ผู้อำนวยการโรงพยาบาล', departmentId:'ICU', role:'nurse', authority:'NONE', orderRef:'', startsOn:'2026-11-01', endsOn:'' };
const context = { actorRole:'admin', allowedDepartments:['ICU','IT'], newId:'demo-new' };
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
