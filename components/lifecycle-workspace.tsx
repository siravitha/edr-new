"use client";

import { useState } from "react";
import { ArrowRight, Check, FileText, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createLifecycle, applyLifecycleCommand, availableBudget, calculateDepreciation } from "@/lib/lifecycle.mjs";

const phases = ["แผนและงบประมาณ", "จัดหาและผูกพัน", "ตรวจรับและเบิกจ่าย", "ขึ้นทะเบียนและใช้งาน", "ประเมินและสิ้นสุดอายุ"];
const phaseRanges = [[0, 3], [3, 8], [8, 11], [11, 14], [14, 15]];
const steps = [
  ["หน่วยงานย่อยทำคำขอ", "หน่วยงานผู้ใช้งาน", "คำขอพร้อมเหตุผลความจำเป็นและปริมาณ"],
  ["จัดทำแผนประจำปี", "ยุทธศาสตร์", "แผนประจำปีและรายการที่ผ่านการจัดลำดับความสำคัญ"],
  ["อนุมัติงบประมาณ", "ผู้มีอำนาจอนุมัติ", "แผนงบประมาณและแหล่งเงินที่ได้รับอนุมัติ"],
  ["จัดทำคำขอซื้อ/จ้าง (PR)", "หน่วยงาน / พัสดุ", "ใบขอซื้อขอจ้างและผู้อนุมัติตามอำนาจ"],
  ["ตรวจยอดงบก่อนผูกพัน", "การเงิน / เจ้าของงบ", "ผลตรวจวงเงินว่าง — ขั้นนี้ตรวจสอบเท่านั้น ผูกพันจริงเมื่อลงนาม ไม่หักงบซ้ำ"],
  ["ราคากลางและขอบเขตงาน", "พัสดุ / คณะกรรมการ", "ราคากลาง คุณลักษณะ และ TOR ที่ได้รับอนุมัติ"],
  ["ดำเนินวิธีจัดหา", "พัสดุ", "รายงานการจัดหาและผลคัดเลือกตามวิธีที่ได้รับอนุมัติ"],
  ["สัญญา/PO และผูกพัน", "ผู้มีอำนาจ / คู่สัญญา / พัสดุ", "สัญญาหรือใบสั่งซื้อสั่งจ้างที่ลงนามจริง และวงเงินผูกพันเพียงครั้งเดียว"],
  ["ตรวจรับ", "คณะกรรมการตรวจรับ", "ใบส่งมอบและรายงานตรวจรับที่ลงนามจริง"],
  ["เบิกจ่าย", "การเงิน / ผู้อนุมัติ", "ใบแจ้งหนี้ หลักฐานตรวจรับ ภาษี และหลักฐานการจ่าย"],
  ["ขึ้นทะเบียน", "บัญชี / ผู้ดูแลทะเบียน", "ต้นทุน วันที่พร้อมใช้ และเอกสารอ้างอิง"],
  ["จ่ายของให้หน่วยงาน", "คลัง / หอผู้ป่วย", "ใบจ่ายและใบรับมอบพร้อมผู้รับผิดชอบ"],
  ["ซ่อมและบำรุงรักษา", "ผู้ดูแล / ช่าง", "ประวัติแจ้งซ่อม ผลซ่อม และค่าใช้จ่าย"],
  ["คิดค่าเสื่อม", "บัญชี", "นโยบายอายุใช้งาน มูลค่าคงเหลือ และวันที่เริ่มคิดที่อนุมัติ"],
  ["ตรวจประจำปีและจำหน่าย", "กรรมการตรวจสอบ / ผู้อนุมัติ / พัสดุ", "แยกผลตรวจประจำปี การเสนอจำหน่าย การอนุมัติ และหลักฐานดำเนินการจริง ไม่จำหน่ายอัตโนมัติเมื่อค่าเสื่อมหมด"],
];
const workTypes = ["จัดซื้อ", "จัดจ้าง", "จ้างเหมาบริการ", "จ้างซ่อมบำรุง", "เช่า", "ก่อสร้าง", "บริจาค"];
const funds = ["เงินงบประมาณ", "เงินบำรุง", "เงินบริจาค"];
const format = (satang: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(satang / 100);

export function LifecycleWorkspace() {
  const [selected, setSelected] = useState(7);
  const [workType, setWorkType] = useState(workTypes[0]);
  const [fund, setFund] = useState(funds[0]);
  const step = steps[selected];
  return <div className="lifecycle-workspace">
    <div className="demo-banner"><ShieldCheck size={17}/><span>พื้นที่จำลองวงจร 15 ขั้นตอน • ข้อมูลตัวอย่าง ไม่สร้างเอกสารอนุมัติจริง</span></div>
    <div className="lifecycle-intro"><div><span className="eyebrow">COMPLETE ASSET LIFECYCLE</span><h2>จากความต้องการ สู่หลักฐานที่ตรวจสอบได้</h2><p>เชื่อมแผน พัสดุ การเงิน บัญชี และหน่วยงานผู้ใช้งานในมุมมองเดียว</p></div><span className="badge info">5 ระยะ · 15 ขั้นตอน</span></div>
    <div className="panel lifecycle-filters"><div><span className="detail-label">ประเภทงาน</span><div className="filter-pills">{workTypes.map(t => <button key={t} className={`filter-pill ${t === workType ? "active" : ""}`} onClick={() => setWorkType(t)}>{t}</button>)}</div></div><label className="form-field">แหล่งเงิน<select value={fund} onChange={e => setFund(e.target.value)}>{funds.map(f => <option key={f}>{f}</option>)}</select></label></div>
    <div className="lifecycle-context"><span>มุมมอง: <strong>{workType} · {fund}</strong></span><span>ตัวกรองนี้เป็นบริบทสาธิต ไม่กำหนดวิธีจัดหาหรือสิทธิ์อนุมัติแทนระเบียบ</span></div>
    <div className="lifecycle-layout"><section className="panel"><div className="panel-header"><div><h3 className="panel-title">เส้นทางการดำเนินงาน</h3><p className="panel-subtitle">เลือกขั้นตอนเพื่อดูผู้รับผิดชอบและหลักฐาน</p></div></div><div className="lifecycle-phases">{phases.map((phase, phaseIndex) => <div className="lifecycle-phase" key={phase}><div className="lifecycle-phase-label"><span>0{phaseIndex + 1}</span><strong>{phase}</strong></div>{steps.slice(phaseRanges[phaseIndex][0], phaseRanges[phaseIndex][1]).map((s, i) => { const index = phaseRanges[phaseIndex][0] + i; return <button key={s[0]} onClick={() => setSelected(index)} className={`lifecycle-step ${selected === index ? "selected" : ""}`} aria-pressed={selected === index}><span className="lifecycle-step-number">{index < 7 ? <Check size={13}/> : String(index + 1).padStart(2, "0")}</span><span>{s[0]}</span>{selected === index && <ArrowRight size={14}/>}</button>; })}</div>)}</div></section>
    <section className="lifecycle-detail"><div className="panel"><div className="panel-header"><span className="eyebrow">ขั้นตอน {String(selected + 1).padStart(2, "0")} / 15</span><span className={`badge ${selected < 7 ? "success" : selected === 7 ? "warning" : "neutral"}`}>{selected < 7 ? "ผ่านแล้ว (จำลอง)" : selected === 7 ? "รอดำเนินการ (จำลอง)" : "ขั้นตอนถัดไป"}</span></div><div className="panel-body"><h2 className="lifecycle-detail-title">{step[0]}</h2><div className="lifecycle-detail-item"><span className="detail-label">ผู้รับผิดชอบ</span><strong>{step[1]}</strong></div><div className="lifecycle-detail-item"><span className="detail-label">หลักฐานที่ต้องตรวจ</span><p><FileText size={16}/>{step[2]}</p></div><div className="lifecycle-rule"><LockKeyhole size={16}/><span>ใช้ลายมือชื่อจริงบนเอกสารทุกขั้นที่ต้องลงนาม เก็บตำแหน่งต้นฉบับและสำเนาสแกน ภาพสแกนไม่ใช่การอนุมัติอัตโนมัติ</span></div></div></div><BudgetDemo/><DepreciationDemo/></section></div>
    <div className="lifecycle-policy"><div><strong>นโยบายเบิกจ่ายออฟไลน์</strong><span className="badge warning">ยังไม่กำหนด</span><p>ยังไม่เปิดให้อนุมัติหรือจ่ายเงินออฟไลน์ ต้องกำหนดผู้รับผิดชอบและหลักฐานก่อนใช้งานจริง</p></div><div><strong>การทำงานร่วมระบบเดิม</strong><span className="badge neutral">ยังไม่เชื่อมต่อ</span><p>ทะเบียนและบัญชีในหน้านี้เป็นข้อมูลสาธิต ต้องกำหนดระบบเจ้าของข้อมูลและกระบวนการกระทบยอดเมื่อใช้สองระบบ</p></div></div>
  </div>;
}


function BudgetDemo() {
  const initial = () => createLifecycle({ tenantId: "UTH-DEMO", caseId: "DEMO-15", allocatedSatang: 100_000_000 });
  const [state, setState] = useState(initial);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [acceptance, setAcceptance] = useState(false);
  const [signature, setSignature] = useState(false);
  function execute(type: "SIGN_CONTRACT" | "PAY") {
    try {
      const next = applyLifecycleCommand(state, { opId: crypto.randomUUID(), expectedVersion: state.version, tenantId: "UTH-DEMO", actorId: type === "PAY" ? "DEMO-FINANCE" : "DEMO-PROCUREMENT", role: type === "PAY" ? "finance" : "procurement", type, payload: { amountSatang: type === "PAY" ? 30_000_000 : 100_000_000, document: { signed: type === "PAY" ? signature : true, verified: type === "PAY" ? signature : true }, ...(type === "PAY" ? { paymentRef: `DEMO-PAY-${String(state.budget.paidSatang / 30_000_000 + 1).padStart(3, "0")}`, acceptanceVerified: acceptance } : {}) } });
      setState(next); setError(false); setMessage(type === "PAY" ? "บันทึกการชำระจำลอง 300,000 บาทแล้ว — ไม่ใช่การจ่ายเงินจริง" : "ผูกพันสัญญาจำลอง 1,000,000 บาทแล้ว — ไม่ใช่การลงนามจริง");
    } catch (e) { setError(true); setMessage(`กติกาปฏิเสธรายการ: ${e instanceof Error ? e.message : "ไม่สามารถดำเนินการได้"}`); }
  }
  return <div className="panel"><div className="panel-header"><div><h3 className="panel-title">จำลองวงเงินผูกพันและจ่ายชำระ</h3><p className="panel-subtitle">เก็บเป็นสตางค์ • บัญชีสาธิตเริ่มใหม่เมื่อออกจากหน้านี้</p></div></div><div className="panel-body"><div className="stat-row"><span>วงเงินจัดสรร</span><strong>฿{format(state.budget.allocatedSatang)}</strong></div><div className="stat-row"><span>วงเงินผูกพันคงเหลือ</span><strong>฿{format(state.budget.committedSatang)}</strong></div><div className="stat-row"><span>จ่ายสะสม</span><strong>฿{format(state.budget.paidSatang)}</strong></div><div className="stat-row"><span>วงเงินว่างสำหรับผูกพันใหม่</span><strong>฿{format(availableBudget(state))}</strong></div><label className="checkbox-row"><input type="checkbox" checked={acceptance} onChange={e => setAcceptance(e.target.checked)}/>จำลองตรวจรับ: ตรวจหลักฐานส่งมอบและผลตรวจรับครบแล้ว</label><label className="checkbox-row"><input type="checkbox" checked={signature} onChange={e => setSignature(e.target.checked)}/>จำลองตรวจลายมือชื่อจริง: ลงนามครบและผู้ลงนามมีอำนาจ</label><div className="lifecycle-budget-actions"><Button size="sm" disabled={state.contract.signed} onClick={() => execute("SIGN_CONTRACT")}>จำลองผูกพัน 1,000,000 บาท</Button><Button variant="secondary" size="sm" disabled={!acceptance || !signature || !state.contract.signed || 30_000_000 > state.budget.committedSatang} onClick={() => execute("PAY")}>จำลองชำระ 300,000 บาท</Button><Button variant="ghost" size="sm" onClick={() => { setState(initial()); setMessage(""); setAcceptance(false); setSignature(false); }}>เริ่มตัวอย่างใหม่</Button></div>{message && <p role="status" className={`lifecycle-budget-message ${error ? "error" : ""}`}>{message}</p>}<p className="lifecycle-note">สถานะลงนามและตรวจเอกสารในตัวจำลองถูกตั้งไว้เพื่อทดสอบกติกาเท่านั้น ระบบจริงต้องตรวจเอกสารลายมือชื่อจริงและอำนาจอนุมัติ</p></div></div>;
}
function DepreciationDemo() {
  // นโยบายนี้เป็นสมมติฐานเพื่อทดสอบสูตรเท่านั้น ไม่ใช่นโยบายบัญชีโรงพยาบาล
  const result = calculateDepreciation({ costSatang: 100_000_000, residualSatang: 0, lifetimeMonths: 60, elapsedMonths: 60, policyApproved: true, startDate: "2021-11-01" });
  return <div className="panel"><div className="panel-header"><h3 className="panel-title">ค่าเสื่อมและการจำหน่าย</h3></div><div className="panel-body"><span className="badge warning">สมมติฐานสาธิตยังไม่รับรอง</span><p className="lifecycle-note">ตัวอย่างนโยบายอนุมัติจำลอง: อายุ 60 เดือน มูลค่าคงเหลือ 0 บาท วันที่พร้อมใช้ 1 พ.ย. 2564 คำนวณเมื่อครบ 60 เดือน</p><div className="stat-row"><span>ค่าเสื่อมสะสมจำลอง</span><strong>฿{format(result.accumulatedSatang)}</strong></div><div className="stat-row"><span>มูลค่าตามบัญชีจำลอง</span><strong>฿{format(result.bookValueSatang)}</strong></div><div className="lifecycle-rule"><ShieldCheck size={17}/><span>ค่าเสื่อมเต็มจำนวนไม่ทำให้จำหน่ายอัตโนมัติ ทรัพย์สินยังใช้ต่อและต้องตรวจนับจนกว่าจะได้รับอนุมัติจำหน่าย</span></div></div></div>;
}


