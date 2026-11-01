export const userRoleOptions = Object.freeze([
  ['strategy', 'ฝ่ายแผน'], ['procurement', 'ฝ่ายพัสดุ'], ['finance', 'ฝ่ายการเงิน'],
  ['accounting', 'ฝ่ายบัญชี'], ['nurse', 'ผู้ใช้งาน/พยาบาล'], ['warehouse', 'คลัง/หน่วยงาน'],
  ['committee', 'คณะกรรมการ'], ['approver', 'ผู้อนุมัติ'], ['auditor', 'ผู้ตรวจสอบ'],
  ['executive', 'ผู้บริหาร'], ['admin', 'ผู้ดูแลระบบ']
]);
const clean = (value, max, required = true) => {
  if (typeof value !== 'string' || /[\x00-\x1f\x7f]/.test(value)) throw new Error('ข้อมูลมีอักขระที่ไม่อนุญาต');
  const result = value.trim();
  if ((required && !result) || result.length > max) throw new Error('กรุณากรอกข้อมูลให้ครบและไม่เกินความยาวที่กำหนด');
  return result;
};
export function validateUserDraft(raw, allowedDepartments) {
  const staffCode = clean(raw.staffCode, 40).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(staffCode)) throw new Error('รหัสบุคลากรใช้ตัวอักษรอังกฤษ ตัวเลข ขีดกลาง หรือขีดล่าง');
  const fullName = clean(raw.fullName, 120);
  const position = clean(raw.position, 120);
  const departmentId = clean(raw.departmentId, 40);
  const role = clean(raw.role, 30);
  if (!allowedDepartments.includes(departmentId)) throw new Error('กรุณาเลือกหน่วยงานในรายการ');
  if (!userRoleOptions.some(([id]) => id === role)) throw new Error('บทบาทไม่ถูกต้อง');
  const authority = raw.authority === 'DOCUMENTED' ? 'DOCUMENTED' : raw.authority === 'NONE' ? 'NONE' : null;
  if (!authority) throw new Error('กรุณาระบุอำนาจตามคำสั่ง');
  const orderRef = clean(raw.orderRef, 160, false);
  const startsOn = clean(raw.startsOn, 10);
  const endsOn = clean(raw.endsOn, 10, false);
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!validDate(startsOn) || (endsOn && (!validDate(endsOn) || endsOn < startsOn))) throw new Error('วันที่เริ่มและสิ้นสุดสิทธิ์ไม่ถูกต้อง');
  if ((authority === 'DOCUMENTED' || role === 'committee' || role === 'approver') && !orderRef) throw new Error('กรุณาระบุเลขคำสั่งแต่งตั้งหรือมอบอำนาจ');
  // ตำแหน่งไม่เพิ่มสิทธิ์ และยังไม่เปิดอำนาจจากข้อมูลที่กรอกในต้นแบบ
  return { staffCode, fullName, position, departmentId, role, authority, orderRef, startsOn, endsOn };
}
export function saveDemoUser(users, draft, context) {
  if (context.actorRole !== 'admin') throw new Error('เฉพาะผู้ดูแลระบบจำลองเท่านั้นที่แก้ไขผู้ใช้ได้');
  users = normalizeDemoUsers(users);
  const parsed = validateUserDraft(draft, context.allowedDepartments);
  const existing = draft.id ? users.find(u => u.id === draft.id) : undefined;
  if (draft.id && !existing) throw new Error('ไม่พบผู้ใช้');
  if (existing?.status === 'CANCELLED') throw new Error('ผู้ใช้ที่ยกเลิกแล้วแก้ไขไม่ได้');
  if (!existing && (!context.newId || users.some(u => u.id === context.newId))) throw new Error('รหัสอ้างอิงผู้ใช้ซ้ำหรือไม่ครบ');
  if (users.some(u => u.staffCode.toUpperCase() === parsed.staffCode && u.id !== draft.id)) throw new Error('รหัสบุคลากรนี้มีอยู่แล้ว');
  if (existing?.role === 'admin' && parsed.role !== 'admin' && existing.status === 'DEMO_ACTIVE' && !users.some(u => u.id !== existing.id && u.role === 'admin' && u.status === 'DEMO_ACTIVE')) throw new Error('ต้องมีผู้ดูแลระบบจำลองอย่างน้อยหนึ่งคน');
  const nextNumber = Math.max(0, ...users.map(u => Number(u.code.slice(4)))) + 1;
  if (!existing && nextNumber > 9999) throw new Error('เลขรันผู้ใช้ครบ USR-9999 แล้ว ต้องกำหนดนโยบายใหม่ก่อนเพิ่ม');
  const user = { ...parsed, code: existing?.code ?? `USR-${String(nextNumber).padStart(4, '0')}`, id: existing?.id ?? context.newId, status: existing?.status ?? 'PENDING_IDENTITY', identity: 'DEMO_NOT_LINKED' };
  return existing ? users.map(u => u.id === existing.id ? user : u) : [...users, user];
}
export function toggleDemoUser(users, userId, actorRole) {
  if (actorRole !== 'admin') throw new Error('ไม่มีสิทธิ์จัดการผู้ใช้');
  users = normalizeDemoUsers(users);
  const target = users.find(u => u.id === userId);
  if (!target) throw new Error('ไม่พบผู้ใช้');
  if (target.status === 'CANCELLED') throw new Error('ผู้ใช้ที่ยกเลิกแล้วคืนสถานะไม่ได้');
  if (target.role === 'admin' && target.status === 'DEMO_ACTIVE' && !users.some(u => u.id !== target.id && u.role === 'admin' && u.status === 'DEMO_ACTIVE')) throw new Error('ไม่สามารถระงับผู้ดูแลระบบจำลองคนสุดท้าย');
  // การคืนสถานะต้องกลับไปรอยืนยันตัวตน ไม่ยืนยัน Provider ID อัตโนมัติ
  return users.map(u => u.id === userId ? { ...u, status: u.status === 'SUSPENDED' ? 'PENDING_IDENTITY' : 'SUSPENDED' } : u);
}
// รักษาเลขเดิม รวมเลขผู้ใช้ที่ยกเลิก ไม่เติมช่องว่างและไม่เปลี่ยน staffCode
export function normalizeDemoUsers(users) {
  const used = new Set();
  let maximum = 0;
  for (const user of users) {
    if (user.code === undefined || user.code === null || user.code === '') continue;
    if (typeof user.code !== 'string' || !/^USR-\d{4}$/.test(user.code) || user.code === 'USR-0000' || used.has(user.code)) throw new Error('เลขรันผู้ใช้เดิมไม่ถูกต้องหรือซ้ำ');
    used.add(user.code); maximum = Math.max(maximum, Number(user.code.slice(4)));
  }
  return users.map(user => {
    if (user.code) return { ...user };
    maximum++;
    if (maximum > 9999) throw new Error('เลขรันผู้ใช้ครบ USR-9999 แล้ว ไม่สามารถย้ายข้อมูลเดิมต่อได้');
    return { ...user, code: `USR-${String(maximum).padStart(4, '0')}` };
  });
}

export function cancelDemoUser(users, userId, actorRole, reason) {
  if (actorRole !== 'admin') throw new Error('ไม่มีสิทธิ์ยกเลิกผู้ใช้');
  const cancellationReason = clean(reason, 1000);
  users = normalizeDemoUsers(users);
  const target = users.find(user => user.id === userId);
  if (!target) throw new Error('ไม่พบผู้ใช้');
  if (target.status === 'CANCELLED') throw new Error('ผู้ใช้นี้ถูกยกเลิกแล้ว');
  if (target.role === 'admin' && target.status === 'DEMO_ACTIVE' && !users.some(user => user.id !== target.id && user.role === 'admin' && user.status === 'DEMO_ACTIVE')) throw new Error('ไม่สามารถยกเลิกผู้ดูแลระบบจำลองคนสุดท้าย');
  return users.map(user => user.id === userId ? { ...user, status: 'CANCELLED', cancellationReason } : user);
}

export function createDemoUsers() {
  const base = { authority: 'NONE', orderRef: '', startsOn: '2026-11-01', endsOn: '', identity: 'DEMO_NOT_LINKED' };
  return normalizeDemoUsers([
    { ...base, id: 'user-demo-admin', staffCode: 'DEMO-001', fullName: 'ผู้ดูแลระบบตัวอย่าง', position: 'นักวิชาการคอมพิวเตอร์', departmentId: 'IT', role: 'admin', status: 'DEMO_ACTIVE' },
    { ...base, id: 'user-demo-nurse', staffCode: 'DEMO-002', fullName: 'พยาบาลตัวอย่าง', position: 'พยาบาลวิชาชีพ', departmentId: 'ICU', role: 'nurse', status: 'PENDING_IDENTITY' }
  ]);
}
