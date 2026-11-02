import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  buildClearCookie,
  buildSetCookie,
  createSessionToken,
  hashPassword,
  parseCookies,
  resolveSessionSecret,
  verifyPassword,
  verifySessionToken,
} from "../../../lib/auth.mjs";

const HOSPITAL_ID = "UTH";

/** ค่า placeholder เพื่อให้เวลาวางานเท่ากับผู้ใช้จริง (ป้องกัน timing attack) */
const DUMMY_HASH = hashPassword("uth-dummy-password-2569");

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function recordLogin(userId: string | undefined, ip: string, success: boolean, failReason?: string) {
  if (!userId) return;
  try {
    await prisma.userLoginLog.create({
      data: { userId, ip, success, failReason },
    });
  } catch {
    // การบันทึก log ล้มเหลวไม่ควรทำให้ login/เช็คเซสชันล้มเหลวตาม
  }
}

function publicUser(user: {
  id: string;
  staffCode: string;
  fullName: string;
  role: string;
  active: boolean;
  wards?: { wardId: string }[];
}) {
  return {
    id: user.id,
    staffCode: user.staffCode,
    fullName: user.fullName,
    role: user.role,
    active: user.active,
    wards: user.wards?.map((w) => w.wardId) ?? [],
  };
}

/** POST /api/auth — ล็อกอิน (staffCode + password) → cookie เซสชัน */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.staffCode !== "string" ||
    typeof body.password !== "string"
  ) {
    return NextResponse.json(
      { error: "staffCode และ password เป็นข้อมูลจำเป็น" },
      { status: 400 }
    );
  }

  const ip = clientIp(request);
  const staffCode = body.staffCode.trim().toUpperCase();
  const user = staffCode
    ? await prisma.user.findUnique({
        where: { hospitalId_staffCode: { hospitalId: HOSPITAL_ID, staffCode } },
      })
    : null;

  // ใช้เวลาเท่ากันทั้งกรณีผู้ใช้มี/ไม่มี เพื่อไม่ให้จับ timing หารหัสบุคลากรได้
  const passwordOk = verifyPassword(body.password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !user.active || !passwordOk) {
    await recordLogin(user?.id, ip, false, "INVALID_CREDENTIALS");
    return NextResponse.json(
      { error: "รหัสบุคลากรหรือรหัสผ่านไม่ถูกต้อง" },
      { status: 401 }
    );
  }

  await recordLogin(user.id, ip, true);
  const token = createSessionToken(
    { sub: user.id, role: user.role },
    resolveSessionSecret()
  );
  return NextResponse.json({ user: publicUser(user) }, {
    headers: { "set-cookie": buildSetCookie(token) },
  });
}

/** GET /api/auth — เช็คเซสชันปัจจุบัน (จาก cookie) */
export async function GET(request: NextRequest) {
  const cookie = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE];
  let payload = cookie
    ? verifySessionToken(cookie, resolveSessionSecret())
    : null;
  if (!payload) {
    return NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { wards: true },
  });
  if (!user || !user.active) {
    return NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
  }
  return NextResponse.json({ user: publicUser(user) });
}

/** DELETE /api/auth — ออกจากระบบ (ล้าง cookie เซสชัน) */
export async function DELETE() {
  return NextResponse.json({ ok: true }, {
    headers: { "set-cookie": buildClearCookie() },
  });
}