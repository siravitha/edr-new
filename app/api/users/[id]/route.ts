import { NextRequest, NextResponse } from "next/server";
import { type UserRole } from "@prisma/client";
import { prisma } from "../../../../lib/prisma";
import {
  resolveSessionSecret,
  verifySessionToken,
  requireRole,
  parseCookies,
  hashPassword,
  SESSION_COOKIE,
} from "../../../../lib/auth.mjs";

function guardSession(request: NextRequest) {
  const token = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE];
  const payload = token ? verifySessionToken(token, resolveSessionSecret()) : null;
  if (!payload) return { status: 401, body: { error: "NOT_AUTHENTICATED" } };
  const roleCheck = requireRole(payload.role, "ADMIN");
  if (!roleCheck.ok) return { status: 403, body: { error: roleCheck.error } };
  return { ok: true, payload };
}

const DB_ROLES = ["ADMIN", "WAREHOUSE", "WARD", "AUDITOR"];

function serializeUser(user: {
  id: string;
  staffCode: string;
  fullName: string;
  role: string;
  active: boolean;
  wards?: { wardId: string }[];
  createdAt?: Date;
}) {
  return {
    id: user.id,
    staffCode: user.staffCode,
    fullName: user.fullName,
    role: user.role,
    active: user.active,
    wards: user.wards?.map((w) => w.wardId) ?? [],
    ...(user.createdAt ? { createdAt: user.createdAt } : null),
  };
}

/** GET /api/users/:id — ดูข้อมูลผู้ใช้รายคน */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = guardSession(request);
  if (!("ok" in guard)) {
    return NextResponse.json(guard.body, { status: guard.status });
  }
  const { id } = await params;
  const user = await prisma.user.findFirst({ where: { id, hospitalId: "UTH" }, include: { wards: true } });
  if (!user) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ user: serializeUser(user) });
}

/** PATCH /api/users/:id — แก้ไขข้อมูล/บทบาท/สถานะ (ป้องกันลดสิทธิ์/ปิด account ของ admin คนสุดท้าย) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = guardSession(request);
  if (!("ok" in guard)) {
    return NextResponse.json(guard.body, { status: guard.status });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  if (body.role !== undefined && !DB_ROLES.includes(body.role)) {
    return NextResponse.json({ error: "INVALID_ROLE" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({ where: { id, hospitalId: "UTH" } });
  if (!user) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  }

  // ป้องกัน: ไม่อนุญาตให้ลดสิทธิ์หรือปิด account ของ admin คนสุดท้าย
  if (
    user.role === "ADMIN" &&
    ((body.role !== undefined && body.role !== "ADMIN") ||
      (body.active !== undefined && body.active === false))
  ) {
    const activeAdmins = await prisma.user.count({
      where: { hospitalId: "UTH", role: "ADMIN", active: true },
    });
    if (activeAdmins <= 1) {
      return NextResponse.json(
        { error: "LAST_ADMIN", message: "ไม่สามารถลดสิทธิ์/ปิด account ของ admin คนสุดท้ายได้" },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(typeof body.fullName === "string" && body.fullName.trim()
        ? { fullName: body.fullName.trim() }
        : null),
      ...(body.role !== undefined
        ? { role: body.role as UserRole }
        : null),
      ...(typeof body.active === "boolean" ? { active: body.active } : null),
    },
    include: { wards: true },
  });

  // จัดการ ward assignments ใหม่ทั้งหมดถ้าส่งมา
  if (Array.isArray(body.wards)) {
    const wardIds = body.wards.filter((w: unknown) => typeof w === "string");
    await prisma.userWard.deleteMany({ where: { userId: updated.id } });
    if (wardIds.length > 0) {
      await prisma.userWard.createMany({
        data: wardIds.map((wardId: string) => ({ userId: updated.id, wardId })),
      });
    }
    const withWards = await prisma.user.findUnique({
      where: { id: updated.id },
      include: { wards: true },
    });
    if (withWards) {
      return NextResponse.json({ user: serializeUser(withWards) });
    }
  }
  return NextResponse.json({ user: serializeUser(updated) });
}

/** PUT /api/users/:id/password — เปลี่ยนรหัสผ่าน (hash ด้วย scrypt) */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = guardSession(request);
  if (!("ok" in guard)) {
    return NextResponse.json(guard.body, { status: guard.status });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.password !== "string") {
    return NextResponse.json({ error: "password เป็นข้อมูลจำเป็น" }, { status: 400 });
  }
  if (body.password.length < 8) {
    return NextResponse.json(
      { error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" },
      { status: 400 }
    );
  }
  const user = await prisma.user.findFirst({ where: { id, hospitalId: "UTH" } });
  if (!user) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(body.password) },
  });
  return NextResponse.json({ ok: true });
}