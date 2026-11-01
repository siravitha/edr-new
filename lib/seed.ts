export const HOSPITAL = "UTH";
export const wards = [
  { id: "ICU", name: "หอผู้ป่วยวิกฤต" },
  { id: "ER", name: "อุบัติเหตุและฉุกเฉิน" },
  { id: "MED", name: "อายุรกรรม" },
  { id: "SUR", name: "ศัลยกรรม" },
  { id: "WH", name: "คลังครุภัณฑ์" }
];
export const categories = ["เครื่องช่วยหายใจ", "เครื่องติดตามสัญญาณชีพ", "เครื่องควบคุมสารน้ำ", "เครื่องกระตุกหัวใจ"];
export const statusLabels: Record<string, string> = { AVAILABLE: "พร้อมใช้", IN_USE: "กำลังใช้งาน", REPAIR: "ส่งซ่อม", QUARANTINED: "รอตรวจรับรอง", DISPOSED: "จำหน่ายแล้ว" };
export const paymentLabels: Record<string, string> = { DRAFT: "ร่างคำขอ", SUBMITTED: "รอตรวจสอบ", RETURNED: "ส่งคืนแก้ไข", APPROVED: "อนุมัติแล้ว", PAID: "จ่ายแล้ว" };
export const roles = [
  { id: "executive", name: "ผู้บริหาร" }, { id: "warehouse", name: "เจ้าหน้าที่คลัง" },
  { id: "nurse", name: "พยาบาล · ICU" }, { id: "strategy", name: "ยุทธศาสตร์" },
  { id: "procurement", name: "พัสดุ" }, { id: "finance", name: "การเงิน" },
  { id: "accounting", name: "บัญชี" }, { id: "auditor", name: "ผู้ตรวจสอบ" }
];
export type Asset = {
  id: string; hospitalId: string; assetNo: string; name: string; serialNo: string;
  category: string; wardId: string; status: string; version: number; cost: number;
  depreciation: number; verified: boolean; poNo: string; critical: boolean;
};
export type DemoState = {
  assets: Asset[]; receipts: any[]; conflicts: any[]; audit: any[];
  queue: any[]; payments: any[]; documents: any[]; lastSynced: string | null;
};
export function createSeed(): DemoState {
  const assets: Asset[] = Array.from({ length: 40 }, (_, i) => {
    const category = categories[i % 4];
    const cost = [850000, 185000, 48000, 320000][i % 4];
    return {
      id: `a${String(i + 1).padStart(3, "0")}`, hospitalId: HOSPITAL,
      assetNo: `UTH-69-${String(i + 1).padStart(5, "0")}`,
      name: category, serialNo: `PP-${260000 + i}`, category,
      wardId: wards[Math.floor(i / 8)].id,
      status: i === 0 ? "AVAILABLE" : i % 11 === 0 ? "QUARANTINED" : i % 7 === 0 ? "REPAIR" : i % 3 === 0 ? "AVAILABLE" : "IN_USE",
      version: 17, cost, depreciation: Math.round(cost * .22),
      verified: i % 6 !== 0, poNo: `PO-2569-${String(Math.floor(i / 8) + 1).padStart(3, "0")}`,
      critical: i % 4 !== 2
    };
  });
  return {
    assets, receipts: [], conflicts: [], queue: [], lastSynced: null,
    audit: [{ sequence: 1, actorId: "demo-system", deviceId: "seed", assetId: "a001", outcome: "SEED", code: "DEMO_DATA", beforeVersion: 17, afterVersion: 17 }],
    payments: [
      { id: "pay-001", hospitalId: HOSPITAL, claimNo: "PAY-2569-0142", title: "เครื่องช่วยหายใจ จำนวน 8 เครื่อง", amount: 6800000, poNo: "PO-2569-001", poStatus: "CLOSED", status: "SUBMITTED", revision: 1, makerId: "demo-procurement", overdue: true },
      { id: "pay-002", hospitalId: HOSPITAL, claimNo: "PAY-2569-0143", title: "เครื่องติดตามสัญญาณชีพ จำนวน 8 เครื่อง", amount: 1480000, poNo: "PO-2569-002", poStatus: "CLOSED", status: "RETURNED", revision: 1, makerId: "demo-procurement", returnReason: "รอใบแจ้งหนี้ฉบับแก้ไข", overdue: true },
      { id: "pay-003", hospitalId: HOSPITAL, claimNo: "PAY-2569-0144", title: "เครื่องควบคุมสารน้ำ จำนวน 8 เครื่อง", amount: 384000, poNo: "PO-2569-003", poStatus: "CLOSED", status: "PAID", revision: 1, makerId: "demo-procurement", overdue: false }
    ],
    documents: [
      { id: "doc-001", title: "ใบตรวจรับเครื่องช่วยหายใจ", ref: "GR-2569-0081", revision: 1, status: "AWAITING_WET_SIGNATURE", location: "ห้องพัสดุ · แฟ้ม GR/2569/08", poNo: "PO-2569-001" },
      { id: "doc-002", title: "ใบส่งมอบเครื่องติดตามสัญญาณชีพ", ref: "GR-2569-0082", revision: 1, status: "SIGNED_COPY_VERIFIED", location: "ห้องบัญชี · แฟ้ม GR/2569/09", poNo: "PO-2569-002" }
    ]
  };
}
