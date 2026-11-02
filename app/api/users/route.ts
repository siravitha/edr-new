import { NextRequest, NextResponse } from "next/server";
import { Prisma, type UserRole } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import {
  resolveSessionSecret,
  verifySessionToken,
  requireRole,
  parseCookies,
  hashPassword,
  SESSION_COOKIE,
} from "../../../lib/auth.mjs";

/**
 * ผู้ดูแลระบบเท่านั้น:
 * - GET    /api/users?role=<ADMIN|WAREHOUSE|WARD|AUDITOR>&active=<true|false>
 * - POST   /api/users        { staffCode, fullName, role, password, wards?: string[] }
 * - GET    /api/users/:id
 * - PATCH  /api/users/:id    { fullName?, role?, active?, wards?: string[] }
 * - PUT    /api/users/:id/password { password }
 */

function guardSession(request: NextRequest) {
  const token = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE];
  const payload = token ? verifySessionToken(token, resolveSessionSecret()) : null;
  if (!payload) return { status: 401, body: { error: "NOT_AUTHENTICATED" } };
  const roleCheck = requireRole(payload.role, "ADMIN");
  if (!roleCheck.ok) return { status: 403, body: { error: roleCheck.error } };
  return { ok: true, payload };
}

const DB_ROLES = ["ADMIN", "WAREHOUSE", "WARD", "AUDITOR"];

export async function GET(request: NextRequest) {
  const guard = guardSession(request);
  if (!("ok" in guard)) {
    return NextResponse.json(guard.body, { status: guard.status });
  }
  const searchParams = request.nextUrl.searchParams;
  const where: Prisma.UserWhereInput = { hospitalId: "UTH" };
  const role = searchParams.get("role");
  if (role) {
    if (!DB_ROLES.includes(role)) {
      return NextResponse.json({ error: "INVALID_ROLE" }, { status: 400 });
    }
    where.role = role as UserRole;
  }
  const active = searchParams.get("active");
  if (active !== null) {
    if (active !== "true" && active !== "false") {
      return NextResponse.json({ error: "INVALID_ACTIVE" }, { status: 400 });
    }
    where.active = active === "true";
  }
  const users = await prisma.user.findMany({
    where,
    include: { wards: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      staffCode: u.staffCode,
      fullName: u.fullName,
      role: u.role,
      active: u.active,
      wards: u.wards.map((w) => w.wardId),
      createdAt: u.createdAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  const guard = guardSession(request);
  if (!("ok" in guard)) {
    return NextResponse.json(guard.body, { status: guard.status });
  }
  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.staffCode !== "string" ||
    typeof body.fullName !== "string" ||
    typeof body.password !== "string"
  ) {
    return NextResponse.json(
      { error: "staffCode, fullName, password เป็นข้อมูลจำเป็น" },
      { status: 400 }
    );
  }
  const role = body.role ?? "WARD";
  if (!DB_ROLES.includes(role)) {
    return NextResponse.json({ error: "INVALID_ROLE" }, { status: 400 });
  }
  if (body.password.length < 8) {
    return NextResponse.json({ error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" }, { status: 400 });
  }
  const staffCode = body.staffCode.trim().toUpperCase();
  if (!staffCode) {
    return NextResponse.json({ error: "INVALID_STAFF_CODE" }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({
    where: { hospitalId_staffCode: { hospitalId: "UTH", staffCode } },
  });
  if (existing) {
    return NextResponse.json({ error: "USER_EXISTS" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      hospitalId: "UTH",
      staffCode,
      fullName: body.fullName.trim(),
      role: role as UserRole,
      passwordHash: hashPassword(body.password),
      active: typeof body.active === "boolean" ? body.active : true,
      wards:
        Array.isArray(body.wards) && body.wards.length > 0
          ? { create: body.wards.map((wardId: string) => ({ wardId })) }
          : undefined,
    },
    include: { wards: true },
  });
  return NextResponse.json(
    {
      user: {
        id: user.id,
        staffCode: user.staffCode,
        fullName: user.fullName,
        role: user.role,
        active: user.active,
        wards: user.wards.map((w) => w.wardId),
      },
    },
    { status: 201 }
  );
}