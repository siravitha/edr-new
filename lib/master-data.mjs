export class MasterDataError extends Error {
  constructor(code, message) { super(message); this.name = "MasterDataError"; this.code = code; }
}
const fail = (code, message) => { throw new MasterDataError(code, message); };
const prefixes = Object.freeze({ documents: "DOC", departments: "DEP", vendors: "VEN" });
const statuses = new Set(["ACTIVE", "SUSPENDED", "CANCELLED"]);
const freeze = value => {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const text = (value, maximum, required = false) => {
  if (typeof value !== "string" || value.length > maximum || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) fail("INVALID_INPUT", "ข้อความไม่ถูกต้องหรือยาวเกินกำหนด");
  const result = value.trim();
  if (required && !result) fail("REQUIRED", "กรุณากรอกข้อมูลที่จำเป็น");
  return result;
};
const kindCheck = kind => { if (!Object.hasOwn(prefixes, kind)) fail("INVALID_KIND", "ประเภทข้อมูลหลักไม่ถูกต้อง"); };
const admin = role => { if (role !== "admin") fail("FORBIDDEN", "เฉพาะผู้ดูแลระบบเท่านั้น"); };

// sequence คือหมายเลขสูงสุดที่เคยออก ต้องบันทึกพร้อมรายการในธุรกรรมเดียวกัน
export function nextCode(collectionOrPrefix, prefixOrCollection, sequence = 0) {
  const collection = typeof collectionOrPrefix === "string" ? prefixOrCollection : collectionOrPrefix;
  const prefix = typeof collectionOrPrefix === "string" ? collectionOrPrefix : prefixOrCollection;
  if (typeof prefix !== "string" || !/^[A-Z]{1,3}$/.test(prefix)) fail("INVALID_PREFIX", "คำนำหน้าต้องเป็นอักษรอังกฤษตัวใหญ่ 1–3 ตัว");
  if (!Array.isArray(collection) || !Number.isSafeInteger(sequence) || sequence < 0 || sequence > 9999) fail("INVALID_SEQUENCE", "ลำดับเลขไม่ถูกต้อง");
  const pattern = new RegExp(`^${prefix}-(\\d{4})$`);
  let highest = sequence;
  // รวมรายการพักใช้และยกเลิกด้วย จึงไม่คืนรหัสเก่ากลับมาใช้ใหม่
  for (const record of collection) {
    if (typeof record?.code !== "string") fail("INVALID_RECORD", "รายการเดิมไม่มีรหัสที่ถูกต้อง");
    const match = pattern.exec(record.code);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  if (highest >= 9999) fail("CODE_EXHAUSTED", "เลขรหัสครบ 9999 แล้ว ต้องกำหนดแนวทางขยายรหัสก่อนเพิ่มรายการ");
  return `${prefix}-${String(highest + 1).padStart(4, "0")}`;
}
export function createMasterData() {
  const item = (id, code, name, fields = {}) => ({ id, code, name, status: "ACTIVE", fields });
  return freeze({
    documents: [item("documents:DOC-0001", "DOC-0001", "ใบเบิกครุภัณฑ์ (ตัวอย่าง)", { documentPrefix: "REQ", description: "ข้อมูลสาธิต ไม่ใช่แบบเอกสารที่ประกาศใช้" })],
    departments: [["ICU", "หอผู้ป่วยวิกฤต"], ["ER", "ห้องฉุกเฉิน"], ["MED", "หอผู้ป่วยอายุรกรรม"], ["SUR", "หอผู้ป่วยศัลยกรรม"], ["WH", "คลังกลาง"], ["PLAN", "งานยุทธศาสตร์"], ["PROC", "งานพัสดุ"], ["FIN", "งานการเงิน"], ["ACC", "งานบัญชี"], ["IT", "งานสารสนเทศ"]]
      .map(([id, name], index) => item(id, `DEP-${String(index + 1).padStart(4, "0")}`, `${name} (ตัวอย่าง)`)),
    vendors: [item("vendors:VEN-0001", "VEN-0001", "ผู้ขายตัวอย่าง — ไม่ใช่ข้อมูลจริง", { phone: "", taxId: "" })],
    sequences: { documents: 1, departments: 10, vendors: 1 }, audit: [],
  });
}
function fieldsCheck(fields) {
  if (!fields || typeof fields !== "object" || Array.isArray(fields) || Object.getPrototypeOf(fields) !== Object.prototype || Object.keys(fields).length > 30) {
    fail("INVALID_FIELDS", "รายละเอียดต้องเป็นข้อความในช่องข้อมูลที่กำหนด");
  }
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key) || ["__proto__", "constructor", "prototype"].includes(key)) fail("INVALID_FIELDS", "ชื่อช่องข้อมูลไม่ถูกต้อง");
    return [key, text(value, 2000)];
  }));
}
export function saveMasterRecord(state, kind, draft, actorRole) {
  admin(actorRole); kindCheck(kind);
  if (!draft || typeof draft !== "object") fail("INVALID_INPUT", "รายการไม่ถูกต้อง");
  const name = text(draft.name, 255, true);
  const fields = fieldsCheck(draft.fields);
  if (kind === "departments" && fields.parentId) {
    let parent = state.departments.find(row => row.id === fields.parentId);
    if (!parent || parent.status !== "ACTIVE") fail("INVALID_PARENT", "หน่วยงานแม่ต้องเป็นรายการที่ใช้งานอยู่");
    const visited = new Set();
    while (parent) {
      if (parent.id === draft.id || visited.has(parent.id)) fail("DEPARTMENT_CYCLE", "หน่วยงานแม่และหน่วยงานย่อยต้องไม่อ้างอิงวนกัน");
      visited.add(parent.id);
      parent = parent.fields.parentId ? state.departments.find(row => row.id === parent.fields.parentId) : undefined;
    }
  }
  if (kind === "documents") {
    if (!/^[A-Z]{1,3}$/.test(fields.documentPrefix ?? "")) fail("INVALID_PREFIX", "คำนำหน้าเอกสารต้องเป็นอักษรอังกฤษตัวใหญ่ 1–3 ตัว");
    if (state.documents.some(record => record.id !== draft.id && record.fields.documentPrefix === fields.documentPrefix)) {
      fail("DUPLICATE_DOCUMENT_PREFIX", "คำนำหน้าเอกสารนี้เคยใช้แล้ว รวมรายการที่ยกเลิก");
    }
  }
  const next = structuredClone(state);
  let record;
  let action;
  if (draft.id !== undefined) {
    const id = text(draft.id, 191, true);
    record = next[kind].find(row => row.id === id);
    if (!record) fail("NOT_FOUND", "ไม่พบรายการ");
    if (record.status === "CANCELLED") fail("CANCELLED_TERMINAL", "รายการยกเลิกแก้ไขหรือเปิดใช้อีกไม่ได้");
    record.name = name; record.fields = fields; action = "EDIT";
  } else {
    const code = nextCode(next[kind], prefixes[kind], next.sequences[kind] ?? 0);
    record = { id: `${kind}:${code}`, code, name, status: "ACTIVE", fields };
    next[kind].push(record);
    next.sequences[kind] = Number(code.split("-")[1]);
    action = "CREATE";
  }
  next.audit.push({ sequence: next.audit.length + 1, action, kind, recordId: record.id, code: record.code, role: actorRole });
  return freeze(next);
}
export function changeMasterStatus(state, kind, id, status, actorRole, reason) {
  admin(actorRole); kindCheck(kind);
  if (!statuses.has(status)) fail("INVALID_STATUS", "สถานะไม่ถูกต้อง");
  const existing = state[kind].find(row => row.id === id);
  if (!existing) fail("NOT_FOUND", "ไม่พบรายการ");
  if (existing.status === "CANCELLED") fail("CANCELLED_TERMINAL", "รายการยกเลิกเป็นสถานะสุดท้าย เปลี่ยนซ้ำไม่ได้");
  if (existing.status === status) fail("NO_STATUS_CHANGE", "รายการอยู่ในสถานะนี้แล้ว");
  const normalizedReason = text(reason ?? "", 1000, status !== "ACTIVE");
  const next = structuredClone(state);
  const record = next[kind].find(row => row.id === id);
  record.status = status;
  next.audit.push({ sequence: next.audit.length + 1, action: "STATUS_CHANGE", kind, recordId: id,
    code: record.code, beforeStatus: existing.status, afterStatus: status, role: actorRole, reason: normalizedReason });
  return freeze(next);
}

export function validateHospitalProfile(input) {
  if (!input || typeof input !== "object") fail("INVALID_PROFILE", "ข้อมูลโรงพยาบาลไม่ถูกต้อง");
  const profile = {
    name: text(input.name, 255, true), nameEnglish: text(input.nameEnglish ?? "", 255), code: text(input.code ?? "", 64),
    address: text(input.address ?? "", 2000), phone: text(input.phone ?? "", 80),
    email: text(input.email ?? "", 254), website: text(input.website ?? "", 2048),
    logoDataUrl: input.logoDataUrl ?? "",
  };
  if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) fail("INVALID_EMAIL", "อีเมลไม่ถูกต้อง");
  if (profile.website) {
    try {
      const url = new URL(profile.website);
      if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error();
    } catch { fail("INVALID_WEBSITE", "เว็บไซต์ต้องเป็น http หรือ https ที่ไม่มีข้อมูลเข้าสู่ระบบ"); }
  }
  if (typeof profile.logoDataUrl !== "string") fail("INVALID_IMAGE", "รูปต้องเป็น PNG, JPEG หรือ WebP แบบ data URL");
  if (profile.logoDataUrl) {
    // จำกัดก่อนถอด base64 เพื่อไม่จัดสรรหน่วยความจำจากข้อมูลขนาดใหญ่
    if (profile.logoDataUrl.length > 700000) fail("IMAGE_TOO_LARGE", "รูปต้องมีขนาดไม่เกิน 500 KB");
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]*={0,2})$/.exec(profile.logoDataUrl);
    if (!match || !match[2] || match[2].length % 4 !== 0) fail("INVALID_IMAGE", "รูปต้องเป็น PNG, JPEG หรือ WebP และ base64 ถูกต้อง");
    let binary;
    try { binary = atob(match[2]); } catch { fail("INVALID_IMAGE", "base64 ไม่ถูกต้อง"); }
    if (btoa(binary) !== match[2]) fail("INVALID_IMAGE", "base64 ต้องเป็นรูปแบบมาตรฐาน");
    if (binary.length > 500 * 1024) fail("IMAGE_TOO_LARGE", "รูปต้องมีขนาดไม่เกิน 500 KB");
    const bytes = Array.from(binary.slice(0, 12), char => char.charCodeAt(0));
    const png = bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
    const jpeg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp = binary.length >= 12 && binary.slice(0, 4) === "RIFF" && binary.slice(8, 12) === "WEBP";
    if (!(match[1] === "png" && png || match[1] === "jpeg" && jpeg || match[1] === "webp" && webp)) fail("INVALID_IMAGE", "ชนิดไฟล์รูปไม่ตรงกับเนื้อหา");
  }
  return freeze(profile);
}
