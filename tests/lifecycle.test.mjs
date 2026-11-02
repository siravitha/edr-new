import test from "node:test";
import assert from "node:assert/strict";
import { createLifecycle, availableBudget, applyLifecycleCommand as reduceLifecycle, calculateDepreciation, lifecycleSteps, scopeCatalog } from "../lib/lifecycle.mjs";
const initial = () => createLifecycle({ tenantId: "uth", caseId: "PO-1", allocatedSatang: 10000 });
const document = { signed: true, verified: true };
const command = (type, role, payload = {}, opId = type, actorId = role) => ({ opId, tenantId: "uth", actorId, role, type,
  payload: { document, ...(type === "PAY" ? { paymentRef: "PAY-001", acceptanceVerified: true } : {}), ...payload } });
const applyLifecycleCommand = (state, cmd) => reduceLifecycle(state, { expectedVersion: state.version, ...cmd });
const sign = state => applyLifecycleCommand(state, command("SIGN_CONTRACT", "procurement", { amountSatang: 8000 }));
const fails = (fn, code) => assert.throws(fn, error => error.code === code);

test("15 ขั้นเป็นแค็ตตาล็อกและ state แก้ตรงไม่ได้", () => {
  assert.equal(lifecycleSteps.length, 15);
  assert.deepEqual(lifecycleSteps.map(step => step.id), ["demand", "plan", "budget", "pr", "budgetcheck", "tor", "selection", "contract", "inspection", "payment", "registration", "custody", "maintenance", "depreciation", "disposal"]);
  assert.equal(lifecycleSteps[4].label, "ตรวจยอดงบก่อนผูกพัน");
  assert.equal(lifecycleSteps[7].label, "สัญญา PO และผูกพัน");
  assert.equal(scopeCatalog.caseTypes.length, 7);
  const state = initial();
  assert.throws(() => { state.budget.paidSatang = 1; }, TypeError);
  assert.equal(state.version, 0);
});
test("ลงนามผูกพันครั้งเดียว จ่ายทยอยไม่หักงบพร้อมใช้ซ้ำ ยกเลิกคืนเฉพาะคงเหลือ", () => {
  const original = initial(); const signed = sign(original);
  assert.equal(availableBudget(signed), 2000);
  const paid = applyLifecycleCommand(signed, command("PAY", "finance", { amountSatang: 3000 }));
  assert.deepEqual(paid.budget, { allocatedSatang: 10000, committedSatang: 5000, paidSatang: 3000 });
  assert.equal(availableBudget(paid), 2000);
  const cancelled = applyLifecycleCommand(paid, command("CANCEL_CONTRACT", "procurement"));
  assert.equal(availableBudget(cancelled), 7000);
  assert.equal(cancelled.budget.paidSatang, 3000);
  assert.equal(original.budget.committedSatang, 0);
  fails(() => applyLifecycleCommand(cancelled, command("PAY", "finance", { amountSatang: 1 }, "later")), "CONTRACT_REQUIRED");
});
test("คำสั่งซ้ำคืน state เดิม แต่เปลี่ยนยอดหรือผู้ใช้ไม่ได้", () => {
  const state = sign(initial()); const pay = { ...command("PAY", "finance", { amountSatang: 1000 }), expectedVersion: state.version };
  const paid = applyLifecycleCommand(state, pay);
  assert.equal(applyLifecycleCommand(paid, structuredClone(pay)), paid);
  fails(() => applyLifecycleCommand(paid, { ...command("PAY", "finance", { amountSatang: 2000 }), expectedVersion: state.version }), "IDEMPOTENCY_CONFLICT");
  fails(() => applyLifecycleCommand(paid, { ...pay, actorId: "finance-2" }), "IDEMPOTENCY_CONFLICT");
  fails(() => applyLifecycleCommand(paid, { ...pay, tenantId: "other" }), "TENANT_MISMATCH");
  fails(() => applyLifecycleCommand(state, command("SIGN_CONTRACT", "procurement", { amountSatang: 8000 }, "sign-again")), "ALREADY_SIGNED");
});
test("ป้องกันจ่ายหลักฐานเดิมแม้เปลี่ยนเลขคำสั่ง และต้องมีตรวจรับ", () => {
  const signed = sign(initial());
  const paid = applyLifecycleCommand(signed, command("PAY", "finance", { amountSatang: 1000 }));
  fails(() => applyLifecycleCommand(paid, command("PAY", "finance", { amountSatang: 1000 }, "PAY-OTHER-OP")), "DUPLICATE_PAYMENT");
  assert.deepEqual(paid.paidReferences, ["PAY-001"]);
  fails(() => applyLifecycleCommand(signed, command("PAY", "finance", { amountSatang: 1000, acceptanceVerified: false })), "ACCEPTANCE_REQUIRED");
  fails(() => applyLifecycleCommand(signed, command("PAY", "finance", { amountSatang: 1000, paymentRef: "" })), "PAYMENT_REFERENCE_REQUIRED");
});
test("ต้องระบุรุ่นปัจจุบัน แต่คำสั่งเดิมส่งซ้ำได้หลังรุ่นเปลี่ยน", () => {
  const state = initial();
  fails(() => reduceLifecycle(state, command("SIGN_CONTRACT", "procurement", { amountSatang: 8000 })), "VERSION_REQUIRED");
  const cmd = { ...command("SIGN_CONTRACT", "procurement", { amountSatang: 8000 }), expectedVersion: 0 };
  const signed = reduceLifecycle(state, cmd);
  assert.equal(reduceLifecycle(signed, cmd), signed);
  fails(() => reduceLifecycle(signed, { ...command("PAY", "finance", { amountSatang: 1000 }), expectedVersion: 0 }), "STALE_VERSION");
  const paid = reduceLifecycle(signed, { ...command("PAY", "finance", { amountSatang: 1000 }), expectedVersion: 1 });
  assert.equal(paid.version, 2);
});
test("ปฏิเสธเกินงบ เกินคงเหลือ บทบาทผิด เอกสารไม่ยืนยัน และเลขเงินไม่แม่นยำ", () => {
  fails(() => applyLifecycleCommand(initial(), command("SIGN_CONTRACT", "procurement", { amountSatang: 10001 })), "BUDGET_EXCEEDED");
  fails(() => applyLifecycleCommand(sign(initial()), command("PAY", "finance", { amountSatang: 8001 })), "PAYMENT_EXCEEDED");
  fails(() => applyLifecycleCommand(initial(), command("SIGN_CONTRACT", "finance", { amountSatang: 1 })), "FORBIDDEN");
  for (const doc of [{ signed: false, verified: true }, { signed: true, verified: false }]) {
    fails(() => applyLifecycleCommand(initial(), command("SIGN_CONTRACT", "procurement", { amountSatang: 1, document: doc })), "DOCUMENT_REQUIRED");
  }
  fails(() => createLifecycle({ tenantId: "uth", caseId: "1", allocatedSatang: Number.MAX_SAFE_INTEGER + 1 }), "INVALID_MONEY");
  fails(() => applyLifecycleCommand(initial(), command("SIGN_CONTRACT", "procurement", { amountSatang: 0.1 })), "INVALID_MONEY");
});
const policy = { costSatang: 10001, residualSatang: 100, lifetimeMonths: 3, elapsedMonths: 1, policyApproved: true, startDate: "2026-10-01" };
test("ค่าเสื่อมสะสมเก็บเศษเดือนสุดท้าย คงมูลค่าซาก และไม่จำหน่ายอัตโนมัติ", () => {
  const first = calculateDepreciation(policy);
  assert.equal(first.accumulatedSatang, 3300);
  const final = calculateDepreciation({ ...policy, elapsedMonths: 999 });
  assert.equal(final.accumulatedSatang, 9901);
  assert.equal(final.bookValueSatang, 100);
  assert.equal(final.fullyDepreciated, true);
  assert.equal(final.disposalEligible, false);
  assert.equal(calculateDepreciation({ ...policy, elapsedMonths: 0 }).accumulatedSatang, 0);
  const large = calculateDepreciation({ ...policy, costSatang: Number.MAX_SAFE_INTEGER, lifetimeMonths: 120, elapsedMonths: 119 });
  assert.equal(large.accumulatedSatang, Number((BigInt(Number.MAX_SAFE_INTEGER) - 100n) * 119n / 120n));
});
test("ไม่เดาอัตราหรือวันเริ่มค่าเสื่อม", () => {
  fails(() => calculateDepreciation({ ...policy, policyApproved: false }), "POLICY_REQUIRED");
  fails(() => calculateDepreciation({ ...policy, startDate: "2026-02-30" }), "INVALID_POLICY");
  fails(() => calculateDepreciation({ ...policy, lifetimeMonths: 0 }), "INVALID_POLICY");
  fails(() => calculateDepreciation({ ...policy, residualSatang: 10002 }), "INVALID_POLICY");
});
test("จำหน่ายต้องตรวจจริง แยกผู้อนุมัติ และมีหลักฐานดำเนินการ", () => {
  const state = initial();
  fails(() => applyLifecycleCommand(state, command("APPROVE_DISPOSAL", "approver")), "INSPECTION_REQUIRED");
  fails(() => applyLifecycleCommand(state, command("PROPOSE_DISPOSAL", "warehouse")), "INSPECTION_REQUIRED");
  const inspected = applyLifecycleCommand(state, command("PROPOSE_DISPOSAL", "warehouse", { inspectionVerified: true }, "inspect", "person-1"));
  fails(() => applyLifecycleCommand(inspected, command("APPROVE_DISPOSAL", "approver", {}, "approve", "person-1")), "SEGREGATION_REQUIRED");
  const approved = applyLifecycleCommand(inspected, command("APPROVE_DISPOSAL", "approver", {}, "approve", "person-2"));
  fails(() => applyLifecycleCommand(approved, command("EXECUTE_DISPOSAL", "warehouse")), "EVIDENCE_REQUIRED");
  const executed = applyLifecycleCommand(approved, command("EXECUTE_DISPOSAL", "warehouse", { executionEvidenceVerified: true }, "execute", "person-3"));
  assert.equal(executed.disposal.executed, true);
  assert.equal(state.disposal.executed, false);
});
