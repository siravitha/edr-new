"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Activity, ArrowDownToLine, ArrowRight, ArrowUpRight, Bell, Box, Building2, ChartNoAxesCombined, Check, CheckCheck, ChevronDown, ChevronRight, CircleHelp, ClipboardCheck, ClipboardList, FileCheck2, FileText, FolderClock, HeartPulse, History, Layers3, Menu, MoreHorizontal, Package, Plus, QrCode, RefreshCw, Search, Settings2, ShieldCheck, Upload, Wallet, Wifi, WifiOff, X } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LifecycleWorkspace } from "@/components/lifecycle-workspace";
import { UserManagement } from "@/components/user-management";
import { MasterDataManagement, HospitalProfileManagement } from "@/components/master-data-management";
import { createMasterData } from "@/lib/master-data.mjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { categories, createSeed, HOSPITAL, paymentLabels, roles, statusLabels, wards, type Asset, type DemoState } from "@/lib/seed";
import { loadState, saveState } from "@/lib/storage";
import { transitionAsset, transitionPayment } from "@/lib/domain.mjs";
import { parseAssetCsv, toCsv } from "@/lib/csv.mjs";

type Page = "dashboard" | "assets" | "procurement" | "finance" | "documents" | "sync" | "audit" | "integrations" | "users" | "document-codes" | "departments" | "hospital" | "vendors";
const nav = [
  { id: "dashboard", label: "ภาพรวมผู้บริหาร", icon: ChartNoAxesCombined },
  { id: "assets", label: "ทะเบียนครุภัณฑ์", icon: Box },
  { id: "procurement", label: "วงจรพัสดุ 15 ขั้นตอน", icon: ClipboardList },
  { id: "finance", label: "การเงินและบัญชี", icon: Wallet },
  { id: "documents", label: "เอกสารและหลักฐาน", icon: FileCheck2 },
  { id: "sync", label: "คิวซิงก์และข้อขัดแย้ง", icon: RefreshCw },
  { id: "audit", label: "ประวัติการดำเนินการ", icon: History },
  { id: "integrations", label: "การเชื่อมต่อระบบ", icon: Settings2 },
  { id: "users", label: "จัดการผู้ใช้งาน", icon: ShieldCheck },
  { id: "document-codes", label: "จัดการรหัสคุมเอกสาร", icon: FileText },
  { id: "departments", label: "จัดการแผนก/ฝ่าย", icon: Building2 },
  { id: "hospital", label: "ข้อมูลโรงพยาบาล", icon: HeartPulse },
  { id: "vendors", label: "จัดการผู้ค้ากับโรงพยาบาล", icon: Package }
] as const;
const settingsPages: readonly string[] = ["users", "document-codes", "departments", "hospital", "vendors"];
const money = (v: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(v);
const wardName = (id: string) => wards.find(w => w.id === id)?.name ?? id;
const tone = (status: string) => status === "AVAILABLE" || status === "APPROVED" || status === "PAID" ? "success" : status === "IN_USE" ? "info" : status === "REPAIR" || status === "RETURNED" ? "danger" : "warning";
const errorMessages: Record<string, string> = { INVALID_TRANSITION: "สถานะนี้ต้องผ่านการตรวจรับรองก่อน", OUT_OF_SCOPE: "ไม่มีสิทธิ์ในหน่วยงานนี้", FORBIDDEN: "บทบาทนี้ไม่มีสิทธิ์เปลี่ยนสถานะ", IDEMPOTENCY_KEY_REUSED: "รหัสคำสั่งซ้ำแต่เนื้อหาต่างกัน", DEVICE_MISMATCH: "อุปกรณ์ไม่ตรงกับผู้ส่งคำสั่ง", EVIDENCE_REQUIRED: "ต้องตรวจหลักฐานและลายเซ็นก่อนอนุมัติ", SEGREGATION_OF_DUTIES: "ผู้จัดทำและผู้อนุมัติต้องเป็นคนละคน", INVALID_TRANSITION_OR_ROLE: "บทบาทหรือขั้นตอนไม่ถูกต้อง" };
const uid = () => crypto.randomUUID();

function Modal({ title, children, footer, close }: { title: string; children: ReactNode; footer?: ReactNode; close: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const first = dialog.current?.querySelector<HTMLElement>("button,input,select,textarea");
    first?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        const elements = [...(dialog.current?.querySelectorAll<HTMLElement>("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]") ?? [])];
        const a = elements[0], b = elements.at(-1);
        if (event.shiftKey && document.activeElement === a) { event.preventDefault(); b?.focus(); }
        else if (!event.shiftKey && document.activeElement === b) { event.preventDefault(); a?.focus(); }
      }
    };
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><div ref={dialog} role="dialog" aria-modal="true" aria-label={title} className="modal"><div className="modal-header"><h2>{title}</h2><Button variant="ghost" size="icon" onClick={close} aria-label="ปิด"><X size={18}/></Button></div><div className="modal-body">{children}</div>{footer && <div className="modal-footer">{footer}</div>}</div></div>;
}

export default function Home() {
  const [data, setData] = useState<DemoState>(createSeed);
  const [masterSeed] = useState(createMasterData);
  const stateRef = useRef(data);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState<Page>("dashboard");
  const [role, setRole] = useState("executive");
  const [offline, setOffline] = useState(false);
  const [networkOnline, setNetworkOnline] = useState(true);
  const [menu, setMenu] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [ward, setWard] = useState("all");
  const [status, setStatus] = useState("all");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [modal, setModal] = useState<"scan" | "import" | "payment" | "help" | "reset" | null>(null);
  const [scan, setScan] = useState("");
  const [scanned, setScanned] = useState<Asset | null>(null);
  const [nextStatus, setNextStatus] = useState("IN_USE");
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const [importResult, setImportResult] = useState<{ valid: any[]; errors: string[] } | null>(null);
  const [paymentId, setPaymentId] = useState("");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState(false);
  const [signature, setSignature] = useState(false);
  const [swReady, setSwReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [duplicateTab, setDuplicateTab] = useState(false);
  const [lockReady, setLockReady] = useState(false);
  const writingRef = useRef(false);
  const importGeneration = useRef(0);
  const importedSource = useRef("");
  const title = nav.find(n => n.id === page)?.label;
  const masterData = data.masterData ?? masterSeed;
  const isOffline = offline || !networkOnline;
  const editable = ready && lockReady && !busy && !storageError && !duplicateTab;
  const scope = role === "nurse" ? ["ICU"] : wards.map(w => w.id);
  const actor = { id: `demo-${role}`, hospitalId: HOSPITAL, wardIds: scope, role, deviceId: "tablet-A" };
  const scopedAssets = data.assets.filter(a => scope.includes(a.wardId));
  const filtered = scopedAssets.filter(a => (ward === "all" || a.wardId === ward) && (status === "all" || a.status === status) && `${a.assetNo} ${a.name} ${a.serialNo}`.toLowerCase().includes(query.toLowerCase()));
  const critical = scopedAssets.filter(a => a.critical && a.status !== "DISPOSED");
  const available = critical.filter(a => ["AVAILABLE", "IN_USE"].includes(a.status)).length;
  const readiness = critical.length ? Math.round(100 * available / critical.length) : 0;
  const verified = scopedAssets.filter(a => a.verified).length;
  const bookValue = scopedAssets.reduce((sum, a) => sum + (a.status === "DISPOSED" ? 0 : a.cost - a.depreciation), 0);
  const pendingPayments = data.payments.filter(p => p.overdue && !["PAID", "APPROVED"].includes(p.status)).length;
  const payment = data.payments.find(p => p.id === paymentId);

  function notify(message: string, error = false) { setToast({ message, error }); }
  async function commit(next: DemoState) {
    if (!editable || writingRef.current || data !== stateRef.current) { notify("มีรายการกำลังบันทึก กรุณารอแล้วลองอีกครั้ง", true); return false; }
    writingRef.current = true;
    setBusy(true);
    try { await saveState(next); stateRef.current = next; setData(next); return true; }
    catch { setStorageError(true); notify("บันทึกในเครื่องไม่สำเร็จ รายการยังไม่ถูกยืนยัน", true); return false; }
    finally { writingRef.current = false; setBusy(false); }
  }

  useEffect(() => {
    let cancelled = false;
    let releaseLock: (() => void) | undefined;
    loadState().then(value => { if (!cancelled) { stateRef.current = value; setData(value); setReady(true); } }).catch(() => { setStorageError(true); setReady(true); });
    setNetworkOnline(navigator.onLine);
    const update = () => setNetworkOnline(navigator.onLine);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready).then(() => { if (!cancelled) setSwReady(true); }).catch(() => {});
    // ให้แท็บเดียวแก้ข้อมูลสาธิต เพื่อไม่ให้เขียนทับ snapshot จากอีกแท็บ
    const onHide = () => releaseLock?.();
    window.addEventListener("pagehide", onHide);
    if ("locks" in navigator) navigator.locks.request("uth-demo-writer", { ifAvailable: true }, async lock => {
      if (cancelled) return;
      setLockReady(true);
      if (!lock) { setDuplicateTab(true); return; }
      await new Promise<void>(resolve => { releaseLock = resolve; });
    }).catch(() => { if (!cancelled) { setDuplicateTab(true); setLockReady(true); } });
    else { setLockReady(true); setDuplicateTab(true); }
    return () => { cancelled = true; releaseLock?.(); window.removeEventListener("pagehide", onHide); window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(null), 5500); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { setOffset(0); }, [query, ward, status, role]);
  function go(next: Page) { setPage(next); setMenu(false); setQuery(""); setWard("all"); setStatus("all"); window.scrollTo({ top: 0 }); }
  function download(name: string, contents: string, mime = "text/csv;charset=utf-8") {
    const url = URL.createObjectURL(new Blob([contents], { type: mime }));
    const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportAssets() {
    download("uth-assets-demo.csv", toCsv([["เลขครุภัณฑ์", "รายการ", "หน่วยงาน", "สถานะ", "ราคาทุน", "รุ่นข้อมูล"], ...filtered.map(a => [a.assetNo, a.name, wardName(a.wardId), statusLabels[a.status], a.cost, a.version])]));
    notify("ส่งออกรายการตามตัวกรองแล้ว · ข้อมูลจำลอง");
  }
  function findScan(value = scan) {
    const cleaned = value.replace(/[\r\n]+$/, "");
    if (!/^UTH-69-\d{5}$/.test(cleaned)) { notify("รหัสไม่ถูกต้อง เช่น UTH-69-00001", true); return; }
    const asset = scopedAssets.find(a => a.assetNo === cleaned);
    if (!asset) { notify("ไม่พบทะเบียนในขอบเขตที่ได้รับสิทธิ์", true); return; }
    setScan(cleaned); setScanned(asset); setNextStatus(asset.status === "AVAILABLE" ? "IN_USE" : "REPAIR");
  }
  async function submitScan() {
    if (!scanned || !editable) return;
    if (!["warehouse", "nurse"].includes(role)) { notify("เลือกมุมมองเจ้าหน้าที่คลังหรือพยาบาลเพื่อทดลอง", true); return; }
    const command = { id: uid(), assetId: scanned.id, baseVersion: scanned.version, nextStatus, deviceId: actor.deviceId };
    if (isOffline) {
      if (await commit({ ...data, queue: [...data.queue, { command, actor, capturedAt: new Date().toISOString() }] })) {
        setModal(null); notify("เก็บคำสั่งในเครื่องแล้ว · สถานะทะเบียนยังไม่เปลี่ยนจนซิงก์");
      }
      return;
    }
    const { state, result } = transitionAsset(data, command, actor);
    if (await commit(state)) {
      setModal(null);
      notify(result.status === "APPLIED" ? "อัปเดตทะเบียนจำลองและบันทึกประวัติแล้ว" : errorMessages[result.code] ?? "พบข้อขัดแย้ง กรุณาตรวจสอบคิว", result.status !== "APPLIED");
    }
  }
  async function syncQueue() {
    if (isOffline) { notify("กลับสู่โหมดออนไลน์ก่อนซิงก์", true); return; }
    let next = data; let applied = 0, conflicts = 0;
    const remaining = [];
    for (const item of data.queue) {
      if (item.actor.id !== actor.id) { remaining.push(item); continue; }
      const out = transitionAsset(next, item.command, actor);
      next = out.state;
      if (out.result.status === "APPLIED") applied++;
      else if (out.result.status === "CONFLICT") conflicts++;
      else remaining.push(item);
    }
    if (await commit({ ...next, queue: remaining, lastSynced: new Date().toISOString() })) notify(`ซิงก์จำลอง: สำเร็จ ${applied} · ขัดแย้ง ${conflicts} · คงค้าง ${remaining.length}`);
  }
  async function simulateConflict() {
    if (!editable || isOffline) return;
    const asset = data.assets.find(a => a.status === "AVAILABLE" && a.wardId === "ICU");
    if (!asset) { notify("ต้องมีครุภัณฑ์ ICU พร้อมใช้เพื่อจำลอง ลองรีเซ็ตข้อมูล", true); return; }
    const a = { id: "demo-warehouse", role: "warehouse", hospitalId: HOSPITAL, wardIds: ["ICU"], deviceId: "tablet-A" };
    const b = { ...a, deviceId: "tablet-B" };
    const first = transitionAsset(data, { id: uid(), assetId: asset.id, deviceId: a.deviceId, baseVersion: asset.version, nextStatus: "REPAIR" }, a);
    const second = transitionAsset(first.state, { id: uid(), assetId: asset.id, deviceId: b.deviceId, baseVersion: asset.version, nextStatus: "IN_USE" }, b);
    if (await commit(second.state)) { setRole("warehouse"); go("sync"); notify("จำลองแล้ว: เครื่อง A สำเร็จ · เครื่อง B เข้าคิวข้อขัดแย้ง"); }
  }
  async function importCsv(file?: File) {
    const generation = ++importGeneration.current;
    if (!file) return;
    if (file.size > 1_000_000 || !file.name.toLowerCase().endsWith(".csv")) { notify("รองรับ CSV ไม่เกิน 1 MB", true); return; }
    try { const source = await file.text(); if (generation !== importGeneration.current) return; importedSource.current = source; setImportResult(parseAssetCsv(source, data.assets.map(a => a.assetNo), scope)); }
    catch (error) { notify(error instanceof Error ? error.message : "อ่านไฟล์ไม่สำเร็จ", true); }
  }
  async function confirmImport() {
    if (!importResult || importResult.errors.length || !["warehouse", "procurement"].includes(role)) return;
    const checked = parseAssetCsv(importedSource.current, data.assets.map(a => a.assetNo), scope);
    if (checked.errors.length) { setImportResult(checked); return; }
    const added = checked.valid.map((row: any) => ({ ...row, id: uid(), hospitalId: HOSPITAL, status: "QUARANTINED", version: 0, depreciation: 0, verified: false, poNo: "รอผูกเอกสาร", critical: true }));
    if (await commit({ ...data, assets: [...data.assets, ...added], audit: [...data.audit, { sequence: data.audit.length + 1, actorId: actor.id, deviceId: actor.deviceId, outcome: "IMPORT_STAGED", code: `${added.length}_ROWS`, beforeVersion: null, afterVersion: null }] })) {
      setModal(null); notify(`นำเข้า ${added.length} รายการในสถานะรอตรวจรับรองแล้ว`);
    }
  }
  async function paymentAction(event: string) {
    if (!payment || isOffline) return;
    const out = transitionPayment(payment, event, actor, { reason, evidenceComplete: evidence, signatureVerified: signature });
    if (out.result.status !== "APPLIED") { notify(errorMessages[out.result.code] ?? "ขั้นตอนไม่ถูกต้องหรือไม่มีสิทธิ์", true); return; }
    const archived = event === "RESUBMIT" ? [...(payment.history ?? []), { ...payment, history: undefined }] : payment.history ?? [];
    if (await commit({ ...data, payments: data.payments.map(p => p.id === payment.id ? { ...out.payment, history: archived } : p), audit: [...data.audit, { sequence: data.audit.length + 1, actorId: actor.id, deviceId: actor.deviceId, assetId: payment.claimNo, outcome: `PAYMENT_${event}`, code: `PO_${payment.poStatus}`, beforeVersion: payment.revision, afterVersion: out.payment.revision }] })) {
      setModal(null); notify("บันทึกขั้นตอนจำลองแล้ว · สถานะ PO คงเดิม");
    }
  }
  const openScan = () => { setScanned(null); setScan(""); setModal("scan"); };
  function assetTable(rows: Asset[], compact = false) {
    return <div className="table-wrap"><table className="data-table"><thead><tr><th>รายการครุภัณฑ์</th><th>หน่วยงาน</th><th>สถานะ</th>{!compact && <th>มูลค่าตามบัญชี</th>}<th>รุ่นข้อมูล</th><th><span className="sr-only">รายละเอียด</span></th></tr></thead><tbody>{rows.map(a => <tr key={a.id}><td><button className="table-link asset-name" onClick={() => setSelected(a)}><span className="asset-icon"><HeartPulse size={16}/></span><span>{a.name}<small>{a.assetNo} · {a.serialNo}</small></span></button></td><td>{wardName(a.wardId)}</td><td><span className={`badge ${tone(a.status)}`}><span className="status-dot"/>{statusLabels[a.status]}</span></td>{!compact && <td>฿{money(a.cost - a.depreciation)}</td>}<td><span className="version-tag">v{a.version}</span></td><td><button className="table-link" aria-label={`ดู ${a.assetNo}`} onClick={() => setSelected(a)}><ChevronRight size={17}/></button></td></tr>)}</tbody></table>{!rows.length && <div className="empty-state"><Search size={28}/><p>ไม่พบรายการตามเงื่อนไขนี้</p></div>}</div>;
  }

  return <div className="app-shell">
    {menu && <button className="sidebar-overlay" onClick={() => setMenu(false)} aria-label="ปิดเมนู"/>}
    <aside className={`sidebar ${menu ? "open" : ""}`}><div className="brand"><div className="brand-icon"><Layers3 size={25}/></div><div className="brand-copy"><strong>UTH Smart Assets</strong><small>โรงพยาบาลอุดรธานี</small></div></div>
      <div className="workspace-label"><Building2 size={15}/><span>ศูนย์บริหารครุภัณฑ์</span><ChevronDown size={13}/></div>
      <div className="nav-section">พื้นที่การทำงาน</div><nav aria-label="เมนูหลัก">{nav.slice(0, 5).map(n => <button key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`} aria-current={page === n.id ? "page" : undefined} onClick={() => go(n.id)}><n.icon size={18}/><span>{n.label}</span>{n.id === "finance" && pendingPayments > 0 && <span className="nav-count">{pendingPayments}</span>}</button>)}</nav>
      <div className="nav-section">การควบคุมและตรวจสอบ</div><nav aria-label="เมนูตรวจสอบ">{nav.slice(5).filter(n => !settingsPages.includes(n.id)).map(n => <button key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`} onClick={() => go(n.id)}><n.icon size={18}/><span>{n.label}</span>{n.id === "sync" && (data.queue.length + data.conflicts.length > 0) && <span className="nav-count">{data.queue.length + data.conflicts.length}</span>}</button>)}</nav>
      <nav aria-label="ตั้งค่าระบบ" className="settings-nav"><button className={`nav-item nav-parent ${settingsPages.includes(page) ? "nav-parent-current" : ""}`} aria-expanded={settingsOpen} aria-controls="settings-submenu" onClick={() => setSettingsOpen(open => !open)}><Settings2 size={18}/><span>ตั้งค่าระบบ</span><ChevronDown size={14} className={`nav-chevron ${settingsOpen ? "expanded" : ""}`}/></button>{settingsOpen && <div id="settings-submenu" className="nav-submenu">{nav.filter(n=>settingsPages.includes(n.id)).map(n=><button key={n.id} className={`nav-item nav-child ${page === n.id ? "active" : ""}`} aria-current={page === n.id ? "page" : undefined} onClick={() => go(n.id)}><n.icon size={16}/><span>{n.label}</span></button>)}</div>}</nav>
      <div className="sidebar-footer"><div className="sidebar-security"><ShieldCheck size={16}/><span>ต้นแบบ · ข้อมูลจำลองเท่านั้น</span></div><div className="footer-company">พัฒนาโดย <strong>Pacific Plus IT</strong><br/><span>SMARTER ASSETS. BETTER CARE.</span></div></div>
    </aside>
    <div className="main-panel"><header className="topbar"><div className="breadcrumb"><button className="mobile-menu" aria-label="เปิดเมนู" onClick={() => setMenu(true)}><Menu size={21}/></button><span>ระบบบริหารครุภัณฑ์</span><ChevronRight size={13}/><strong>{title}</strong></div><div className="topbar-actions"><span className={`connection-indicator ${isOffline ? "is-offline" : ""}`}>{isOffline ? <WifiOff size={14}/> : <Wifi size={14}/>} {isOffline ? "ออฟไลน์" : "พร้อมทดลอง"}</span><button className="help-btn" aria-label="วิธีทดลอง" onClick={() => setModal("help")}><CircleHelp size={19}/></button><div className="topbar-divider"/><div className="avatar">พพ</div><label className="role-picker"><small>มุมมองจำลอง</small><select aria-label="เลือกบทบาทจำลอง" value={role} onChange={e => setRole(e.target.value)}>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label></div></header>
      <main className="main-content"><div className="page-heading"><div><span className="eyebrow">UDON THANI HOSPITAL</span><h1>{title}</h1><p>ทุกครุภัณฑ์มีคุณค่า เพื่อการดูแลที่ดีกว่า <span className="heading-date">· ปีงบประมาณ 2569 · ชุดข้อมูลตัวอย่าง</span></p></div><div className="heading-actions"><Button variant="secondary" onClick={exportAssets}><ArrowDownToLine size={15}/>ส่งออกรายงาน</Button><Button onClick={openScan} disabled={!ready}><QrCode size={16}/>สแกนครุภัณฑ์</Button></div></div>
      <div className="demo-banner"><ShieldCheck size={16}/><span><strong>พื้นที่ทดลองใช้งาน</strong> ข้อมูลทั้งหมดเป็นข้อมูลจำลอง เก็บเฉพาะในเบราว์เซอร์นี้ · ยังไม่เชื่อมระบบโรงพยาบาล</span><button className="banner-link" onClick={() => setModal("help")}>วิธีทดลอง <ArrowUpRight size={12}/></button></div>
      {(!ready || storageError || duplicateTab) && <div className="offline-banner" role="status">{!ready ? "กำลังโหลดข้อมูลที่เก็บไว้ในเครื่อง…" : duplicateTab ? "เปิดอยู่หลายแท็บ: แท็บนี้ดูข้อมูลได้เท่านั้น กรุณาทดลองแก้ไขในแท็บแรก" : "เบราว์เซอร์ไม่อนุญาตให้จัดเก็บข้อมูล จึงปิดการเปลี่ยนแปลงเพื่อป้องกันข้อมูลหาย"}</div>}
      {isOffline && <div className="offline-banner"><WifiOff size={16}/>โหมดออฟไลน์: คำสั่งสแกนจะเก็บในเครื่องและรอซิงก์ · งานอนุมัติถูกพักไว้</div>}

      {page === "dashboard" && <>
        <section className="kpi-grid" aria-label="ตัวชี้วัดหลัก">{[
          { icon: Wallet, label: "มูลค่าตามบัญชีสุทธิ", value: (bookValue / 1e6).toFixed(2), unit: "ล้านบาท", meta: `${money(scopedAssets.length)} รายการในขอบเขต`, sub: "ราคาทุนหักค่าเสื่อมจำลอง", color: "teal" },
          { icon: HeartPulse, label: "ความพร้อมใช้อุปกรณ์สำคัญ", value: readiness, unit: "%", meta: `${available} จาก ${critical.length} เครื่อง`, sub: "นับพร้อมใช้และกำลังใช้งาน", color: "green" },
          { icon: FolderClock, label: "คำขอเบิกจ่ายเกินกำหนด", value: pendingPayments, unit: "รายการ", meta: "ควรติดตามการแก้ไขเอกสาร", sub: "ตาม SLA จำลอง", color: "amber" },
          { icon: ClipboardCheck, label: "ความครบถ้วนการตรวจนับ", value: scopedAssets.length ? Math.round(verified / scopedAssets.length * 100) : 0, unit: "%", meta: `${verified} จาก ${scopedAssets.length} รายการ`, sub: "รอบตรวจนับตัวอย่าง", color: "blue" }
        ].map((k, i) => <div className="kpi-card" key={k.label}><div className="kpi-top"><div className={`kpi-icon ${k.color}`}><k.icon size={19}/></div><span className="kpi-number">0{i + 1}</span></div><div className="kpi-label">{k.label}</div><div className="kpi-value">{k.value}<small>{k.unit}</small></div><div className="kpi-meta"><span className={i === 2 ? "warning-text" : "delta"}>{k.meta}</span></div><div className="kpi-foot">{k.sub}</div></div>)}</section>
        <div className="dashboard-grid"><Card><CardHeader><div><CardTitle>แนวโน้มการใช้งานครุภัณฑ์</CardTitle><p className="panel-subtitle">สัดส่วนพร้อมให้บริการ · ข้อมูลแนวโน้มจำลองสำหรับแสดงผล</p></div><span className="badge neutral">6 เดือน</span></CardHeader><CardContent><div className="chart-summary"><strong>ภาพรวมความพร้อมใช้</strong><span><i className="dot"/>พร้อมให้บริการ <i className="dot dot-pale"/>เป้าหมาย</span></div><div style={{ width: "100%", height: 205 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={[{ month: "พ.ค.", actual: 76, target: 90 }, { month: "มิ.ย.", actual: 81, target: 90 }, { month: "ก.ค.", actual: 78, target: 90 }, { month: "ส.ค.", actual: 86, target: 90 }, { month: "ก.ย.", actual: 83, target: 90 }, { month: "ต.ค.", actual: readiness, target: 90 }]} margin={{ top: 10, right: 8, left: -28, bottom: 0 }} accessibilityLayer><defs><linearGradient id="readinessFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0b999b" stopOpacity={.21}/><stop offset="95%" stopColor="#0b999b" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="4 5" vertical={false} stroke="#e8eef1"/><XAxis dataKey="month" tick={{ fill: "#8a9ca5", fontSize: 10 }} tickLine={false} axisLine={false}/><YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: "#9aaab1", fontSize: 9 }} tickLine={false} axisLine={false}/><Tooltip formatter={(v, name) => [`${v}%`, name === "actual" ? "พร้อมให้บริการ" : "เป้าหมาย"]} contentStyle={{ borderRadius: 8, fontSize: 12, borderColor: "#e3ecee" }}/><Area dataKey="target" stroke="#b2d9d6" fill="transparent" strokeDasharray="5 5" strokeWidth={2}/><Area dataKey="actual" type="monotone" stroke="#078f94" strokeWidth={2.5} fill="url(#readinessFill)" dot={{ r: 3, fill: "white", strokeWidth: 2 }} isAnimationActive={false}/></AreaChart></ResponsiveContainer></div></CardContent></Card>
        <Card><CardHeader><div><CardTitle>ความพร้อมใช้แยกหน่วยงาน</CardTitle><p className="panel-subtitle">เลือกช่องเพื่อดูรายการครุภัณฑ์</p></div><span className="panel-mini-icon"><Activity size={17}/></span></CardHeader><CardContent><div className="heatmap-wrap"><div className="heatmap" role="table" aria-label="ตารางความพร้อมใช้" style={{ gridTemplateColumns: "minmax(82px,1.5fr) repeat(4,1fr)" }}><span/><span className="heat-col">ช่วยหายใจ</span><span className="heat-col">ติดตามชีพ</span><span className="heat-col">สารน้ำ</span><span className="heat-col">กระตุกหัวใจ</span>{wards.filter(w => scope.includes(w.id)).map(w => <div style={{ display: "contents" }} key={w.id}><span className="heat-row">{w.id === "WH" ? "คลัง" : w.id}</span>{categories.map(c => { const all = scopedAssets.filter(a => a.wardId === w.id && a.category === c); const good = all.filter(a => ["AVAILABLE", "IN_USE"].includes(a.status)).length; const p = all.length ? Math.round(good / all.length * 100) : null; return <button key={c} className={`heat-cell ${p === null ? "heat-empty" : p >= 90 ? "heat-good" : p >= 70 ? "heat-warn" : "heat-bad"}`} aria-label={`${w.name} ${c} พร้อมใช้ ${good} จาก ${all.length}`} onClick={() => { go("assets"); setWard(w.id); setQuery(c); }}>{p === null ? "—" : `${p}%`}</button>; })}</div>)}</div></div><div className="legend"><span><i className="legend-square heat-good"/>90–100%</span><span><i className="legend-square heat-warn"/>70–89%</span><span><i className="legend-square heat-bad"/>ต่ำกว่า 70%</span></div></CardContent></Card></div>
        <div className="dashboard-grid dashboard-bottom"><Card><CardHeader><div><CardTitle>ครุภัณฑ์ที่ควรติดตาม</CardTitle><p className="panel-subtitle">รายการส่งซ่อมและรอตรวจรับรอง</p></div><button className="text-button" onClick={() => { go("assets"); setStatus("REPAIR"); }}>ดูทั้งหมด <ArrowRight size={13}/></button></CardHeader>{assetTable(scopedAssets.filter(a => ["REPAIR", "QUARANTINED"].includes(a.status)).slice(0, 4), true)}</Card><Card><CardHeader><div><CardTitle>กิจกรรมและงานที่ต้องทำ</CardTitle><p className="panel-subtitle">ติดตามกระบวนการข้ามหน่วยงาน</p></div><span className="badge neutral">{data.audit.length} เหตุการณ์</span></CardHeader><CardContent><div className="activity-list"><button className="activity-item activity-button" onClick={() => go("finance")}><span className="activity-icon amber"><FileText size={15}/></span><span className="activity-content">คำขอเบิกจ่ายรอติดตาม <strong>{pendingPayments} รายการ</strong><p>ตรวจสอบหลักฐานและเอกสารที่ถูกส่งคืน</p></span><ChevronRight size={14}/></button><button className="activity-item activity-button" onClick={() => go("sync")}><span className="activity-icon"><RefreshCw size={15}/></span><span className="activity-content">รอซิงก์ <strong>{data.queue.length}</strong> · ข้อขัดแย้ง <strong>{data.conflicts.length}</strong><p>รายการจากแท็บเล็ตและผลตรวจรุ่นข้อมูล</p></span><ChevronRight size={14}/></button><button className="activity-item activity-button" onClick={() => go("documents")}><span className="activity-icon blue"><FileCheck2 size={15}/></span><span className="activity-content">รอลายเซ็นหมึก <strong>{data.documents.filter(d => d.status === "AWAITING_WET_SIGNATURE").length} ฉบับ</strong><p>เอกสารต้องตรงรุ่นก่อนรับรองสำเนา</p></span><ChevronRight size={14}/></button><button className="activity-item activity-button" onClick={() => go("audit")}><span className="activity-icon"><ShieldCheck size={15}/></span><span className="activity-content">ตรวจสอบย้อนหลังได้ทุกขั้นตอน<p>เปิดประวัติการทำรายการในพื้นที่ทดลอง</p></span><ChevronRight size={14}/></button></div></CardContent></Card></div>
        <div className="page-footer"><span><ShieldCheck size={13}/> ข้อมูลสาธิต ไม่มีข้อมูลผู้ป่วย</span><span>PACIFIC PLUS IT · UTH SMART ASSETS</span></div>
      </>}

      {page === "assets" && <><div className="toolbar"><div className="search-wrapper"><Search size={16}/><input className="search-input" aria-label="ค้นหาครุภัณฑ์" placeholder="ค้นหาชื่อ เลขครุภัณฑ์ หรือเลขเครื่อง…" value={query} onChange={e => setQuery(e.target.value)}/></div><div className="heading-actions"><select className="select-input" aria-label="กรองหน่วยงาน" value={ward} onChange={e => setWard(e.target.value)}><option value="all">ทุกหน่วยงานในสิทธิ์</option>{wards.filter(w => scope.includes(w.id)).map(w => <option value={w.id} key={w.id}>{w.name}</option>)}</select><Button variant="secondary" disabled={!["warehouse", "procurement"].includes(role)} onClick={() => { setImportResult(null); setModal("import"); }}><Upload size={14}/>นำเข้า CSV</Button></div></div><div className="filter-pills section-gap">{["all", ...Object.keys(statusLabels)].map(s => <button className={`filter-pill ${status === s ? "active" : ""}`} key={s} onClick={() => setStatus(s)}>{s === "all" ? "ทั้งหมด" : statusLabels[s]}</button>)}</div><Card>{assetTable(filtered.slice(offset, offset + 10))}<div className="pagination"><span>แสดง {filtered.length ? offset + 1 : 0}–{Math.min(offset + 10, filtered.length)} จาก {filtered.length} รายการ</span><div className="heading-actions"><Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => setOffset(offset - 10)}>ก่อนหน้า</Button><Button variant="secondary" size="sm" disabled={offset + 10 >= filtered.length} onClick={() => setOffset(offset + 10)}>ถัดไป</Button></div></div></Card></>}

      {page === "sync" && <><div className="toolbar"><div><h2 className="panel-title">ศูนย์ควบคุมออฟไลน์</h2><p className="muted">{swReady ? "แคชหน้าเว็บพร้อมสำหรับเปิดซ้ำแบบออฟไลน์" : "กำลังเตรียมแคชหน้าเว็บ · ยังไม่รับรองเปิดซ้ำออฟไลน์"}</p></div><div className="heading-actions"><Button variant="secondary" onClick={() => setOffline(!offline)}>{offline ? <Wifi size={15}/> : <WifiOff size={15}/>} {offline ? "กลับออนไลน์จำลอง" : "จำลองออฟไลน์"}</Button><Button disabled={!editable || isOffline || !data.queue.length} onClick={syncQueue}><RefreshCw size={15}/>ซิงก์คิวของฉัน</Button></div></div><div className="split-grid"><Card><CardHeader><CardTitle>คำสั่งรอซิงก์ <span className="badge warning">{data.queue.length}</span></CardTitle></CardHeader><CardContent>{data.queue.length ? data.queue.map(item => <div className="queue-card" key={item.command.id}><div className="queue-header"><strong>{data.assets.find(a => a.id === item.command.assetId)?.assetNo}</strong><span className="badge warning">รอส่ง</span></div><div className="queue-body">เสนอเปลี่ยนเป็น {statusLabels[item.command.nextStatus]} · v{item.command.baseVersion}<br/><span className="muted">{item.actor.id} · {item.command.deviceId}</span></div></div>) : <div className="empty-state"><CheckCheck size={30}/><p>ไม่มีคำสั่งค้างในเครื่อง</p><small>เปิดโหมดออฟไลน์แล้วลองสแกนด้วยบทบาทคลัง</small></div>}<p className="muted">แต่ละคนซิงก์ได้เฉพาะคำสั่งของตนเอง · {data.lastSynced ? `ซิงก์ล่าสุด ${new Date(data.lastSynced).toLocaleString("th-TH")}` : "ยังไม่มีการซิงก์"}</p></CardContent></Card><Card><CardHeader><CardTitle>ข้อขัดแย้งที่ต้องตรวจสอบ <span className="badge danger">{data.conflicts.length}</span></CardTitle></CardHeader><CardContent>{data.conflicts.length ? data.conflicts.map(c => <div className="queue-card" key={c.id}><div className="queue-header"><strong>{data.assets.find(a => a.id === c.assetId)?.assetNo}</strong><span className="badge danger">รอผู้ตรวจ</span></div><div className="queue-body"><div className="stat-row"><span>ทะเบียนปัจจุบัน · v{c.currentVersion}</span><strong>{statusLabels[c.currentStatus]}</strong></div><div className="stat-row"><span>คำสั่งเก่า · v{c.baseVersion}</span><strong>{statusLabels[c.requestedStatus]}</strong></div><p className="muted">เก็บทั้งสองฝั่งเป็นหลักฐานแล้ว การตัดสินต้องตรวจของจริงและบันทึกคำสั่งใหม่โดยผู้มีอำนาจ</p></div></div>) : <div className="empty-state"><ShieldCheck size={30}/><p>ยังไม่มีข้อขัดแย้ง</p></div>}<Button variant="secondary" disabled={!editable || isOffline} onClick={simulateConflict}><Layers3 size={15}/>จำลองแท็บเล็ตสองเครื่องชนกัน</Button></CardContent></Card></div></>}

      {page === "finance" && <><div className="demo-banner"><FileText size={17}/><span>สถานะคำขอเบิกจ่ายแยกจาก PO · ทดลองส่งคืนด้วยบทบาทการเงิน แล้วแก้ไขส่งใหม่ด้วยบทบาทพัสดุ</span></div><Card><CardHeader><div><CardTitle>คำขอเบิกจ่ายและการติดตามบัญชี</CardTitle><p className="panel-subtitle">เปลี่ยนบทบาทจำลองด้านบนเพื่อทดลองแต่ละขั้นตอน</p></div></CardHeader><div className="table-wrap"><table className="data-table"><thead><tr><th>คำขอ / รายการ</th><th>PO</th><th>จำนวนเงิน</th><th>สถานะคำขอ</th><th>รุ่น</th><th>ดำเนินการ</th></tr></thead><tbody>{data.payments.map(p => <tr key={p.id}><td><strong>{p.claimNo}</strong><div className="muted">{p.title}</div></td><td>{p.poNo}<br/><span className="badge neutral">ปิด PO แล้ว</span></td><td>฿{money(p.amount)}</td><td><span className={`badge ${tone(p.status)}`}>{paymentLabels[p.status]}</span>{p.returnReason && <div className="muted">{p.returnReason}</div>}</td><td>r{p.revision}</td><td><Button variant="secondary" size="sm" onClick={() => { setPaymentId(p.id); setReason(""); setEvidence(false); setSignature(false); setModal("payment"); }}>ตรวจรายการ</Button></td></tr>)}</tbody></table></div></Card><div className="connection-card section-gap-top"><ShieldCheck size={22}/><h3>การลงบัญชีและค่าเสื่อม</h3><p className="muted">ต้นแบบแสดงมูลค่าจากราคาทุนและค่าเสื่อมจำลอง ยังไม่สร้างสมุดรายวันหรือส่งรายการไป GFMIS ระบบบริการมีสคีมารองรับสำหรับพัฒนาต่อ</p></div></>}

      {page === "procurement" && <LifecycleWorkspace/>}

      {page === "users" && <UserManagement users={data.users} departmentOptions={masterData.departments.map(d=>({id:d.id,name:d.name,status:d.status}))} actorRole={role} editable={editable} switchToAdmin={()=>setRole("admin")} onChange={async (users,action,staffCode)=>commit({...data,users,audit:[...data.audit,{sequence:data.audit.length+1,actorId:`demo-${role}`,deviceId:"tablet-A",assetId:staffCode,outcome:action,code:"DEMO_ONLY",beforeVersion:null,afterVersion:null}]})}/>}

      {(["document-codes","departments","vendors"] as string[]).includes(page) && <MasterDataManagement kind={page === "document-codes" ? "documents" : page === "departments" ? "departments" : "vendors"} state={masterData} actorRole={role} editable={editable} switchToAdmin={()=>setRole("admin")} onChange={async (masterData,event,code)=>commit({...data,masterData,audit:[...data.audit,{sequence:data.audit.length+1,actorId:`demo-${role}`,deviceId:"tablet-A",assetId:code,outcome:event,code:"DEMO_ONLY",beforeVersion:null,afterVersion:null}]})}/>}

      {page === "hospital" && <HospitalProfileManagement profile={data.hospitalProfile} actorRole={role} editable={editable} switchToAdmin={()=>setRole("admin")} onChange={async hospitalProfile=>commit({...data,hospitalProfile,audit:[...data.audit,{sequence:data.audit.length+1,actorId:`demo-${role}`,deviceId:"tablet-A",assetId:"HOSPITAL_PROFILE",outcome:"HOSPITAL_PROFILE_UPDATED",code:"DEMO_ONLY",beforeVersion:null,afterVersion:null}]})}/>}

      {page === "documents" && <><div className="demo-banner"><FileCheck2 size={17}/><span>ขั้นตอนหลักฐาน: ตรึงรุ่น → พิมพ์ → ลงหมึก → สแกน → ตรวจเทียบ → รับรองสำเนา · หน้านี้แสดงตัวอย่าง ยังไม่รับอัปโหลดหลักฐานจริง</span></div>{data.documents.map(d => <Card className="section-gap" key={d.id}><CardHeader><div><CardTitle>{d.title}</CardTitle><p className="panel-subtitle">{d.ref} · รุ่น {d.revision} · {d.poNo}</p></div><span className={`badge ${d.status === "SIGNED_COPY_VERIFIED" ? "success" : "warning"}`}>{d.status === "SIGNED_COPY_VERIFIED" ? "ตัวอย่างสำเนาตรวจแล้ว" : "รอลายเซ็นหมึก"}</span></CardHeader><CardContent><div className="detail-grid"><div><div className="detail-label">ตำแหน่งต้นฉบับกระดาษ</div><div className="detail-value">{d.location}</div></div><div><div className="detail-label">ความครบถ้วนของหลักฐาน</div><div className="detail-value">ต้องเก็บ PDF ต้นฉบับ / hash / สำเนาลงนามแยกกัน</div></div></div><p className="muted">ยังไม่มีไฟล์จริงในต้นแบบ · การเข้าสู่ระบบไม่เท่ากับการลงนามรับรองเอกสาร</p></CardContent></Card>)}</>}

      {page === "audit" && <><div className="toolbar"><p className="muted">ประวัติในเครื่องสำหรับทดลอง · ไม่ใช่คลัง audit แบบป้องกันแก้ไขของระบบจริง</p><Button variant="secondary" onClick={() => download("uth-audit-demo.csv", toCsv([["ลำดับ", "ผู้ทำรายการ", "รายการ", "เหตุการณ์", "รุ่นก่อน", "รุ่นหลัง"], ...data.audit.map(e => [e.sequence, e.actorId, e.assetId ?? "IMPORT", e.outcome, e.beforeVersion, e.afterVersion])]))}><ArrowDownToLine size={14}/>ส่งออกประวัติ</Button></div><Card><div className="table-wrap"><table className="data-table"><thead><tr><th>ลำดับ</th><th>ผู้ทำรายการ / อุปกรณ์</th><th>รายการ</th><th>เหตุการณ์</th><th>รุ่นข้อมูล</th></tr></thead><tbody>{[...data.audit].reverse().map(e => <tr key={e.sequence}><td>#{e.sequence}</td><td>{e.actorId}<br/><small>{e.deviceId}</small></td><td>{data.assets.find(a => a.id === e.assetId)?.assetNo ?? e.assetId ?? "นำเข้าข้อมูล"}</td><td><span className={`badge ${e.outcome === "CONFLICT" ? "danger" : "info"}`}>{e.outcome}</span><div className="muted">{e.code}</div></td><td>{e.beforeVersion ?? "—"} → {e.afterVersion ?? "—"}</td></tr>)}</tbody></table></div></Card></>}

      {page === "integrations" && <><div className="split-grid">{[{ name: "HOSxP", icon: Building2, text: "ยังไม่เชื่อมต่อ · ตัวเชื่อมต้องใช้สำเนาข้อมูลอ่านอย่างเดียวและสิทธิ์ที่โรงพยาบาล/BMS อนุญาต" }, { name: "MOPH Provider ID", icon: ShieldCheck, text: "ยังไม่เชื่อมต่อ · ตัวเลือกบทบาทในหน้านี้เป็นการจำลอง ไม่ใช่การเข้าสู่ระบบหรือหลักฐาน 2FA" }, { name: "Aruba BLE / IoT", icon: Wifi, text: "ยังไม่เชื่อมต่อ · รับ telemetry ผ่าน AP/Gateway แล้วเข้าคิว ไม่แก้ผู้ครอบครองจากสัญญาณโดยตรง" }, { name: "Node.js / Prisma / MySQL", icon: Layers3, text: "มีซอร์สบริการและสคีมาแยกไว้ · หน้านี้ใช้ IndexedDB ในเบราว์เซอร์ ยังไม่เชื่อมฐานข้อมูลโรงพยาบาล" }].map(c => <div className="connection-card" key={c.name}><div className="connection-title"><c.icon size={24}/><span className="badge neutral">ยังไม่เชื่อม</span></div><h3>{c.name}</h3><p className="muted">{c.text}</p></div>)}</div><Card><CardHeader><CardTitle>เครื่องมือพื้นที่ทดลอง</CardTitle></CardHeader><CardContent><div className="toolbar"><span className="muted">ล้างเฉพาะข้อมูลจำลองในเบราว์เซอร์นี้ เพื่อเริ่มทดลองใหม่</span><Button variant="secondary" disabled={!editable} onClick={() => setModal("reset")}>รีเซ็ตข้อมูลจำลอง</Button></div><p className="muted">การนำเข้ารองรับ CSV ในรุ่นนี้ · OCR, Excel .xlsx, RFID และการตรวจรับรองข้อขัดแย้งโดยหัวหน้าคลังยังต้องพัฒนาต่อ</p></CardContent></Card></>}
      </main>
    </div>

    {selected && <Modal title="รายละเอียดครุภัณฑ์" close={() => setSelected(null)} footer={<Button onClick={() => { setScan(selected.assetNo); setScanned(selected); setNextStatus(selected.status === "AVAILABLE" ? "IN_USE" : "REPAIR"); setSelected(null); setModal("scan"); }}>ทำรายการสแกน <ArrowRight size={15}/></Button>}><div className="detail-hero"><span className="detail-asset-icon"><HeartPulse size={30}/></span><div><h3>{selected.name}</h3><p>{selected.assetNo}</p></div><span className={`badge ${tone(selected.status)}`}>{statusLabels[selected.status]}</span></div><div className="detail-grid">{[["เลขเครื่อง", selected.serialNo], ["หน่วยงาน", wardName(selected.wardId)], ["ราคาทุน", `฿${money(selected.cost)}`], ["มูลค่าตามบัญชี", `฿${money(selected.cost - selected.depreciation)}`], ["เอกสารจัดซื้อ", selected.poNo], ["รุ่นข้อมูล", `v${selected.version}`], ["ผลตรวจนับ", selected.verified ? "ตัวอย่างตรวจแล้ว" : "ยังไม่ตรวจ"], ["แหล่งข้อมูล", "ทะเบียนจำลองในเบราว์เซอร์"]].map(([l, v]) => <div key={l}><div className="detail-label">{l}</div><div className="detail-value">{v}</div></div>)}</div><p className="muted">ไม่เก็บหรือแสดงข้อมูลผู้ป่วย</p></Modal>}

    {modal === "scan" && <Modal title="สแกนและทำรายการ" close={() => setModal(null)} footer={scanned ? <><Button variant="secondary" onClick={() => setScanned(null)}>สแกนใหม่</Button><Button disabled={!editable || !["warehouse", "nurse"].includes(role)} onClick={submitScan}>{isOffline ? "เก็บคำสั่งรอซิงก์" : "ยืนยันรายการจำลอง"}</Button></> : undefined}>{!scanned ? <><div className="scan-preview"><div className="scan-frame"><QrCode size={78}/><div className="scan-line"/></div><small>รับรหัสจากเครื่องสแกน USB/Bluetooth หรือกรอกด้านล่าง</small></div><form onSubmit={e => { e.preventDefault(); findScan(); }}><label className="form-field">รหัสครุภัณฑ์<input value={scan} onChange={e => setScan(e.target.value)} placeholder="UTH-69-00001" autoComplete="off" maxLength={80}/></label><div className="heading-actions"><Button type="submit"><Search size={15}/>ค้นหารหัส</Button><Button type="button" variant="secondary" onClick={() => findScan("UTH-69-00001")}>ลองรหัสตัวอย่าง</Button></div></form><p className="muted">รุ่นนี้รองรับเครื่องอ่านรหัสและการกรอก ยังไม่เปิดกล้องอ่าน QR</p></> : <><div className="detail-hero"><span className="detail-asset-icon"><HeartPulse size={28}/></span><div><h3>{scanned.name}</h3><p>{scanned.assetNo} · {scanned.serialNo}</p></div></div><div className="detail-grid"><div><div className="detail-label">หน่วยงานจากทะเบียนจำลอง</div><div className="detail-value">{wardName(scanned.wardId)}</div></div><div><div className="detail-label">สถานะ / รุ่น</div><div className="detail-value">{statusLabels[scanned.status]} · v{scanned.version}</div></div></div><label className="form-field">รายการที่ต้องการ<select value={nextStatus} onChange={e => setNextStatus(e.target.value)}><option value="IN_USE">รับใช้งาน</option><option value="AVAILABLE">คืน / พร้อมใช้</option><option value="REPAIR">แจ้งชำรุด / ส่งซ่อม</option><option value="QUARANTINED">กักใช้งาน / รอตรวจรับรอง</option></select></label>{!["warehouse", "nurse"].includes(role) && <p className="warning-text">เลือกมุมมองจำลอง “เจ้าหน้าที่คลัง” หรือ “พยาบาล” ด้านบนก่อนทำรายการ</p>}<p className="muted">อ้างอิงรุ่นขณะสแกน หากมีการแก้ไขก่อนยืนยัน ระบบจะตรวจเป็นข้อขัดแย้ง</p></>}</Modal>}

    {modal === "import" && <Modal title="นำเข้าทะเบียนจาก CSV" close={() => setModal(null)} footer={<Button disabled={!editable || !importResult?.valid.length || !!importResult?.errors.length} onClick={confirmImport}>ยืนยันนำเข้าพื้นที่รอตรวจ</Button>}><p className="muted">รองรับครั้งละ 1–500 แถว ขนาดไม่เกิน 1 MB · ตรวจทุกแถวก่อนนำเข้า ไม่รับไฟล์ .xlsx ในรุ่นนี้</p><Button variant="secondary" onClick={() => download("uth-asset-template.csv", toCsv([["assetNo", "name", "serialNo", "wardId", "category", "cost"], ["UTH-69-00901", "เครื่องควบคุมสารน้ำ", "SN-DEMO-901", "ICU", "เครื่องควบคุมสารน้ำ", 48000]]))}><ArrowDownToLine size={15}/>ดาวน์โหลดแม่แบบ</Button><label className="form-field section-gap-top">เลือกไฟล์ CSV<input type="file" accept=".csv,text/csv" onChange={e => { setImportResult(null); void importCsv(e.target.files?.[0]); }}/></label>{importResult && <><p>ผ่านการตรวจ {importResult.valid.length} แถว · ผิดพลาด {importResult.errors.length} แถว</p>{importResult.errors.map((e, i) => <p className="warning-text" key={i}>{e}</p>)}{importResult.valid.slice(0, 5).map(r => <div className="stat-row" key={r.assetNo}><span>{r.assetNo} · {r.name}</span><strong>฿{money(r.cost)}</strong></div>)}<p className="muted">รายการใหม่จะอยู่สถานะ “รอตรวจรับรอง” และยังไม่ถือเป็นการตรวจรับทางราชการ</p></>}</Modal>}

    {modal === "payment" && payment && <Modal title={`${payment.claimNo} · รุ่น ${payment.revision}`} close={() => setModal(null)} footer={<>{payment.status === "SUBMITTED" && role === "finance" && <><Button variant="secondary" disabled={!editable || isOffline || !reason.trim()} onClick={() => paymentAction("RETURN")}>ส่งคืนแก้ไข</Button><Button disabled={!editable || isOffline || !evidence || !signature} onClick={() => paymentAction("APPROVE")}>อนุมัติจำลอง</Button></>}{payment.status === "RETURNED" && role === "procurement" && <Button disabled={!editable || isOffline} onClick={() => paymentAction("RESUBMIT")}>สร้างรุ่นใหม่และส่งตรวจ</Button>}</>}><h3>{payment.title}</h3><div className="stat-row"><span>สถานะจัดซื้อ</span><span className="badge neutral">{payment.poNo} · CLOSED</span></div><div className="stat-row"><span>สถานะคำขอ</span><span className={`badge ${tone(payment.status)}`}>{paymentLabels[payment.status]}</span></div><div className="stat-row"><span>จำนวนเงิน</span><strong>฿{money(payment.amount)}</strong></div>{payment.returnReason && <p className="warning-text">เหตุผลส่งคืน: {payment.returnReason}</p>}{payment.status === "SUBMITTED" && role === "finance" && <><label className="form-field section-gap-top">เหตุผลส่งคืน<textarea rows={3} value={reason} maxLength={2000} onChange={e => setReason(e.target.value)} placeholder="เช่น ใบแจ้งหนี้ไม่ตรงกับเอกสารตรวจรับ"/></label><label className="checkbox-row"><input type="checkbox" checked={evidence} onChange={e => setEvidence(e.target.checked)}/>จำลองผลตรวจหลักฐานครบถ้วน</label><label className="checkbox-row"><input type="checkbox" checked={signature} onChange={e => setSignature(e.target.checked)}/>จำลองผลตรวจลายเซ็นและผู้มีอำนาจ</label></>}{payment.history?.length > 0 && <p className="muted">คงสำเนารุ่นเดิมไว้ {payment.history.length} รุ่นในข้อมูลสาธิต</p>}<p className="muted">การติ๊กช่องเป็นการจำลองเท่านั้น ระบบจริงต้องตรวจหลักฐานที่เซิร์ฟเวอร์และยืนยันตัวตนตามอำนาจอนุมัติ</p>{!["finance", "procurement"].includes(role) && <p className="warning-text">เปลี่ยนมุมมองเป็นการเงินหรือพัสดุเพื่อทดลองขั้นตอน</p>}</Modal>}

    {modal === "help" && <Modal title="เริ่มทดลองใน 3 นาที" close={() => setModal(null)} footer={<Button onClick={() => { setRole("warehouse"); setModal(null); go("sync"); }}>เริ่มที่คิวออฟไลน์ <ArrowRight size={15}/></Button>}><ol className="help-steps"><li><strong>เลือกบทบาทเจ้าหน้าที่คลัง</strong><p>ใช้ตัวเลือกมุมมองจำลองมุมขวาบน</p></li><li><strong>ทดลองสแกนและออฟไลน์</strong><p>หน้า “คิวซิงก์” → จำลองออฟไลน์ → สแกน → ลองรหัสตัวอย่าง → ยืนยัน จากนั้นกลับออนไลน์และซิงก์</p></li><li><strong>ลองข้อมูลขัดแย้ง</strong><p>กด “จำลองแท็บเล็ตสองเครื่องชนกัน” แล้วดูทั้งสองสถานะและรุ่นข้อมูล</p></li><li><strong>ลองการเงินส่งคืนหลังปิด PO</strong><p>เลือกบทบาทการเงิน → ตรวจรายการแรก → ใส่เหตุผลส่งคืน จากนั้นเปลี่ยนเป็นพัสดุเพื่อสร้างคำขอรุ่นใหม่</p></li></ol><p className="muted">ข้อมูลเก็บใน IndexedDB ของเบราว์เซอร์ ไม่ส่งไปฐานข้อมูลโรงพยาบาล รีเซ็ตได้จากหน้าการเชื่อมต่อ</p></Modal>}
    {modal === "reset" && <Modal title="เริ่มข้อมูลจำลองใหม่" close={() => setModal(null)} footer={<><Button variant="secondary" onClick={() => setModal(null)}>ยกเลิก</Button><Button disabled={!editable} onClick={async () => { if (await commit(createSeed())) { setModal(null); notify("รีเซ็ตเฉพาะข้อมูลจำลองแล้ว"); } }}>ยืนยันรีเซ็ต</Button></>}><p>คำสั่งออฟไลน์ ประวัติ และรายการนำเข้าในเบราว์เซอร์นี้จะถูกแทนด้วยชุดข้อมูลตัวอย่างเริ่มต้น</p></Modal>}
    {toast && <div role="status" className={`toast ${toast.error ? "toast-error" : "toast-success"}`}>{toast.message}</div>}
  </div>;
}
