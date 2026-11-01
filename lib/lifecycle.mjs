// แบบจำลองสาธิตล้วน ไม่มีการอนุมัติหรือเบิกจ่ายเงินจริง
export class DomainError extends Error {
  constructor(code, message) { super(message); this.name = "DomainError"; this.code = code; }
}
const fail = (code, message) => { throw new DomainError(code, message); };
const money = (value, field) => {
  if (!Number.isSafeInteger(value) || value < 0) fail("INVALID_MONEY", `${field}: เงินต้องเป็นจำนวนเต็มสตางค์ที่ไม่ติดลบ`);
  return value;
};
const nonempty = value => typeof value === "string" && value.trim().length > 0 && value.length <= 191;
const freeze = value => {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
export const lifecycleSteps = freeze([
  { id: "demand", label: "หน่วยงานย่อยทำคำขอ", role: "warehouse" },
  { id: "plan", label: "แผนประจำปี", role: "strategy" },
  { id: "budget", label: "อนุมัติงบ", role: "approver" },
  { id: "pr", label: "PR", role: "procurement" },
  { id: "budgetcheck", label: "ตรวจยอดงบก่อนผูกพัน", role: "finance" },
  { id: "tor", label: "ราคากลาง/TOR", role: "procurement" },
  { id: "selection", label: "ดำเนินวิธีจัดหา", role: "procurement" },
  { id: "contract", label: "สัญญา PO และผูกพัน", role: "procurement" },
  { id: "inspection", label: "ตรวจรับ", role: "inspector" },
  { id: "payment", label: "เบิกจ่าย", role: "finance" },
  { id: "registration", label: "ลงทะเบียน", role: "accounting" },
  { id: "custody", label: "จ่ายของ", role: "warehouse" },
  { id: "maintenance", label: "ซ่อม", role: "warehouse" },
  { id: "depreciation", label: "ค่าเสื่อม", role: "accounting" },
  { id: "disposal", label: "ตรวจประจำปีและจำหน่าย", role: "approver" },
]);
export const scopeCatalog = freeze({
  caseTypes: ["procurement", "hiring", "service", "repair", "lease", "construction", "donation"],
  fundSources: ["annual", "bamrung", "donation"],
});
export function createLifecycle({ tenantId, caseId, allocatedSatang }) {
  if (!nonempty(tenantId) || !nonempty(caseId)) fail("INVALID_ID", "ต้องระบุโรงพยาบาลและเลขอ้างอิง");
  money(allocatedSatang, "allocatedSatang");
  return freeze({ tenantId, caseId, version: 0,
    budget: { allocatedSatang, committedSatang: 0, paidSatang: 0 },
    contract: { signed: false, cancelled: false, amountSatang: 0 },
    disposal: { inspectionVerified: false, approved: false, executed: false }, paidReferences: [], operations: [] });
}
export function availableBudget(state) {
  const { allocatedSatang, committedSatang, paidSatang } = state.budget;
  [allocatedSatang, committedSatang, paidSatang].forEach(v => money(v, "budget"));
  const remaining = BigInt(allocatedSatang) - BigInt(committedSatang) - BigInt(paidSatang);
  if (remaining < 0n) fail("INVALID_BUDGET", "ยอดผูกพันและจ่ายเกินงบที่จัดสรร");
  return Number(remaining);
}
const canonical = value => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  fail("INVALID_COMMAND", "คำสั่งต้องเป็นข้อมูล JSON ที่มีจำนวนเต็มเท่านั้น");
};
// ลายนิ้วมือสาธิตใช้เทียบร่วมกับข้อความเต็มเสมอ จึงไม่ใช้แทนลายเซ็นหรือหลักฐานต้านการแก้ไข
const fingerprint = text => {
  let hash = 14695981039346656037n;
  for (const byte of new TextEncoder().encode(text)) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 1099511628211n);
  return hash.toString(16).padStart(16, "0");
};
const wetInk = document => {
  if (!document || document.signed !== true || document.verified !== true) {
    fail("DOCUMENT_REQUIRED", "ต้องลงนามหมึกจริงและตรวจเทียบเอกสารแล้ว");
  }
};
const roleFor = { SIGN_CONTRACT: "procurement", PAY: "finance", CANCEL_CONTRACT: "procurement",
  PROPOSE_DISPOSAL: "warehouse", APPROVE_DISPOSAL: "approver", EXECUTE_DISPOSAL: "warehouse" };
export function applyLifecycleCommand(state, command) {
  // รุ่นข้อมูลและบทบาทนี้เป็นข้อมูลจำลองจากผู้เรียก ระบบจริงต้องตรวจตัวตนและทำ CAS ในธุรกรรมฝั่งเซิร์ฟเวอร์
  if (!command || !nonempty(command.opId) || !nonempty(command.actorId)) fail("INVALID_COMMAND", "ต้องมีเลขคำสั่งและผู้กระทำ");
  if (command.tenantId !== state.tenantId) fail("TENANT_MISMATCH", "โรงพยาบาลไม่ตรงกับข้อมูล");
  const requiredRole = roleFor[command.type];
  if (!requiredRole || command.role !== requiredRole) fail("FORBIDDEN", "บทบาทไม่มีสิทธิ์ทำคำสั่งนี้");
  if (command.type === "SIGN_CONTRACT" || command.type === "PAY") money(command.payload?.amountSatang, "amountSatang");
  const serialized = canonical(command);
  const requestHash = fingerprint(serialized);
  const previous = state.operations.find(op => op.opId === command.opId);
  if (previous) {
    if (previous.requestHash !== requestHash || previous.canonical !== serialized) fail("IDEMPOTENCY_CONFLICT", "เลขคำสั่งซ้ำแต่เนื้อหา ผู้ใช้ หรือโรงพยาบาลเปลี่ยน");
    return state;
  }
  if (!Number.isSafeInteger(command.expectedVersion) || command.expectedVersion < 0) {
    fail("VERSION_REQUIRED", "ต้องระบุรุ่นข้อมูลที่อ่านก่อนส่งคำสั่ง");
  }
  if (command.expectedVersion !== state.version) fail("STALE_VERSION", "ข้อมูลเปลี่ยนแล้ว ต้องอ่านรุ่นปัจจุบันก่อนทำรายการ");
  const payload = command.payload;
  wetInk(payload?.document);
  const next = structuredClone(state);
  const budget = next.budget;
  if (command.type === "SIGN_CONTRACT") {
    if (next.contract.signed) fail("ALREADY_SIGNED", "สัญญานี้ลงนามแล้ว");
    const amount = money(payload.amountSatang, "amountSatang");
    if (amount === 0) fail("INVALID_MONEY", "ยอดสัญญาต้องมากกว่าศูนย์");
    if (amount > availableBudget(next)) fail("BUDGET_EXCEEDED", "งบพร้อมใช้ไม่เพียงพอ");
    budget.committedSatang += amount;
    next.contract = { signed: true, cancelled: false, amountSatang: amount };
  } else if (command.type === "PAY") {
    if (!next.contract.signed || next.contract.cancelled) fail("CONTRACT_REQUIRED", "ต้องมีสัญญาที่ลงนามและยังไม่ยกเลิก");
    if (payload.acceptanceVerified !== true) fail("ACCEPTANCE_REQUIRED", "ต้องตรวจยืนยันหลักฐานตรวจรับก่อนจ่าย");
    if (!nonempty(payload.paymentRef) || payload.paymentRef !== payload.paymentRef.trim()) fail("PAYMENT_REFERENCE_REQUIRED", "ต้องมีเลขอ้างอิงการจ่ายที่ไม่ซ้ำและไม่มีช่องว่างหัวท้าย");
    // ต้นแบบตรวจภายในกรณีเดียว ระบบจริงต้องมี unique(tenantId, paymentRef) ครอบคลุมทุกกรณี
    if (next.paidReferences.includes(payload.paymentRef)) fail("DUPLICATE_PAYMENT", "เลขอ้างอิงการจ่ายนี้บันทึกแล้ว");
    const amount = money(payload.amountSatang, "amountSatang");
    if (amount === 0) fail("INVALID_MONEY", "ยอดจ่ายต้องมากกว่าศูนย์");
    if (amount > budget.committedSatang) fail("PAYMENT_EXCEEDED", "ยอดจ่ายเกินภาระผูกพันคงเหลือ");
    budget.committedSatang -= amount;
    budget.paidSatang += amount;
    next.paidReferences.push(payload.paymentRef);
  } else if (command.type === "CANCEL_CONTRACT") {
    if (!next.contract.signed || next.contract.cancelled) fail("CONTRACT_REQUIRED", "ไม่มีสัญญาที่เปิดให้ยกเลิก");
    budget.committedSatang = 0;
    next.contract.cancelled = true;
  } else if (command.type === "PROPOSE_DISPOSAL") {
    if (payload.inspectionVerified !== true) fail("INSPECTION_REQUIRED", "ต้องตรวจสภาพจริงก่อนเสนอจำหน่าย");
    if (next.disposal.inspectionVerified) fail("ALREADY_PROPOSED", "เสนอจำหน่ายแล้ว");
    next.disposal.inspectionVerified = true;
    next.disposal.inspectedBy = command.actorId;
  } else if (command.type === "APPROVE_DISPOSAL") {
    if (!next.disposal.inspectionVerified) fail("INSPECTION_REQUIRED", "ยังไม่ได้ตรวจสภาพจริง");
    if (next.disposal.approved) fail("ALREADY_APPROVED", "อนุมัติจำหน่ายแล้ว");
    if (next.disposal.inspectedBy === command.actorId) fail("SEGREGATION_REQUIRED", "ผู้ตรวจสภาพและผู้อนุมัติต้องแยกบุคคล");
    next.disposal.approved = true;
    next.disposal.approvedBy = command.actorId;
  } else if (command.type === "EXECUTE_DISPOSAL") {
    if (!next.disposal.approved) fail("APPROVAL_REQUIRED", "ต้องมีผู้มีอำนาจอนุมัติก่อนดำเนินการจำหน่าย");
    if (payload.executionEvidenceVerified !== true) fail("EVIDENCE_REQUIRED", "ต้องมีหลักฐานดำเนินการจำหน่ายจริง");
    if (next.disposal.executed) fail("ALREADY_EXECUTED", "ดำเนินการจำหน่ายแล้ว");
    if (next.disposal.approvedBy === command.actorId) fail("SEGREGATION_REQUIRED", "ผู้อนุมัติและผู้ดำเนินการต้องแยกบุคคล");
    next.disposal.executed = true;
  }
  availableBudget(next);
  next.version += 1;
  next.operations.push({ opId: command.opId, requestHash, canonical: serialized,
    tenantId: command.tenantId, actorId: command.actorId, role: command.role, type: command.type });
  return freeze(next);
}

export function calculateDepreciation({ costSatang, residualSatang, lifetimeMonths, elapsedMonths, policyApproved, startDate }) {
  if (policyApproved !== true) fail("POLICY_REQUIRED", "ต้องมีนโยบายค่าเสื่อมที่อนุมัติก่อนคำนวณ");
  money(costSatang, "costSatang"); money(residualSatang, "residualSatang");
  if (residualSatang > costSatang) fail("INVALID_POLICY", "มูลค่าคงเหลือต้องไม่เกินต้นทุน");
  if (!Number.isSafeInteger(lifetimeMonths) || lifetimeMonths <= 0 || !Number.isSafeInteger(elapsedMonths) || elapsedMonths < 0) {
    fail("INVALID_POLICY", "อายุใช้งานต้องเป็นเดือนบวกและเดือนที่ผ่านมาต้องไม่ติดลบ");
  }
  if (typeof startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)
    || !Number.isFinite(Date.parse(`${startDate}T00:00:00Z`))
    || new Date(`${startDate}T00:00:00Z`).toISOString().slice(0, 10) !== startDate) {
    fail("INVALID_POLICY", "ต้องระบุวันเริ่มค่าเสื่อมที่ถูกต้องตามนโยบาย");
  }
  const months = Math.min(elapsedMonths, lifetimeMonths);
  const depreciable = BigInt(costSatang) - BigInt(residualSatang);
  // คำนวณยอดสะสมด้วยจำนวนเต็มก่อนแปลงกลับ จึงเก็บเศษครบในเดือนสุดท้าย
  const accumulatedSatang = Number(depreciable * BigInt(months) / BigInt(lifetimeMonths));
  return freeze({ accumulatedSatang, bookValueSatang: costSatang - accumulatedSatang,
    fullyDepreciated: months === lifetimeMonths, elapsedMonths: months, disposalEligible: false });
}
