import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseCookies, verifySessionToken, resolveSessionSecret } from "@/lib/auth.mjs";
import { checkReportRole, renderAssetsReportPdf } from "@/lib/pdf-server";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const SESSION_COOKIE = "uth_session";
const STATUS_ENUM = ["AVAILABLE", "IN_USE", "REPAIR", "QUARANTINED", "DISPOSED"];

function json(status: number, error: string, code: string) {
  return NextResponse.json({ error, code }, { status });
}

// Auth guard: require a valid session with a report-allowed role (ADMIN | WARD | AUDITOR).
function guard(request: NextRequest) {
  const value = parseCookies(request.headers.get("cookie"))?.[SESSION_COOKIE] as string | undefined;
  if (!value) return { ok: false as const, res: json(401, "กรุณาเข้าสู่ระบบเพื่อส่งออกข้อมูล", "UNAUTHENTICATED") };
  const session = verifySessionToken(value, resolveSessionSecret());
  if (!session) return { ok: false as const, res: json(401, "เซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่", "UNAUTHENTICATED") };
  if (!checkReportRole(session.role).ok) return { ok: false as const, res: json(403, "คุณไม่มีสิทธิ์ส่งออกข้อมูลสินทรัพย์", "PERMISSION_DENIED") };
  return { ok: true as const };
}

const pad = (n: number) => String(n).padStart(2, "0");

export async function GET(request: NextRequest) {
  const gate = guard(request);
  if (!gate.ok) return gate.res;

  const p = request.nextUrl.searchParams;
  const search = (p.get("search") ?? "").trim();
  const status = (p.get("status") ?? "").trim();
  const wardId = (p.get("wardId") ?? "").trim();
  const hospitalId = (p.get("hospitalId") ?? "").trim();

  const where: Prisma.AssetWhereInput = {};
  if (hospitalId) where.hospitalId = hospitalId;
  if (wardId) where.wardId = wardId;
  if (status && STATUS_ENUM.includes(status)) (where as Record<string, unknown>).status = status;
  if (search) where.OR = [{ assetNo: { contains: search } }, { name: { contains: search } }];

  let assets;
  try {
    assets = await prisma.asset.findMany({ where, orderBy: { assetNo: "asc" } });
  } catch {
    return json(500, "เกิดข้อผิดพลาดในการดึงข้อมูลจากฐานข้อมูล", "DB_ERROR");
  }

  try {
    const pdf = await renderAssetsReportPdf({
      assets: assets.map((a) => ({ id: a.id, assetNo: a.assetNo, name: a.name, wardId: a.wardId, status: a.status, cost: Number(a.cost) })),
      hospitalName: "UTH",
      generatedAt: new Date(),
      filters: { search, status, wardId },
    });
    const d = new Date();
    const filename = `assets-report-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.pdf`;
    const buf = Buffer.from(pdf);
    const headers = {
      "Content-Type": "application/pdf",
      "Content-Length": String(buf.length),
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    };
    return new NextResponse(buf, { status: 200, headers });
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (msg.includes("CHROME_MISSING")) return json(503, "ไม่สามารถสร้าง PDF ได้: ระบบไม่พบเบราว์เซอร์ Chromium ในเครื่องเซิร์ฟเวอร์", "CHROME_MISSING");
    if (msg.includes("PDF_INVALID")) return json(500, "ไม่สามารถสร้าง PDF ได้: ไฟล์ผลลัพธ์ไม่ถูกต้อง", "PDF_INVALID");
    return json(500, "เกิดข้อผิดพลาดในการสร้างไฟล์ PDF", "SERVER_ERROR");
  }
}
