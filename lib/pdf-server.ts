// Server-side Thai PDF report generation for the Asset Catalog.
// Rendered via local headless Chromium (offline, no CDN) because jsPDF
// cannot reliably shape Thai combining/tone marks. Pure helpers exported for tests.

import { existsSync } from "node:fs";
import { execFile, spawnSync } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { statusLabels, wards } from "./seed";

export const ALLOWED_REPORT_ROLES = ["ADMIN", "WARD", "AUDITOR"] as const;
export type ReportAsset = { id: string; assetNo: string; name: string; wardId: string; status: string; cost: number | string };
export type ReportFilters = { search?: string; status?: string; wardId?: string };
export type ReportParams = { assets: ReportAsset[]; hospitalName?: string; generatedAt?: Date; filters?: ReportFilters };

export function checkReportRole(role: string | null | undefined): { ok: boolean; error?: string } {
  if (typeof role === "string" && (ALLOWED_REPORT_ROLES as readonly string[]).includes(role)) return { ok: true };
  return { ok: false, error: "PERMISSION_DENIED" };
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function thb(value: number | string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  try { return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 0 }).format(n); }
  catch { return `${n.toLocaleString("th-TH")} บาท`; }
}

export function statusLabel(status: string): string {
  return (statusLabels as Record<string, string>)[status] ?? status ?? "—";
}

export function wardName(wardId: string): string {
  return (wards as { id: string; name: string }[]).find((w) => w.id === wardId)?.name ?? wardId ?? "—";
}

export function thaiDate(d: Date): string {
  try { return d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return d.toISOString(); }
}

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "#15803d", IN_USE: "#1d4ed8", REPAIR: "#b45309", QUARANTINED: "#c2410c", DISPOSED: "#6b7280"
};

export function buildAssetsReportHtml(params: ReportParams): string {
  const assets = params.assets ?? [];
  const hospital = escapeHtml(params.hospitalName || "UTH");
  const f = params.filters ?? {};
  const bits: string[] = [];
  if (f.status && f.status !== "ALL") bits.push(`สถานะ: ${escapeHtml(statusLabel(f.status))}`);
  if (f.wardId) bits.push(`หน่วยงาน: ${escapeHtml(wardName(f.wardId))}`);
  if (f.search) bits.push(`ค้นหา: “${escapeHtml(f.search)}”`);
  const totalCost = assets.reduce((s, a) => s + (Number(a.cost) || 0), 0);
  const rows = assets.map((a, i) => {
    const c = STATUS_COLORS[a.status] ?? "#374151";
    return `<tr><td class="num">${i + 1}</td><td class="mono">${escapeHtml(a.assetNo)}</td>` +
      `<td>${escapeHtml(a.name)}</td><td>${escapeHtml(wardName(a.wardId))}</td>` +
      `<td><span class="badge" style="color:${c};background:${c}14;border:1px solid ${c}33"><span class="dot" style="background:${c}"></span>${escapeHtml(statusLabel(a.status))}</span></td>` +
      `<td class="num">${escapeHtml(thb(a.cost))}</td></tr>`;
  }).join("");
  const body = assets.length
    ? `<table><thead><tr><th>ลำดับ</th><th>เลขครุภัณฑ์</th><th>ชื่อสินทรัพย์</th><th>หน่วยงาน</th><th>สถานะ</th><th class="num">ราคาทุน</th></tr></thead><tbody>${rows}</tbody></table><div class="summary">รวม ${assets.length} รายการ · มูลค่ารวม ${escapeHtml(thb(totalCost))}</div>`
    : `<div class="empty"><div class="empty-title">ไม่พบข้อมูลทรัพย์สิน</div><div class="muted">ไม่มีรายการที่ตรงกับเงื่อนไขการค้นหา (อาจยังไม่ได้บันทึกข้อมูล หรือตัวกรองไม่ตรง)</div></div>`;
  return `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><title>รายงานรายการทรัพย์สิน</title><style>
@page{size:A4;margin:14mm 12mm}*{box-sizing:border-box}html,body{margin:0;padding:0}
body{font-family:"Noto Sans Thai","Sawasdee","Kinnari","Norasi","Tahoma","Leelawadee UI",sans-serif;color:#111827;font-size:12px;line-height:1.5}
.head{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #1e3a8a;padding-bottom:10px;margin-bottom:14px}
.head h1{margin:0;font-size:20px;color:#1e3a8a}.head .sub{margin:2px 0 0;font-size:11px;color:#4b5563}
.meta{text-align:right;font-size:11px;color:#374151;white-space:nowrap}.meta b{color:#111827}
.muted{color:#6b7280;font-size:11px}table{width:100%;border-collapse:collapse}
th,td{border:1px solid #d1d5db;padding:6px 8px;text-align:left;vertical-align:middle}
thead th{background:#1e3a8a;color:#fff;font-weight:600}tbody tr:nth-child(even) td{background:#f9fafb}
tr{break-inside:avoid;page-break-inside:avoid}.num{text-align:right;white-space:nowrap}.mono{white-space:nowrap}
.badge{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:999px;font-size:11px}
.dot{width:7px;height:7px;border-radius:999px;display:inline-block}
.summary{margin-top:12px;font-weight:600}
.empty{margin:40px 0;text-align:center;padding:32px;border:1px dashed #cbd5e1;border-radius:10px;background:#f8fafc}
.empty-title{font-size:16px;font-weight:700;color:#334155;margin-bottom:6px}
.foot{margin-top:22px;padding-top:8px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between}
</style></head><body>
<div class="head"><div><h1>รายงานรายการทรัพย์สิน</h1><p class="sub">Asset List Report · ${hospital}</p>${bits.length ? `<div class="muted">${bits.join(" · ")}</div>` : ""}</div>
<div class="meta"><div>สร้างเมื่อ <b>${escapeHtml(thaiDate(params.generatedAt ?? new Date()))}</b></div><div>${hospital}</div></div></div>
${body}
<div class="foot"><span>UTH Smart Assets · ระบบบริหารทรัพย์สิน</span><span>เอกสารนี้สร้างจากระบบอัตโนมัติ</span></div>
</body></html>`;
}
const CHROME_NAMES = ["google-chrome", "google-chrome-stable", "chromium-browser", "chromium", "chrome"];
const CHROME_PATHS = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/opt/google/chrome/chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];

export function findChrome(): string | null {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  for (const name of CHROME_NAMES) {
    const res = spawnSync("which", [name], { stdio: "ignore" });
    const p = String(res.stdout || "").trim();
    if (res.status === 0 && p && existsSync(p)) return p;
  }
  for (const p of CHROME_PATHS) if (existsSync(p)) return p;
  return null;
}

export async function printHtmlToPdf(html: string, opts?: { timeoutMs?: number }): Promise<Buffer> {
  const chrome = findChrome();
  if (!chrome) {
    const err: NodeJS.ErrnoException = new Error("CHROME_MISSING");
    (err as any).message = "CHROME_MISSING: ไม่พบเบราว์เซอร์ Chromium ในเครื่องเซิร์ฟเวอร์";
    throw err;
  }
  const dir = await mkdtemp(path.join(os.tmpdir(), "uth-assets-pdf-"));
  const htmlPath = path.join(dir, "report.html");
  const pdfPath = path.join(dir, "report.pdf");
  try {
    await writeFile(htmlPath, html, "utf8");
    const args = ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
      "--no-first-run", "--no-default-browser-check", "--hide-scrollbars",
      "--virtual-time-budget=2500", "--print-to-pdf-no-header", `--print-to-pdf=${pdfPath}`, `file://${htmlPath}`];
    await new Promise<void>((resolve, reject) => {
      execFile(chrome, args, { timeout: opts?.timeoutMs ?? 30000, maxBuffer: 64 * 1024 * 1024 }, (error, _so, stderr) => {
        if (error) reject(new Error(`CHROME_FAILED: ${error.message}${stderr ? " " + String(stderr).slice(-300) : ""}`));
        else resolve();
      });
    });
    const buf = await readFile(pdfPath);
    if (!buf.length || buf.subarray(0, 4).toString("latin1") !== "%PDF") throw new Error("PDF_INVALID: ไฟล์ PDF ที่สร้างไม่ถูกต้อง");
    return buf;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function renderAssetsReportPdf(params: ReportParams): Promise<Buffer> {
  return printHtmlToPdf(buildAssetsReportHtml(params));
}
