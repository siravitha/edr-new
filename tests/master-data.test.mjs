import test from "node:test";
import assert from "node:assert/strict";
import { createMasterData, nextCode, saveMasterRecord, changeMasterStatus, validateHospitalProfile } from "../lib/master-data.mjs";
const fails = (fn, code) => assert.throws(fn, error => error.code === code);

test("รหัสอังกฤษ 1–3 ตัวกับเลขสี่หลัก ตรวจทั้งลำดับและรหัสที่เคยใช้โดยไม่แก้ input", () => {
  const records = [{ code: "A-0008", status: "CANCELLED" }];
  assert.equal(nextCode(records, "A", 2), "A-0009");
  assert.equal(nextCode([], "AB", 9), "AB-0010");
  assert.equal(nextCode([], "ABC", 998), "ABC-0999");
  assert.equal(nextCode("ABC", [{ code: "ABC-0099" }]), "ABC-0100");
  assert.equal(records[0].code, "A-0008");
  for (const prefix of ["", "ABCD", "abc", "A1", "ก"]) fails(() => nextCode([], prefix, 0), "INVALID_PREFIX");
  fails(() => nextCode([], "DOC", -1), "INVALID_SEQUENCE");
});
test("ยกเลิกเลขสุดท้ายแล้วไม่คืนรหัส และหยุดเมื่อครบ9999", () => {
  fails(() => nextCode([{ code: "VEN-9999", status: "CANCELLED" }], "VEN", 1), "CODE_EXHAUSTED");
  fails(() => nextCode([], "VEN", 9999), "CODE_EXHAUSTED");
  const state = createMasterData();
  const first = saveMasterRecord(state, "vendors", { name: "ผู้ขายจำลอง", fields: {} }, "admin");
  const cancelled = changeMasterStatus(first, "vendors", first.vendors.at(-1).id, "CANCELLED", "admin", "รายการสร้างผิด");
  const next = saveMasterRecord(cancelled, "vendors", { name: "ผู้ขายจำลองใหม่", fields: {} }, "admin");
  assert.equal(next.vendors.at(-1).code, "VEN-0003");
  assert.equal(state.vendors.length, 1);
});
test("แก้ไขชื่อคงรหัสและลำดับเดิม เพิ่มรายการเท่านั้นจึงออกเลข", () => {
  const state = createMasterData();
  const record = state.departments[0];
  const edited = saveMasterRecord(state, "departments", { id: record.id, name: "คลังตัวอย่างแก้ไข", fields: { phone: "100" } }, "admin");
  assert.equal(edited.departments[0].code, record.code);
  assert.equal(edited.sequences.departments, state.sequences.departments);
  assert.equal(edited.audit.at(-1).action, "EDIT");
  assert.equal(state.departments[0].name, record.name);
});
test("พักใช้เปิดกลับได้ ยกเลิกเป็นปลายทางและต้องระบุเหตุผล", () => {
  const state = createMasterData(); const id = state.documents[0].id;
  fails(() => changeMasterStatus(state, "documents", id, "SUSPENDED", "admin", " "), "REQUIRED");
  fails(() => changeMasterStatus(state, "documents", id, "INVALID", "admin", "x"), "INVALID_STATUS");
  const suspended = changeMasterStatus(state, "documents", id, "SUSPENDED", "admin", "รอปรับแบบ");
  const active = changeMasterStatus(suspended, "documents", id, "ACTIVE", "admin");
  const cancelled = changeMasterStatus(active, "documents", id, "CANCELLED", "admin", "เลิกใช้แบบ");
  fails(() => changeMasterStatus(cancelled, "documents", id, "ACTIVE", "admin", "เปิดใหม่"), "CANCELLED_TERMINAL");
  fails(() => changeMasterStatus(cancelled, "documents", id, "CANCELLED", "admin", "ซ้ำ"), "CANCELLED_TERMINAL");
  fails(() => saveMasterRecord(cancelled, "documents", { id, name: "แก้ไม่ได้", fields: { documentPrefix: "REQ" } }, "admin"), "CANCELLED_TERMINAL");
});
test("แผนกเริ่มต้นอ้างสิทธิ์เดิมได้และคำนำหน้าเอกสารไม่ซ้ำแม้ยกเลิก", () => {
  const state = createMasterData();
  assert.deepEqual(state.departments.map(row => row.id), ["ICU", "ER", "MED", "SUR", "WH", "PLAN", "PROC", "FIN", "ACC", "IT"]);
  assert.equal(state.departments.at(-1).code, "DEP-0010");
  fails(() => saveMasterRecord(state, "documents", { name: "ชนคำนำหน้า", fields: { documentPrefix: "REQ" } }, "admin"), "DUPLICATE_DOCUMENT_PREFIX");
  const cancelled = changeMasterStatus(state, "documents", state.documents[0].id, "CANCELLED", "admin", "เลิกใช้");
  fails(() => saveMasterRecord(cancelled, "documents", { name: "ชนคำนำหน้าเดิม", fields: { documentPrefix: "REQ" } }, "admin"), "DUPLICATE_DOCUMENT_PREFIX");
  const saved = saveMasterRecord(state, "documents", { name: "ใบสาธิต", fields: { documentPrefix: "A" } }, "admin");
  assert.equal(saved.documents.at(-1).code, "DOC-0002");
  fails(() => saveMasterRecord(state, "documents", { name: "ผิดคำนำหน้า", fields: { documentPrefix: "ABCD" } }, "admin"), "INVALID_PREFIX");
});
test("ผู้ไม่มีสิทธิ์เพิ่มแก้สถานะไม่ได้และห้ามลบทางอ้อม", () => {
  const state = createMasterData();
  fails(() => saveMasterRecord(state, "vendors", { name: "ตัวอย่าง", fields: {} }, "finance"), "FORBIDDEN");
  fails(() => changeMasterStatus(state, "vendors", state.vendors[0].id, "SUSPENDED", "warehouse", "test"), "FORBIDDEN");
  fails(() => saveMasterRecord(state, "hospital", { name: "ตัวอย่าง", fields: {} }, "admin"), "INVALID_KIND");
  assert.throws(() => { state.vendors.splice(0, 1); }, TypeError);
});
test("โรงพยาบาลบันทึกข้อมูลทั่วไป ไม่ออกเลขและปฏิเสธเว็บไซต์อันตราย", () => {
  assert.equal(validateHospitalProfile({ name: " โรงพยาบาลตัวอย่าง ", code: "USER-CHOICE" }).name, "โรงพยาบาลตัวอย่าง");
  assert.equal(validateHospitalProfile({ name: "ตัวอย่าง", nameEnglish: " Demo Hospital " }).nameEnglish, "Demo Hospital");
  assert.equal(validateHospitalProfile({ name: "ตัวอย่าง", website: "https://hospital.example.org" }).website, "https://hospital.example.org");
  fails(() => validateHospitalProfile({ name: " " }), "REQUIRED");
  fails(() => validateHospitalProfile({ name: "ตัวอย่าง", website: "javascript:alert(1)" }), "INVALID_WEBSITE");
  fails(() => validateHospitalProfile({ name: "ตัวอย่าง", website: "https://user:password@example.org" }), "INVALID_WEBSITE");
});
test("รูปจำกัดชนิด ขนาด base64 และตรวจหัวไฟล์ ไม่รับSVGหรือปลอมMIME", () => {
  const profile = { name: "ตัวอย่าง" };
  const png = "data:image/png;base64,iVBORw0KGgo=";
  assert.equal(validateHospitalProfile({ ...profile, logoDataUrl: png }).logoDataUrl, png);
  for (const image of ["data:image/svg+xml;base64,PHN2Zz4=", "data:image/png;base64,PHN2Zz4=", "data:image/png;base64,@@==", "data:image/png;base64,iVBORw0KGgo", "https://example.org/logo.png", "data:image/jpeg;base64,iVBORw0KGgo="]) {
    fails(() => validateHospitalProfile({ ...profile, logoDataUrl: image }), "INVALID_IMAGE");
  }
  const large = Buffer.alloc(500 * 1024 + 1); Buffer.from([137,80,78,71,13,10,26,10]).copy(large);
  fails(() => validateHospitalProfile({ ...profile, logoDataUrl: `data:image/png;base64,${large.toString("base64")}` }), "IMAGE_TOO_LARGE");
});
