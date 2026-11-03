"use client";

import {ExecutiveDashboard} from "@/components/executive-dashboard";
import type {ExecutiveDepartment} from "@/lib/executive-dashboard";

import { DepartmentNavigation } from "@/components/department-navigation";
import { ProcurementFlowWorkspace } from "@/components/procurement-flow-workspace";
import { transitionFlow, emptyFlow, type FlowCommand, type FlowState } from "@/lib/procurement-flow";
import { workspaceItems } from "@/lib/workspace-menu";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Activity, ArrowDownToLine, ArrowRight, ArrowUpRight, Bell, Box, Building2, BookOpen, ChartNoAxesCombined, Check, CheckCheck, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, CircleHelp, ClipboardCheck, ClipboardList, FileCheck2, FileText, FolderClock, HeartPulse, History, Layers3, Menu, PanelLeftClose, PanelLeftOpen, MoreHorizontal, Package, Plus, QrCode, RefreshCw, Search, Settings2, ShieldCheck, Upload, Wallet, Wifi, WifiOff, X } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LegacyExcelImport, type ImportSource } from "@/components/legacy-excel-import";
import { AssetCatalogWorkspace } from "@/components/asset-catalog-workspace";
import { OpsDepreciationReference } from "@/components/ops-depreciation-reference";
import { AssetNumberingWorkspace } from "@/components/asset-numbering-workspace";
import { parseAssetNumber } from "@/lib/asset-numbering";
import { RegulatoryWorkspace, RegulatoryNotice } from "@/components/regulatory-workspace";
import { referencePages, departmentNames, type ReferencePage, type DepartmentKey } from "@/lib/regulatory";
import { PlanningWorkspace, planningSections, type PlanningPage } from "@/components/planning-workspace";
import { SystemLogViewer } from "@/components/system-log-viewer";
import { SystemActivityContext } from "@/components/system-activity";
import type { Activity as SystemActivity, LogContext } from "@/lib/system-log";
import { LifecycleWorkspace } from "@/components/lifecycle-workspace";
import { UserManagement } from "@/components/user-management";
import { MasterDataManagement, HospitalProfileManagement } from "@/components/master-data-management";
import { createMasterData } from "@/lib/master-data.mjs";
import { AuthUserChip } from "@/components/auth-user-chip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { categories, createSeed, HOSPITAL, paymentLabels, roles, statusLabels, wards, type Asset, type DemoState } from "@/lib/seed";
import { loadState, saveState, appendSystemActivity, initializeSystemLog, type PlanningFileWrite } from "@/lib/storage";
import { transitionAsset, transitionPayment } from "@/lib/domain.mjs";
import { parseAssetCsv, toCsv } from "@/lib/csv.mjs";

const navGroups = ["settings","reports","finance","planning","procurement","accounting","legal"] as const;
type NavGroup = typeof navGroups[number];
type Page = `ops-${string}` | `pending-${string}` | "asset-catalog" | "asset-numbering" | ReferencePage | PlanningPage | "dashboard" | "assets" | "procurement" | "documents" | "sync" | "audit" | "integrations" | "users" | "document-codes" | "departments" | "hospital" | "vendors" | "reports" | "reports-strategy" | "reports-procurement" | "reports-finance" | "reports-accounting" | "reports-legal" | "work-strategy" | "work-procurement" | "work-finance" | "work-accounting" | "work-legal" | "finance-payments";
const nav = [
  { id: "dashboard", label: "ภาพรวมผู้บริหาร", icon: ChartNoAxesCombined },
  { id: "assets", label: "ทะเบียนครุภัณฑ์", icon: Box },
  { id: "procurement", label: "วงจรพัสดุ 15 ขั้นตอน", icon: ClipboardList },
  { id: "documents", label: "เอกสารและหลักฐาน", icon: FileCheck2 },
  { id: "sync", label: "คิวซิงก์และข้อขัดแย้ง", icon: RefreshCw },
  { id: "audit", label: "Log system", icon: History },
  { id: "integrations", label: "การเชื่อมต่อระบบ", icon: Settings2 },
  { id: "reports", label: "รายงาน", icon: FileText },
  { id: "hospital", label: "ข้อมูลโรงพยาบาล", icon: HeartPulse },
  { id: "document-codes", label: "จัดการรหัสคุมเอกสาร", icon: FileText },
  { id: "departments", label: "จัดการแผนก/ฝ่าย", icon: Building2 },
  { id: "users", label: "จัดการผู้ใช้งาน", icon: ShieldCheck },
  { id: "vendors", label: "จัดการผู้ค้ากับโรงพยาบาล", icon: Package }
] as const;
const settingsPages: readonly string[] = ["hospital", "document-codes", "departments", "users", "vendors", "integrations", "audit"];
const reportSections = [
  { id: "reports-strategy", label: "ฝ่ายแผนงานและยุทธศาสตร์" },
  { id: "reports-procurement", label: "ฝ่ายพัสดุกลาง" },
  { id: "reports-finance", label: "ฝ่ายการเงิน" },
  { id: "reports-accounting", label: "ฝ่ายบัญชี" },
  { id: "reports-legal", label: "ฝ่ายนิติกร" }
] as const;
const workspaceSections = [
  { id: "work-strategy", label: "ฝ่ายแผนงานและยุทธศาสตร์", icon: ChartNoAxesCombined },
  { id: "work-procurement", label: "ฝ่ายพัสดุกลาง", icon: Package },
  { id: "work-finance", label: "ฝ่ายการเงิน", icon: Wallet },
  { id: "work-accounting", label: "ฝ่ายบัญชี", icon: ClipboardList },
  { id: "work-legal", label: "ฝ่ายนิติกร", icon: ShieldCheck }
] as const;
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
  const [dashboardTarget,setDashboardTarget]=useState("");
  const [role, setRole] = useState("executive");
  const [sessionId] = useState(uid);
  const priorRole = useRef("executive");
  const [offline, setOffline] = useState(false);
  const [networkOnline, setNetworkOnline] = useState(true);
  const [menu, setMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(()=>{try{setSidebarCollapsed(localStorage.getItem("uth-sidebar-collapsed")==="true");}catch{}},[]);
  function resizeSidebar(collapsed:boolean){setSidebarCollapsed(collapsed);setOpenNav([]);try{localStorage.setItem("uth-sidebar-collapsed",String(collapsed));}catch{}void reportActivity({action:"SIDEBAR_RESIZED",module:"appearance",outcome:"OBSERVED",after:{collapsed}});}
  const [openNav, setOpenNav] = useState<NavGroup[]>([]);
  const accountingOpen = openNav.includes("accounting");
  const settingsOpen = openNav.includes("settings"), reportsOpen = openNav.includes("reports"), financeOpen = openNav.includes("finance"), planningOpen = openNav.includes("planning"), procurementOpen = openNav.includes("procurement");
  function toggleNav(group: NavGroup) { if(sidebarCollapsed){resizeSidebar(false);setOpenNav([group]);}else setOpenNav(current => current.includes(group) ? current.filter(item=>item!==group) : [...current,group]); }
  function expandAllNav(){if(sidebarCollapsed)resizeSidebar(false);setOpenNav([...navGroups]);void reportActivity({action:"NAV_EXPAND_ALL",module:"appearance",outcome:"OBSERVED"});}
  function collapseAllNav(){setOpenNav([]);void reportActivity({action:"NAV_COLLAPSE_ALL",module:"appearance",outcome:"OBSERVED"});}
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
  const [legacyImportReference,setLegacyImportReference]=useState("");
  const [legacyImportVerified,setLegacyImportVerified]=useState(false);
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
  const flowDocVersionRef = useRef<number | null>(null);
  const importGeneration = useRef(0);
  const importedSource = useRef("");
  const selectedReportSection = reportSections.find(n => n.id === page);
  const selectedWorkspaceSection = workspaceSections.find(n => n.id === page);
  const selectedPlanningSection = planningSections.find(n=>n.id===page);
  const selectedReference=referencePages.find(r=>r.id===page);
  const activeDepartment:DepartmentKey|null=selectedPlanningSection?"planning":["work-procurement","assets","procurement","documents","asset-numbering","asset-catalog"].includes(page)?"procurement":["finance-payments","work-finance"].includes(page)?"finance":page==="work-accounting"?"accounting":null;
  const selectedWorkspaceItem=workspaceItems.find(i=>i.id===page);
  const title = selectedWorkspaceItem?.label ?? (page==="asset-catalog"?"บัญชีรหัสครุภัณฑ์จากคู่มือ":page==="asset-numbering"?"ตรวจรับและออกเลขครุภัณฑ์":selectedReference?`กฎหมายและข้อกำหนด · ${departmentNames[selectedReference.department]}`:selectedPlanningSection?.label ?? (page === "finance-payments" ? "คำขอเบิกจ่าย" : selectedWorkspaceSection?.label ?? (selectedReportSection ? `รายงาน · ${selectedReportSection.label}` : nav.find(n => n.id === page)?.label)));
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
  const bookValue = scopedAssets.reduce((sum, a) => sum + (a.status === "DISPOSED" || a.accountingPending ? 0 : a.cost - a.depreciation), 0);
  const pendingPayments = data.payments.filter(p => p.overdue && !["PAID", "APPROVED"].includes(p.status)).length;
  const payment = data.payments.find(p => p.id === paymentId);

  const logContext:LogContext={actorId:actor.id,role,sessionId,deviceId:actor.deviceId,page};
  async function reportActivity(activity:SystemActivity){try{await appendSystemActivity(logContext,activity);return true;}catch{setToast({message:"บันทึก Log ไม่สำเร็จ กรุณาลองใหม่",error:true});return false;}}
  function notify(message: string, error = false) { setToast({ message, error }); if(error)void reportActivity({action:"OPERATION_REJECTED",outcome:"REJECTED",reason:message}); }
  async function commit(next: DemoState, file?: PlanningFileWrite, operation?:SystemActivity) {
    if (!editable || writingRef.current || data !== stateRef.current) { notify("มีรายการกำลังบันทึก กรุณารอแล้วลองอีกครั้ง", true); return false; }
    writingRef.current = true;
    setBusy(true);
    try { await saveState(next, file, logContext, operation); stateRef.current = next; setData(next); return true; }
    catch { setStorageError(true); notify("บันทึกในเครื่องไม่สำเร็จ รายการยังไม่ถูกยืนยัน", true); return false; }
    finally { writingRef.current = false; setBusy(false); }
  }

  async function fetchServerFlow(): Promise<{ data: FlowState; version: number } | null> {
    try {
      const response = await fetch(`/api/flows/state?hospitalId=${encodeURIComponent(HOSPITAL)}`, { cache: "no-store" });
      if (!response.ok) return null;
      const payload = await response.json();
      const parsed = payload?.data ?? payload;
      if (!parsed?.revision && !parsed?.cases) return null;
      return { data: parsed as FlowState, version: Number(payload?.version ?? parsed.revision ?? 0) };
    } catch { return null; }
  }

  async function persistFlowToServer(flow: FlowState): Promise<"ok" | "conflict" | "error"> {
    const body: Record<string, unknown> = { hospitalId: HOSPITAL, flow };
    if (flowDocVersionRef.current !== null) body.expectedVersion = flowDocVersionRef.current;
    try {
      const response = await fetch("/api/flows/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        const payload = await response.json().catch(() => ({}));
        flowDocVersionRef.current = Number(payload?.version ?? flow.revision ?? flowDocVersionRef.current);
        return "ok";
      }
      if (response.status === 409) return "conflict";
      notify("บันทึกข้อมูลไหลงานบนเซิร์ฟเวอร์ไม่สำเร็จ รายการยังไม่ถูกยืนยัน", true);
      return "error";
    } catch {
      notify("บันทึกข้อมูลไหลงานบนเซิร์ฟเวอร์ไม่สำเร็จ รายการยังไม่ถูกยืนยัน", true);
      return "error";
    }
  }

  async function resetFlowOnServer(): Promise<boolean> {
    if (!data.procurementFlow) return true;
    const resetFlow = { ...emptyFlow(), counters: data.procurementFlow.counters };
    const result = await persistFlowToServer(resetFlow);
    if (result === "conflict") { notify("ข้อมูลไหลงานถูกแก้ไขระหว่างรีเซ็ต กรุณาลองใหม่อีกครั้ง", true); return false; }
    if (result === "error") return false;
    return true;
  }

  useEffect(() => {
    let cancelled = false;
    let releaseLock: (() => void) | undefined;
    loadState().then(async value => { await initializeSystemLog(value,logContext);await appendSystemActivity(logContext,{action:"APP_OPEN",module:"session",outcome:"OBSERVED"}); if (cancelled) return; const server = await fetchServerFlow(); if (cancelled) return; if (server) { value.procurementFlow = server.data; flowDocVersionRef.current = server.version; } stateRef.current = value; setData(value); setReady(true); }).catch(() => { setStorageError(true); setReady(true); });
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
  useEffect(()=>{if(ready&&priorRole.current!==role){void reportActivity({action:"DEMO_ROLE_CHANGED",module:"session",outcome:"OBSERVED",before:{role:priorRole.current},after:{role}});priorRole.current=role;}},[role,ready]);
  function go(next: Page) { void reportActivity({action:"VIEW_PAGE",module:"navigation",target:next,outcome:"OBSERVED",before:{page},after:{page:next}});setOpenNav([]);setPage(next); setMenu(false); setQuery(""); setWard("all"); setStatus("all"); window.scrollTo({ top: 0 }); }
  async function download(name: string, contents: string, mime = "text/csv;charset=utf-8") {
    if(!await reportActivity({action:"EXPORT_FILE",module:"reports",target:name,after:{mime}}))return false;
    const url = URL.createObjectURL(new Blob([contents], { type: mime }));
    const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportAssets() {
    download("uth-assets-demo.csv", toCsv([["เลขครุภัณฑ์", "รายการ", "หน่วยงาน", "สถานะ", "ราคาทุน", "รุ่นข้อมูล"], ...filtered.map(a => [a.assetNo, a.name, wardName(a.wardId), statusLabels[a.status], a.cost, a.version])]));
    notify("ส่งออกรายการตามตัวกรองแล้ว · ข้อมูลจำลอง");
  }
  function findScan(value = scan) {
    const cleaned = value.replace(/[\r\n]+$/, "");
    if (!/^UTH-\d{2}-\d{5}$/i.test(cleaned) && !parseAssetNumber(cleaned)) { notify("รหัสไม่ถูกต้อง เช่น UTH-69-00001", true); return; }
    const scannedNumber=parseAssetNumber(cleaned);
    const asset = scopedAssets.find(a => {const stored=parseAssetNumber(a.assetNo);return a.assetNo.toUpperCase()===cleaned.toUpperCase()||!!(stored&&scannedNumber&&stored.prefix===scannedNumber.prefix&&stored.sequence===scannedNumber.sequence&&stored.yearSuffix===scannedNumber.yearSuffix);});
    if (!asset) { notify("ไม่พบทะเบียนในขอบเขตที่ได้รับสิทธิ์", true); return; }
    void reportActivity({action:"SCAN_LOOKUP",module:"assets",target:asset.assetNo,outcome:"OBSERVED"});setScan(cleaned); setScanned(asset); setNextStatus(asset.status === "AVAILABLE" ? "IN_USE" : "REPAIR");
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
    try { const source = await file.text(); if (generation !== importGeneration.current) return; importedSource.current = source; const result=parseAssetCsv(source, data.assets.map(a => a.assetNo), scope);await reportActivity({action:"VALIDATE_IMPORT",module:"assets",target:file.name,outcome:result.errors.length?"REJECTED":"SUCCESS",after:{valid:result.valid.length,errors:result.errors}});setImportResult(result); }
    catch (error) { notify(error instanceof Error ? error.message : "อ่านไฟล์ไม่สำเร็จ", true); }
  }
  async function confirmImport() {
    if(!legacyImportReference.trim()||!legacyImportVerified){notify("ต้องยืนยันว่าเป็นทะเบียนเดิมพร้อมระบุหลักฐานต้นทาง",true);return;}
    if (!importResult || importResult.errors.length || !["warehouse", "procurement"].includes(role)) return;
    const checked = parseAssetCsv(importedSource.current, data.assets.map(a => a.assetNo), scope);
    if (checked.errors.length) { setImportResult(checked); return; }
    const added = checked.valid.map((row: any) => ({ ...row, id: uid(), hospitalId: HOSPITAL, status: "QUARANTINED", version: 0, depreciation: 0, accountingPending:true, legacySourceRef:legacyImportReference, verified: false, poNo: "รอผูกเอกสาร", critical: true }));
    if (await commit({ ...data, assets: [...data.assets, ...added], audit: [...data.audit, { sequence: data.audit.length + 1, actorId: actor.id, deviceId: actor.deviceId, outcome: "IMPORT_STAGED", code: `${added.length}_ROWS`, beforeVersion: null, afterVersion: null }] })) {
      setModal(null); notify(`นำเข้า ${added.length} รายการในสถานะรอตรวจรับรองแล้ว`);
    }
  }
  async function importLegacyRecords(rows:any[],source:ImportSource){
    if(!editable||isOffline||!["warehouse","procurement"].includes(role))return false;
    if(data.importBatches?.some(batch=>batch.sha256===source.sha256&&batch.sheet===source.sheet)){notify("ไฟล์และชีตนี้เคยนำเข้าแล้ว กรุณาตรวจประวัติ",true);return false;}
    const checked=parseAssetCsv(toCsv([["assetNo","name","serialNo","wardId","category","cost"],...rows.map(row=>[row.assetNo,row.name,row.serialNo,row.wardId,row.category,row.cost])]),data.assets.map(a=>a.assetNo),scope);
    if(checked.errors.length||checked.valid.length!==rows.length){notify("ข้อมูลเปลี่ยนหรือมีเลขซ้ำ กรุณาตรวจนำเข้าใหม่",true);return false;}
    const importId=uid(),added=checked.valid.map((row:any,index:number)=>({...row,id:uid(),hospitalId:HOSPITAL,status:"QUARANTINED",version:0,depreciation:0,accountingPending:true,verified:false,poNo:"รอผูกเอกสาร",critical:false,sourceImportId:importId,sourceRow:rows[index].sourceRow,sourceFile:source.fileName,sourceSheet:source.sheet,legacySourceRef:source.reference}));
    const saved=await commit({...data,assets:[...data.assets,...added],importBatches:[...(data.importBatches??[]),{id:importId,...source,count:added.length,at:new Date().toISOString(),actorId:actor.id}]},undefined,{action:"IMPORT_LEGACY_ASSETS",module:"asset-import",target:importId,after:{...source,count:added.length}});if(saved)notify(`นำเข้าทะเบียนเดิม ${added.length} รายการแล้ว · รอรับรองข้อมูลบัญชี`);return saved;
  }
  async function runFlow(command:FlowCommand,file?:PlanningFileWrite){
    if(!editable||isOffline)return false;
    if(writingRef.current||data!==stateRef.current){notify("มีรายการกำลังบันทึก กรุณารอแล้วลองอีกครั้ง",true);return false;}
    const actorCtx={id:actor.id,role,hospitalId:HOSPITAL,online:!isOffline};
    writingRef.current=true;setBusy(true);
    try{
      let next=transitionFlow({...data,masterData},command,actorCtx,(data.procurementFlow??emptyFlow()).revision);
      for(let attempt=0;attempt<2;attempt++){
        const server=await persistFlowToServer(next.data.procurementFlow??emptyFlow());
        if(server==="conflict"){const latest=await fetchServerFlow();if(!latest){notify("โหลดข้อมูลล่าสุดไม่สำเร็จ กรุณาเชื่อมต่อแล้วลองใหม่อีกครั้ง",true);return false;}next=transitionFlow({...data,masterData,procurementFlow:latest.data},command,actorCtx,latest.data.revision);continue;}
        if(server==="error")return false;
        let localOk=true;
        try{await saveState(next.data,file,logContext,{action:command.type,module:"procurement-flow",target:next.target});}catch{localOk=false;}
        stateRef.current=next.data;setData(next.data);
        if(!localOk)notify("บันทึกไหลงานแล้ว แต่แคชในเครื่องล้มเหลว",true);
        return true;
      }
      notify("ข้อมูลไหลงานถูกแก้ไขระหว่างบันทึก กรุณาลองใหม่อีกครั้ง",true);return false;
    }catch(error){const reason=error instanceof Error?error.message:"Cannot save";notify(reason,true);await reportActivity({action:command.type,module:"procurement-flow",outcome:"REJECTED",reason});return false;}
    finally{writingRef.current=false;setBusy(false);}
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
    return <div className="table-wrap"><table className="data-table"><thead><tr><th>รายการครุภัณฑ์</th><th>หน่วยงาน</th><th>สถานะ</th>{!compact && <th>มูลค่าตามบัญชี</th>}<th>รุ่นข้อมูล</th><th><span className="sr-only">รายละเอียด</span></th></tr></thead><tbody>{rows.map(a => <tr key={a.id}><td><button className="table-link asset-name" onClick={() => {void reportActivity({action:"VIEW_ASSET",module:"assets",target:a.assetNo,outcome:"OBSERVED"});setSelected(a);}}><span className="asset-icon"><HeartPulse size={16}/></span><span>{a.name}<small>{a.assetNo} · {a.serialNo}</small></span></button></td><td>{wardName(a.wardId)}</td><td><span className={`badge ${tone(a.status)}`}><span className="status-dot"/>{statusLabels[a.status]}</span></td>{!compact && <td>{a.accountingPending?"รอรับรองบัญชี":`฿${money(a.cost - a.depreciation)}`}</td>}<td><span className="version-tag">v{a.version}</span></td><td><button className="table-link" aria-label={`ดู ${a.assetNo}`} onClick={() => setSelected(a)}><ChevronRight size={17}/></button></td></tr>)}</tbody></table>{!rows.length && <div className="empty-state"><Search size={28}/><p>ไม่พบรายการตามเงื่อนไขนี้</p></div>}</div>;
  }

  return <SystemActivityContext.Provider value={reportActivity}><div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
    {menu && <button className="sidebar-overlay" onClick={() => setMenu(false)} aria-label="ปิดเมนู"/>}
    <aside id="main-sidebar" aria-label="แถบเมนู" className={`sidebar ${menu ? "open" : ""}`}><div className="sidebar-controls"><button type="button" className="sidebar-toggle" aria-label={sidebarCollapsed?"ขยายแถบเมนู":"หดแถบเมนู"} title={sidebarCollapsed?"ขยายแถบเมนู":"หดแถบเมนู"} aria-expanded={!sidebarCollapsed} aria-controls="main-sidebar" onClick={()=>resizeSidebar(!sidebarCollapsed)}>{sidebarCollapsed?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>}</button><button type="button" className="sidebar-mobile-close" aria-label="ปิดแถบเมนู" onClick={()=>setMenu(false)}><X size={18}/></button></div><div className="brand"><div className="brand-icon"><Layers3 size={25}/></div><div className="brand-copy"><strong>UTH Smart Assets</strong><small>โรงพยาบาลอุดรธานี</small></div></div>
      <div className="workspace-label"><Building2 size={15}/><span>ศูนย์บริหารครุภัณฑ์</span><ChevronDown size={13}/></div>
      <div className="sidebar-bulk-controls" role="group" aria-label="จัดการเมนูย่อยทั้งหมด"><button type="button" aria-label="ขยายเมนูทั้งหมด" title="ขยายเมนูทั้งหมด" disabled={!sidebarCollapsed && openNav.length===navGroups.length} onClick={expandAllNav}><ChevronsUpDown size={15}/><span>ขยายทั้งหมด</span></button><button type="button" aria-label="พับเมนูทั้งหมด" title="พับเมนูทั้งหมด" disabled={!openNav.length} onClick={collapseAllNav}><ChevronsDownUp size={15}/><span>พับทั้งหมด</span></button></div><div className="nav-section">พื้นที่การทำงาน</div><nav aria-label="เมนูหลัก">{nav.filter(n=>["dashboard"].includes(n.id)).map(n => <button key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`} aria-current={page === n.id ? "page" : undefined} aria-label={n.label} title={n.label} onClick={() => go(n.id)}><n.icon size={18}/><span>{n.label}</span></button>)}<DepartmentNavigation page={page} open={openNav} toggle={group=>toggleNav(group as NavGroup)} go={target=>go(target as Page)}/></nav>
      <nav aria-label="รายงาน" className="settings-nav"><button className={`nav-item nav-parent ${page === "reports" || selectedReportSection ? "nav-parent-current" : ""}`} aria-expanded={reportsOpen} aria-label="รายงาน" title="รายงาน" aria-controls="reports-submenu" onClick={()=>toggleNav("reports")}><FileText size={18}/><span>รายงาน</span><ChevronDown size={14} className={`nav-chevron ${reportsOpen ? "expanded" : ""}`}/></button>{reportsOpen && <div id="reports-submenu" className="nav-submenu">{reportSections.map(section=><button key={section.id} className={`nav-item nav-child ${page===section.id ? "active" : ""}`} aria-current={page===section.id ? "page" : undefined} aria-label={section.label} title={section.label} onClick={()=>go(section.id)}><span>{section.label}</span></button>)}</div>}</nav>
      <nav aria-label="ตั้งค่าระบบ" className="settings-nav"><button className={`nav-item nav-parent ${settingsPages.includes(page) ? "nav-parent-current" : ""}`} aria-expanded={settingsOpen} aria-label="ตั้งค่าระบบ" title="ตั้งค่าระบบ" aria-controls="settings-submenu" onClick={() => toggleNav("settings")}><Settings2 size={18}/><span>ตั้งค่าระบบ</span><ChevronDown size={14} className={`nav-chevron ${settingsOpen ? "expanded" : ""}`}/></button>{settingsOpen && <div id="settings-submenu" className="nav-submenu">{nav.filter(n=>settingsPages.includes(n.id)).sort((a,b)=>settingsPages.indexOf(a.id)-settingsPages.indexOf(b.id)).map(n=><button key={n.id} className={`nav-item nav-child ${page === n.id ? "active" : ""}`} aria-current={page === n.id ? "page" : undefined} aria-label={n.label} title={n.label} onClick={() => go(n.id)}><n.icon size={16}/><span>{n.label}</span></button>)}</div>}</nav>
      <div className="nav-section">การควบคุมและตรวจสอบ</div><nav aria-label="เมนูตรวจสอบ">{nav.filter(n => ["sync"].includes(n.id)).map(n => <button key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`} aria-label={n.label} title={n.label} onClick={() => go(n.id)}><n.icon size={18}/><span>{n.label}</span>{n.id === "sync" && (data.queue.length + data.conflicts.length > 0) && <span className="nav-count">{data.queue.length + data.conflicts.length}</span>}</button>)}</nav>
      <div className="sidebar-footer"><div className="sidebar-security"><ShieldCheck size={16}/><span>ต้นแบบ · ข้อมูลจำลองเท่านั้น</span></div><div className="footer-company">พัฒนาโดย <strong>Pacific Plus IT</strong><br/><span>SMARTER ASSETS. BETTER CARE.</span></div></div>
    </aside>
    <div className="main-panel"><header className="topbar"><div className="breadcrumb"><button className="mobile-menu" aria-label="เปิดเมนู" onClick={() => setMenu(true)}><Menu size={21}/></button><span>ระบบบริหารครุภัณฑ์</span><ChevronRight size={13}/><strong>{title}</strong></div><div className="topbar-actions"><span className={`connection-indicator ${isOffline ? "is-offline" : ""}`}>{isOffline ? <WifiOff size={14}/> : <Wifi size={14}/>} {isOffline ? "ออฟไลน์" : "พร้อมทดลอง"}</span><button className="help-btn" aria-label="วิธีทดลอง" onClick={() => setModal("help")}><CircleHelp size={19}/></button><div className="topbar-divider"/><AuthUserChip/><label className="role-picker"><small>มุมมองจำลอง</small><select aria-label="เลือกบทบาทจำลอง" value={role} onChange={e => setRole(e.target.value)}>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label></div></header>
      <main className="main-content"><div className="page-heading"><div><span className="eyebrow">UDON THANI HOSPITAL</span><h1>{title}</h1><p>ทุกครุภัณฑ์มีคุณค่า เพื่อการดูแลที่ดีกว่า {!selectedPlanningSection && !selectedReference && page!=="dashboard" && !selectedReportSection && <span className="heading-date">· ปีงบประมาณ 2569 · ชุดข้อมูลตัวอย่าง</span>}</p></div>{!selectedPlanningSection && !selectedReference && page!=="audit" && page!=="dashboard" && !selectedReportSection && <div className="heading-actions"><Button variant="secondary" onClick={exportAssets}><ArrowDownToLine size={15}/>ส่งออกรายงาน</Button><Button onClick={openScan} disabled={!ready}><QrCode size={16}/>สแกนครุภัณฑ์</Button></div>}</div>
      <div className="demo-banner"><ShieldCheck size={16}/><span><strong>พื้นที่ทดลองใช้งาน</strong> ข้อมูลทั้งหมดเป็นข้อมูลจำลอง เก็บเฉพาะในเบราว์เซอร์นี้ · ยังไม่เชื่อมระบบโรงพยาบาล</span><button className="banner-link" onClick={() => setModal("help")}>วิธีทดลอง <ArrowUpRight size={12}/></button></div>
      {(!ready || storageError || duplicateTab) && <div className="offline-banner" role="status">{!ready ? "กำลังโหลดข้อมูลที่เก็บไว้ในเครื่อง…" : duplicateTab ? "เปิดอยู่หลายแท็บ: แท็บนี้ดูข้อมูลได้เท่านั้น กรุณาทดลองแก้ไขในแท็บแรก" : "เบราว์เซอร์ไม่อนุญาตให้จัดเก็บข้อมูล จึงปิดการเปลี่ยนแปลงเพื่อป้องกันข้อมูลหาย"}</div>}
      {isOffline && <div className="offline-banner"><WifiOff size={16}/>โหมดออฟไลน์: คำสั่งสแกนจะเก็บในเครื่องและรอซิงก์ · งานอนุมัติถูกพักไว้</div>}

      {page === "dashboard"&&<ExecutiveDashboard key={role} data={data} units={masterData.departments.filter(d=>role!=="nurse"||d.id==="ICU")} allowedOwners={masterData.departments.filter(d=>role!=="nurse"||d.id==="ICU").map(d=>d.id)} onNavigate={(target,id)=>{setDashboardTarget(id??"");go(target as Page);}}/>}

      {(page.startsWith("ops-")||page.startsWith("pending-"))&&<ProcurementFlowWorkspace key={`${page}:${dashboardTarget}`} initialCaseId={dashboardTarget} data={{...data,masterData}} view={page} role={role} editable={editable} offline={isOffline} onCommand={runFlow} onNavigate={target=>go(target as Page)}/>}
      {page === "assets" && <><div className="toolbar"><div className="search-wrapper"><Search size={16}/><input className="search-input" aria-label="ค้นหาครุภัณฑ์" placeholder="ค้นหาชื่อ เลขครุภัณฑ์ หรือเลขเครื่อง…" value={query} onChange={e => setQuery(e.target.value)}/></div><div className="heading-actions"><select className="select-input" aria-label="กรองหน่วยงาน" value={ward} onChange={e => setWard(e.target.value)}><option value="all">ทุกหน่วยงานในสิทธิ์</option>{wards.filter(w => scope.includes(w.id)).map(w => <option value={w.id} key={w.id}>{w.name}</option>)}</select><Button variant="secondary" disabled={!["warehouse", "procurement"].includes(role)} onClick={() => { setImportResult(null); setModal("import"); }}><Upload size={14}/>นำเข้า Excel / CSV</Button></div></div><div className="filter-pills section-gap">{["all", ...Object.keys(statusLabels)].map(s => <button className={`filter-pill ${status === s ? "active" : ""}`} key={s} onClick={() => setStatus(s)}>{s === "all" ? "ทั้งหมด" : statusLabels[s]}</button>)}</div><Card>{assetTable(filtered.slice(offset, offset + 10))}<div className="pagination"><span>แสดง {filtered.length ? offset + 1 : 0}–{Math.min(offset + 10, filtered.length)} จาก {filtered.length} รายการ</span><div className="heading-actions"><Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => setOffset(offset - 10)}>ก่อนหน้า</Button><Button variant="secondary" size="sm" disabled={offset + 10 >= filtered.length} onClick={() => setOffset(offset + 10)}>ถัดไป</Button></div></div></Card></>}

      {page === "sync" && <><div className="toolbar"><div><h2 className="panel-title">ศูนย์ควบคุมออฟไลน์</h2><p className="muted">{swReady ? "แคชหน้าเว็บพร้อมสำหรับเปิดซ้ำแบบออฟไลน์" : "กำลังเตรียมแคชหน้าเว็บ · ยังไม่รับรองเปิดซ้ำออฟไลน์"}</p></div><div className="heading-actions"><Button variant="secondary" onClick={() => setOffline(!offline)}>{offline ? <Wifi size={15}/> : <WifiOff size={15}/>} {offline ? "กลับออนไลน์จำลอง" : "จำลองออฟไลน์"}</Button><Button disabled={!editable || isOffline || !data.queue.length} onClick={syncQueue}><RefreshCw size={15}/>ซิงก์คิวของฉัน</Button></div></div><div className="split-grid"><Card><CardHeader><CardTitle>คำสั่งรอซิงก์ <span className="badge warning">{data.queue.length}</span></CardTitle></CardHeader><CardContent>{data.queue.length ? data.queue.map(item => <div className="queue-card" key={item.command.id}><div className="queue-header"><strong>{data.assets.find(a => a.id === item.command.assetId)?.assetNo}</strong><span className="badge warning">รอส่ง</span></div><div className="queue-body">เสนอเปลี่ยนเป็น {statusLabels[item.command.nextStatus]} · v{item.command.baseVersion}<br/><span className="muted">{item.actor.id} · {item.command.deviceId}</span></div></div>) : <div className="empty-state"><CheckCheck size={30}/><p>ไม่มีคำสั่งค้างในเครื่อง</p><small>เปิดโหมดออฟไลน์แล้วลองสแกนด้วยบทบาทคลัง</small></div>}<p className="muted">แต่ละคนซิงก์ได้เฉพาะคำสั่งของตนเอง · {data.lastSynced ? `ซิงก์ล่าสุด ${new Date(data.lastSynced).toLocaleString("th-TH")}` : "ยังไม่มีการซิงก์"}</p></CardContent></Card><Card><CardHeader><CardTitle>ข้อขัดแย้งที่ต้องตรวจสอบ <span className="badge danger">{data.conflicts.length}</span></CardTitle></CardHeader><CardContent>{data.conflicts.length ? data.conflicts.map(c => <div className="queue-card" key={c.id}><div className="queue-header"><strong>{data.assets.find(a => a.id === c.assetId)?.assetNo}</strong><span className="badge danger">รอผู้ตรวจ</span></div><div className="queue-body"><div className="stat-row"><span>ทะเบียนปัจจุบัน · v{c.currentVersion}</span><strong>{statusLabels[c.currentStatus]}</strong></div><div className="stat-row"><span>คำสั่งเก่า · v{c.baseVersion}</span><strong>{statusLabels[c.requestedStatus]}</strong></div><p className="muted">เก็บทั้งสองฝั่งเป็นหลักฐานแล้ว การตัดสินต้องตรวจของจริงและบันทึกคำสั่งใหม่โดยผู้มีอำนาจ</p></div></div>) : <div className="empty-state"><ShieldCheck size={30}/><p>ยังไม่มีข้อขัดแย้ง</p></div>}<Button variant="secondary" disabled={!editable || isOffline} onClick={simulateConflict}><Layers3 size={15}/>จำลองแท็บเล็ตสองเครื่องชนกัน</Button></CardContent></Card></div></>}

      {page === "finance-payments" && <><div className="demo-banner"><FileText size={17}/><span>สถานะคำขอเบิกจ่ายแยกจาก PO · ทดลองส่งคืนด้วยบทบาทการเงิน แล้วแก้ไขส่งใหม่ด้วยบทบาทพัสดุ</span></div><Card><CardHeader><div><CardTitle>คำขอเบิกจ่าย</CardTitle><p className="panel-subtitle">เปลี่ยนบทบาทจำลองด้านบนเพื่อทดลองแต่ละขั้นตอน</p></div></CardHeader><div className="table-wrap"><table className="data-table"><thead><tr><th>คำขอ / รายการ</th><th>PO</th><th>จำนวนเงิน</th><th>สถานะคำขอ</th><th>รุ่น</th><th>ดำเนินการ</th></tr></thead><tbody>{data.payments.map(p => <tr key={p.id}><td><strong>{p.claimNo}</strong><div className="muted">{p.title}</div></td><td>{p.poNo}<br/><span className="badge neutral">ปิด PO แล้ว</span></td><td>฿{money(p.amount)}</td><td><span className={`badge ${tone(p.status)}`}>{paymentLabels[p.status]}</span>{p.returnReason && <div className="muted">{p.returnReason}</div>}</td><td>r{p.revision}</td><td><Button variant="secondary" size="sm" onClick={() => { setPaymentId(p.id); setReason(""); setEvidence(false); setSignature(false); setModal("payment"); }}>ตรวจรายการ</Button></td></tr>)}</tbody></table></div></Card></>}

      {activeDepartment && <RegulatoryNotice department={activeDepartment} open={()=>go(`refs-${activeDepartment}` as ReferencePage)}/>}
      {selectedReference && <RegulatoryWorkspace key={selectedReference.id} department={selectedReference.department}/>}
      {page === "asset-catalog" && <AssetCatalogWorkspace role={role} editable={editable&&!isOffline} proposals={data.catalogProposals??[]} onPropose={async proposal=>commit({...data,catalogProposals:[...(data.catalogProposals??[]),proposal]},undefined,{action:"PROPOSE_CATALOG_MAPPING",module:"asset-catalog",target:proposal.catalogId,after:proposal})}/>}
      {page === "asset-numbering" && <AssetNumberingWorkspace state={data.assetNumbering} assets={data.assets} role={role} editable={editable} offline={isOffline} onChange={async(assetNumbering,assets,action,target)=>commit({...data,assetNumbering,assets},undefined,{action,module:"asset-numbering",target})}/>}
      {page === "procurement" && <LifecycleWorkspace/>}
      {selectedPlanningSection && <PlanningWorkspace page={selectedPlanningSection.id} state={data.planning} departments={masterData.departments} profile={data.hospitalProfile} editable={editable} offline={isOffline} onChange={async (planning,file)=>await commit({...data,planning},file)}/>}

      {selectedReportSection&&<ExecutiveDashboard key={page+":"+role} data={data} units={masterData.departments.filter(d=>role!=="nurse"||d.id==="ICU")} allowedOwners={masterData.departments.filter(d=>role!=="nurse"||d.id==="ICU").map(d=>d.id)} initialResponsible={({"reports-strategy":"planning","reports-procurement":"procurement","reports-finance":"finance","reports-accounting":"accounting","reports-legal":"legal"} as Record<string,ExecutiveDepartment>)[page]} onNavigate={(target,id)=>{setDashboardTarget(id??"");go(target as Page);}}/>}

      {page === "work-accounting" && <><div className="connection-card section-gap-top"><ShieldCheck size={22}/><h3>การลงบัญชีและค่าเสื่อม</h3><p className="muted">ต้นแบบแสดงมูลค่าจากราคาทุนและค่าเสื่อมจำลอง ยังไม่สร้างสมุดรายวันหรือส่งรายการไป GFMIS ระบบบริการมีสคีมารองรับสำหรับพัฒนาต่อ</p></div><OpsDepreciationReference/></>}

      {page === "work-procurement" && <Card><CardHeader><CardTitle>แผนอนุมัติที่ส่งมาจากฝ่ายแผนฯ</CardTitle></CardHeader><CardContent>{data.planning?.plans.filter(p=>p.status==="SENT").map(p=><div className="planning-round" key={p.id}><strong>{p.code} · {data.planning?.rounds.find(r=>r.id===p.roundId)?.name}</strong><p>{data.planning?.rounds.find(r=>r.id===p.roundId)?.fund} · หนังสือตอบกลับ สสจ. {p.reply}</p>{p.snapshots.map(s=><p key={s.demandId}>{s.demandId} · {s.item.title} · {s.item.quantity} {s.item.unit} · ฿{money(s.item.quantity*s.item.unitPrice)}</p>)}</div>)}{!data.planning?.plans.some(p=>p.status==="SENT")&&<p className="muted">ยังไม่มีแผนส่งมาจากฝ่ายแผนฯ</p>}<p className="muted">กล่องรับแผนจำลอง · ยังไม่สร้าง PR หรือ PO อัตโนมัติ</p></CardContent></Card>}
      {selectedWorkspaceSection && !["work-strategy","work-procurement","work-finance","work-accounting"].includes(page) && <Card><CardHeader><CardTitle>พื้นที่การทำงาน · {selectedWorkspaceSection.label}</CardTitle></CardHeader><CardContent><div className="empty-state"><selectedWorkspaceSection.icon size={30}/><p>ยังไม่ได้เพิ่มงานในหมวดนี้</p><small>เตรียมหัวข้อหลักของฝ่ายไว้แล้ว</small></div></CardContent></Card>}

      {page === "reports" && <><div className="split-grid"><Card><CardHeader><CardTitle>รายงานทะเบียนครุภัณฑ์</CardTitle></CardHeader><CardContent><p className="muted">ส่งออกข้อมูลจำลองตามขอบเขตหน่วยงานที่ได้รับสิทธิ์ เป็นไฟล์ CSV</p><div className="heading-actions"><Button onClick={exportAssets}><ArrowDownToLine size={15}/>ส่งออกทะเบียน</Button><Button variant="secondary" onClick={()=>go("assets")}>ดูและกรองรายการ</Button></div></CardContent></Card><Card><CardHeader><CardTitle>รายงานประวัติการดำเนินการ</CardTitle></CardHeader><CardContent><p className="muted">ตรวจสอบประวัติคำสั่งและรายการขัดแย้ง พร้อมส่งออกจากหน้าประวัติ</p><Button variant="secondary" onClick={()=>go("audit")}><History size={15}/>เปิดประวัติและส่งออก</Button></CardContent></Card></div><div className="demo-banner section-gap-top"><FileText size={16}/><span>รายงานในรุ่นนี้เป็นข้อมูลจำลองและไฟล์ CSV ส่วนหัวรายงานพร้อมรูปตั้งค่าได้ที่ “ตั้งค่าระบบ → ข้อมูลโรงพยาบาล” สำหรับพัฒนารายงานฉบับพิมพ์ต่อไป</span></div></>}

      {page === "users" && <UserManagement users={data.users} departmentOptions={masterData.departments.map(d=>({id:d.id,name:d.name,status:d.status}))} actorRole={role} editable={editable} switchToAdmin={()=>setRole("admin")} onChange={async (users,action,staffCode)=>commit({...data,users,audit:[...data.audit,{sequence:data.audit.length+1,actorId:`demo-${role}`,deviceId:"tablet-A",assetId:staffCode,outcome:action,code:"DEMO_ONLY",beforeVersion:null,afterVersion:null}]})}/>}

      {(["document-codes","departments","vendors"] as string[]).includes(page) && <MasterDataManagement kind={page === "document-codes" ? "documents" : page === "departments" ? "departments" : "vendors"} state={masterData} actorRole={role} editable={editable} switchToAdmin={()=>setRole("admin")} onChange={async (masterData,event,code)=>commit({...data,masterData,audit:[...data.audit,{sequence:data.audit.length+1,actorId:`demo-${role}`,deviceId:"tablet-A",assetId:code,outcome:event,code:"DEMO_ONLY",beforeVersion:null,afterVersion:null}]})}/>}

      {page === "hospital" && <HospitalProfileManagement profile={data.hospitalProfile} actorRole={role} editable={editable} switchToAdmin={()=>setRole("admin")} onChange={async hospitalProfile=>commit({...data,hospitalProfile,audit:[...data.audit,{sequence:data.audit.length+1,actorId:`demo-${role}`,deviceId:"tablet-A",assetId:"HOSPITAL_PROFILE",outcome:"HOSPITAL_PROFILE_UPDATED",code:"DEMO_ONLY",beforeVersion:null,afterVersion:null}]})}/>}

      {page === "documents" && <><div className="demo-banner"><FileCheck2 size={17}/><span>ขั้นตอนหลักฐาน: ตรึงรุ่น → พิมพ์ → ลงหมึก → สแกน → ตรวจเทียบ → รับรองสำเนา · หน้านี้แสดงตัวอย่าง ยังไม่รับอัปโหลดหลักฐานจริง</span></div>{data.documents.map(d => <Card className="section-gap" key={d.id}><CardHeader><div><CardTitle>{d.title}</CardTitle><p className="panel-subtitle">{d.ref} · รุ่น {d.revision} · {d.poNo}</p></div><span className={`badge ${d.status === "SIGNED_COPY_VERIFIED" ? "success" : "warning"}`}>{d.status === "SIGNED_COPY_VERIFIED" ? "ตัวอย่างสำเนาตรวจแล้ว" : "รอลายเซ็นหมึก"}</span></CardHeader><CardContent><div className="detail-grid"><div><div className="detail-label">ตำแหน่งต้นฉบับกระดาษ</div><div className="detail-value">{d.location}</div></div><div><div className="detail-label">ความครบถ้วนของหลักฐาน</div><div className="detail-value">ต้องเก็บ PDF ต้นฉบับ / hash / สำเนาลงนามแยกกัน</div></div></div><p className="muted">ยังไม่มีไฟล์จริงในต้นแบบ · การเข้าสู่ระบบไม่เท่ากับการลงนามรับรองเอกสาร</p></CardContent></Card>)}</>}

      {page === "audit" && <SystemLogViewer role={role} switchRole={()=>setRole("auditor")}/>}

      {page === "integrations" && <><div className="split-grid">{[{ name: "HOSxP", icon: Building2, text: "ยังไม่เชื่อมต่อ · ตัวเชื่อมต้องใช้สำเนาข้อมูลอ่านอย่างเดียวและสิทธิ์ที่โรงพยาบาล/BMS อนุญาต" }, { name: "MOPH Provider ID", icon: ShieldCheck, text: "ยังไม่เชื่อมต่อ · ตัวเลือกบทบาทในหน้านี้เป็นการจำลอง ไม่ใช่การเข้าสู่ระบบหรือหลักฐาน 2FA" }, { name: "Aruba BLE / IoT", icon: Wifi, text: "ยังไม่เชื่อมต่อ · รับ telemetry ผ่าน AP/Gateway แล้วเข้าคิว ไม่แก้ผู้ครอบครองจากสัญญาณโดยตรง" }, { name: "Node.js / Prisma / MySQL", icon: Layers3, text: "มีซอร์สบริการและสคีมาแยกไว้ · หน้านี้ใช้ IndexedDB ในเบราว์เซอร์ ยังไม่เชื่อมฐานข้อมูลโรงพยาบาล" }].map(c => <div className="connection-card" key={c.name}><div className="connection-title"><c.icon size={24}/><span className="badge neutral">ยังไม่เชื่อม</span></div><h3>{c.name}</h3><p className="muted">{c.text}</p></div>)}</div><Card><CardHeader><CardTitle>เครื่องมือพื้นที่ทดลอง</CardTitle></CardHeader><CardContent><div className="toolbar"><span className="muted">ล้างเฉพาะข้อมูลจำลองในเบราว์เซอร์นี้ เพื่อเริ่มทดลองใหม่</span><Button variant="secondary" disabled={!editable} onClick={() => setModal("reset")}>รีเซ็ตข้อมูลจำลอง</Button></div><p className="muted">การนำเข้ารองรับ Excel .xlsx และ CSV · OCR, RFID และการตรวจรับรองข้อขัดแย้งโดยหัวหน้าคลังยังต้องพัฒนาต่อ</p></CardContent></Card></>}
      </main>
    </div>

    {selected && <Modal title="รายละเอียดครุภัณฑ์" close={() => setSelected(null)} footer={<Button onClick={() => { setScan(selected.assetNo); setScanned(selected); setNextStatus(selected.status === "AVAILABLE" ? "IN_USE" : "REPAIR"); setSelected(null); setModal("scan"); }}>ทำรายการสแกน <ArrowRight size={15}/></Button>}><div className="detail-hero"><span className="detail-asset-icon"><HeartPulse size={30}/></span><div><h3>{selected.name}</h3><p>{selected.assetNo}</p></div><span className={`badge ${tone(selected.status)}`}>{statusLabels[selected.status]}</span></div><div className="detail-grid">{[["เลขเครื่อง", selected.serialNo], ["หน่วยงาน", wardName(selected.wardId)], ["ราคาทุน", `฿${money(selected.cost)}`], ["มูลค่าตามบัญชี", selected.accountingPending?"รอรับรองบัญชี":`฿${money(selected.cost - selected.depreciation)}`], ["เอกสารจัดซื้อ", selected.poNo], ["รุ่นข้อมูล", `v${selected.version}`], ["ผลตรวจนับ", selected.verified ? "ตัวอย่างตรวจแล้ว" : "ยังไม่ตรวจ"], ["แหล่งข้อมูล", "ทะเบียนจำลองในเบราว์เซอร์"]].map(([l, v]) => <div key={l}><div className="detail-label">{l}</div><div className="detail-value">{v}</div></div>)}</div><p className="muted">ไม่เก็บหรือแสดงข้อมูลผู้ป่วย</p></Modal>}

    {modal === "scan" && <Modal title="สแกนและทำรายการ" close={() => setModal(null)} footer={scanned ? <><Button variant="secondary" onClick={() => setScanned(null)}>สแกนใหม่</Button><Button disabled={!editable || !["warehouse", "nurse"].includes(role)} onClick={submitScan}>{isOffline ? "เก็บคำสั่งรอซิงก์" : "ยืนยันรายการจำลอง"}</Button></> : undefined}>{!scanned ? <><div className="scan-preview"><div className="scan-frame"><QrCode size={78}/><div className="scan-line"/></div><small>รับรหัสจากเครื่องสแกน USB/Bluetooth หรือกรอกด้านล่าง</small></div><form onSubmit={e => { e.preventDefault(); findScan(); }}><label className="form-field">รหัสครุภัณฑ์<input value={scan} onChange={e => setScan(e.target.value)} placeholder="UTH-69-00001" autoComplete="off" maxLength={80}/></label><div className="heading-actions"><Button type="submit"><Search size={15}/>ค้นหารหัส</Button><Button type="button" variant="secondary" onClick={() => findScan("UTH-69-00001")}>ลองรหัสตัวอย่าง</Button></div></form><p className="muted">รุ่นนี้รองรับเครื่องอ่านรหัสและการกรอก ยังไม่เปิดกล้องอ่าน QR</p></> : <><div className="detail-hero"><span className="detail-asset-icon"><HeartPulse size={28}/></span><div><h3>{scanned.name}</h3><p>{scanned.assetNo} · {scanned.serialNo}</p></div></div><div className="detail-grid"><div><div className="detail-label">หน่วยงานจากทะเบียนจำลอง</div><div className="detail-value">{wardName(scanned.wardId)}</div></div><div><div className="detail-label">สถานะ / รุ่น</div><div className="detail-value">{statusLabels[scanned.status]} · v{scanned.version}</div></div></div><label className="form-field">รายการที่ต้องการ<select value={nextStatus} onChange={e => setNextStatus(e.target.value)}><option value="IN_USE">รับใช้งาน</option><option value="AVAILABLE">คืน / พร้อมใช้</option><option value="REPAIR">แจ้งชำรุด / ส่งซ่อม</option><option value="QUARANTINED">กักใช้งาน / รอตรวจรับรอง</option></select></label>{!["warehouse", "nurse"].includes(role) && <p className="warning-text">เลือกมุมมองจำลอง “เจ้าหน้าที่คลัง” หรือ “พยาบาล” ด้านบนก่อนทำรายการ</p>}<p className="muted">อ้างอิงรุ่นขณะสแกน หากมีการแก้ไขก่อนยืนยัน ระบบจะตรวจเป็นข้อขัดแย้ง</p></>}</Modal>}

    {modal === "import" && <Modal title="นำเข้าทะเบียนเดิม Excel / CSV" close={()=>setModal(null)}><LegacyExcelImport existing={data.assets.map(a=>a.assetNo)} units={wards.filter(w=>scope.includes(w.id))} editable={editable&&!isOffline&&["warehouse","procurement"].includes(role)} onCommit={importLegacyRecords}/></Modal>}

    {modal === "payment" && payment && <Modal title={`${payment.claimNo} · รุ่น ${payment.revision}`} close={() => setModal(null)} footer={<>{payment.status === "SUBMITTED" && role === "finance" && <><Button variant="secondary" disabled={!editable || isOffline || !reason.trim()} onClick={() => paymentAction("RETURN")}>ส่งคืนแก้ไข</Button><Button disabled={!editable || isOffline || !evidence || !signature} onClick={() => paymentAction("APPROVE")}>อนุมัติจำลอง</Button></>}{payment.status === "RETURNED" && role === "procurement" && <Button disabled={!editable || isOffline} onClick={() => paymentAction("RESUBMIT")}>สร้างรุ่นใหม่และส่งตรวจ</Button>}</>}><h3>{payment.title}</h3><div className="stat-row"><span>สถานะจัดซื้อ</span><span className="badge neutral">{payment.poNo} · CLOSED</span></div><div className="stat-row"><span>สถานะคำขอ</span><span className={`badge ${tone(payment.status)}`}>{paymentLabels[payment.status]}</span></div><div className="stat-row"><span>จำนวนเงิน</span><strong>฿{money(payment.amount)}</strong></div>{payment.returnReason && <p className="warning-text">เหตุผลส่งคืน: {payment.returnReason}</p>}{payment.status === "SUBMITTED" && role === "finance" && <><label className="form-field section-gap-top">เหตุผลส่งคืน<textarea rows={3} value={reason} maxLength={2000} onChange={e => setReason(e.target.value)} placeholder="เช่น ใบแจ้งหนี้ไม่ตรงกับเอกสารตรวจรับ"/></label><label className="checkbox-row"><input type="checkbox" checked={evidence} onChange={e => setEvidence(e.target.checked)}/>จำลองผลตรวจหลักฐานครบถ้วน</label><label className="checkbox-row"><input type="checkbox" checked={signature} onChange={e => setSignature(e.target.checked)}/>จำลองผลตรวจลายเซ็นและผู้มีอำนาจ</label></>}{payment.history?.length > 0 && <p className="muted">คงสำเนารุ่นเดิมไว้ {payment.history.length} รุ่นในข้อมูลสาธิต</p>}<p className="muted">การติ๊กช่องเป็นการจำลองเท่านั้น ระบบจริงต้องตรวจหลักฐานที่เซิร์ฟเวอร์และยืนยันตัวตนตามอำนาจอนุมัติ</p>{!["finance", "procurement"].includes(role) && <p className="warning-text">เปลี่ยนมุมมองเป็นการเงินหรือพัสดุเพื่อทดลองขั้นตอน</p>}</Modal>}

    {modal === "help" && <Modal title="เริ่มทดลองใน 3 นาที" close={() => setModal(null)} footer={<Button onClick={() => { setRole("warehouse"); setModal(null); go("sync"); }}>เริ่มที่คิวออฟไลน์ <ArrowRight size={15}/></Button>}><ol className="help-steps"><li><strong>เลือกบทบาทเจ้าหน้าที่คลัง</strong><p>ใช้ตัวเลือกมุมมองจำลองมุมขวาบน</p></li><li><strong>ทดลองสแกนและออฟไลน์</strong><p>หน้า “คิวซิงก์” → จำลองออฟไลน์ → สแกน → ลองรหัสตัวอย่าง → ยืนยัน จากนั้นกลับออนไลน์และซิงก์</p></li><li><strong>ลองข้อมูลขัดแย้ง</strong><p>กด “จำลองแท็บเล็ตสองเครื่องชนกัน” แล้วดูทั้งสองสถานะและรุ่นข้อมูล</p></li><li><strong>ลองการเงินส่งคืนหลังปิด PO</strong><p>เลือกบทบาทการเงิน → ตรวจรายการแรก → ใส่เหตุผลส่งคืน จากนั้นเปลี่ยนเป็นพัสดุเพื่อสร้างคำขอรุ่นใหม่</p></li></ol><p className="muted">ข้อมูลเก็บใน IndexedDB ของเบราว์เซอร์ ไม่ส่งไปฐานข้อมูลโรงพยาบาล รีเซ็ตได้จากหน้าการเชื่อมต่อ</p></Modal>}
    {modal === "reset" && <Modal title="เริ่มข้อมูลจำลองใหม่" close={() => setModal(null)} footer={<><Button variant="secondary" onClick={() => setModal(null)}>ยกเลิก</Button><Button disabled={!editable} onClick={async () => { if (!await resetFlowOnServer()) return; if (await commit({...createSeed(),procurementFlow:data.procurementFlow?{...emptyFlow(),counters:data.procurementFlow.counters}:undefined,assetNumbering:data.assetNumbering?{...data.assetNumbering,intakes:[]}:undefined},undefined,{action:"RESET_DEMO_DATA",module:"settings",target:"demo-state",reason:"ผู้ใช้ยืนยันรีเซ็ตข้อมูลจำลอง โดยคง Log system"})) { setModal(null); notify("รีเซ็ตเฉพาะข้อมูลจำลองแล้ว"); } }}>ยืนยันรีเซ็ต</Button></>}><p>คำสั่งออฟไลน์และข้อมูลธุรกิจในเบราว์เซอร์นี้จะถูกแทนด้วยชุดข้อมูลตัวอย่างเริ่มต้น โดย Log system และตัวนับเลขครุภัณฑ์ยังคงอยู่เพื่อป้องกันการใช้เลขซ้ำ</p></Modal>}
    {toast && <div role="status" className={`toast ${toast.error ? "toast-error" : "toast-success"}`}>{toast.message}</div>}
  </div></SystemActivityContext.Provider>;
}
