/**
 * บทบาท (RBAC) — matrix ฐาน + ward scoping สำหรับ API routes ของต้นแบบ
 *
 * เป็น pure ESM (ไม่ต้องใช้ Next) จึง import ได้ทั้งใน app/api/*.ts และ node:test.
 * ความสัมพันธ์กับ lib/auth.mjs:
 *   - บทบาทในเซสชันเป็น "DB role" (ADMIN | WAREHOUSE | WARD | AUDITOR) ตาม
 *     lib/auth.mjs → ตรงกับ enum UserRole ของ Prisma
 *
 * หน้าที่:
 *   - can(role, action): true/false
 *   - visibleWards(role, userWards): list ของ wardIds ที่ดูได้, หรือ null = ทุก ward
 *   - assetScopeWhere(role, userWards): where-clause สำหรับ Prisma (scoped โดย ward)
 *   - assetInScope(actor, asset): ตรวจสิทธิ์อ่าน asset เดียวตาม ward
 *   - actorFromUser(user): สรุป actor จาก user record (รวม wards + hospitalId)
 */

export const DB_ROLES = Object.freeze(["ADMIN", "WAREHOUSE", "WARD", "AUDITOR"]);

export const ALL_ACTIONS = Object.freeze([
  "assets:read",
  "assets:create",
  "assets:update",
  "assets:delete",
  "approvals:read",
  "approvals:create",
  "approvals:decide",
  "import:create",
  "users:manage",
  "ai:ask",
  "reports:export",
]);

/**
 * Matrix: บทบาท -> รายการ action ที่อนุญาต
 *
 *   ADMIN      ทุก action (รวม users:manage และ assets:delete)
 *   WAREHOUSE  จัดการ asset + approval + import + AI + report (ไม่มี users:manage / assets:delete)
 *   WARD       อ่าน asset ของ ward ที่ถูก assign + ขอ approval + AI (read-only สำหรับ asset)
 *   AUDITOR    อ่านทุก ward + อ่าน approval + export report (read-only ทั้งหมด)
 */
export const ROLE_ACTIONS = Object.freeze({
  ADMIN: Object.freeze([
    "assets:read",
    "assets:create",
    "assets:update",
    "assets:delete",
    "approvals:read",
    "approvals:create",
    "approvals:decide",
    "import:create",
    "users:manage",
    "ai:ask",
    "reports:export",
  ]),
  WAREHOUSE: Object.freeze([
    "assets:read",
    "assets:create",
    "assets:update",
    "approvals:read",
    "approvals:create",
    "approvals:decide",
    "import:create",
    "ai:ask",
    "reports:export",
  ]),
  WARD: Object.freeze(["assets:read", "approvals:read", "approvals:create", "ai:ask"]),
  AUDITOR: Object.freeze(["assets:read", "approvals:read", "ai:ask", "reports:export"]),
});

/** ตรวจสิทธิ์จาก role (unknown role => false เสมอ) */
export function can(role, action) {
  if (typeof role !== "string" || typeof action !== "string") return false;
  const allowed = ROLE_ACTIONS[role];
  if (!allowed) return false;
  return allowed.includes(action);
}

/**
 * wardIds ที่ role นี้มองเห็น:
 *   - WARD   -> ward ที่ถูก assign (ถ้าว่าง => ว่างเปล่า = ไม่เห็นอะไร)
 *   - อื่น ๆ   -> null หมายความว่า "ทุก ward"
 */
export function visibleWards(role, userWards) {
  if (role === "WARD") {
    const list = Array.isArray(userWards) ? userWards : [];
    return list
      .map((entry) => (typeof entry === "string" ? entry : entry?.wardId))
      .filter((id) => typeof id === "string" && id.length > 0);
  }
  return null;
}

/** where-clause สำหรับ Prisma: {} = ทุก ward, { wardId: { in: [...] } } = เฉพาะ ward */
export function assetScopeWhere(role, userWards) {
  const wards = visibleWards(role, userWards);
  if (wards === null) return {};
  if (wards.length === 0) return { wardId: { in: [] } };
  return { wardId: { in: wards } };
}

/** actor ที่ route ใช้ตรวจสอบสิทธิ์ (id / role / hospitalId / wards: string[]) */
export function actorFromUser(user) {
  if (!user || typeof user !== "object") {
    return { id: null, role: null, hospitalId: null, wards: [] };
  }
  const wards = Array.isArray(user.wards)
    ? user.wards
        .map((entry) => (typeof entry === "string" ? entry : entry?.wardId))
        .filter((id) => typeof id === "string" && id.length > 0)
    : [];
  return {
    id: user.id ?? null,
    role: typeof user.role === "string" ? user.role : null,
    hospitalId: user.hospitalId ?? null,
    wards,
  };
}

/** asset เดียวอยู่ใน scope ของ actor หรือไม่ (ตาม role + ward) */
export function assetInScope(actor, asset) {
  if (!actor || !asset) return false;
  if (actor.role === "ADMIN" || actor.role === "WAREHOUSE" || actor.role === "AUDITOR") {
    return true;
  }
  if (actor.role === "WARD") {
    const wards = Array.isArray(actor.wards) ? actor.wards : [];
    return wards.includes(asset.wardId);
  }
  return false;
}

/** actor + asset อยู่คนละ hospital? (multi-hospital: ห้ามข้าม) */
export function assetInHospital(actor, asset) {
  if (!actor || !asset) return false;
  if (actor.hospitalId == null) return true; // ยังไม่ได้จำกัด hospital
  return asset.hospitalId === actor.hospitalId;
}

/* ---- bridge: session cookie -> actor (testable pure fn, takes header + secret) ---- */
import { parseCookies, verifySessionToken, SESSION_COOKIE } from "./auth.mjs";

/**
 * สร้าง actor จาก session cookie header (รับ secret เป็นพารามิเตอร์เพื่อ unit-test ได้)
 * - ไม่มี cookie / token เสีย / หมดอายุ  -> { ok:false, status:401, error }
 * - ผ่าน   -> { ok:true, actor: { id, role, hospitalId, wards: string[] } }
 */
export function resolveSessionActor(cookieHeader, secret) {
  const token = parseCookies(cookieHeader)[SESSION_COOKIE];
  if (!token) return { ok: false, status: 401, error: "UNAUTHENTICATED" };
  const payload = verifySessionToken(token, secret);
  if (!payload || typeof payload.sub !== "string") {
    return { ok: false, status: 401, error: "UNAUTHENTICATED" };
  }
  const wards = Array.isArray(payload.wards)
    ? payload.wards
        .map((w) => (typeof w === "string" ? w : w?.wardId ?? null))
        .filter((id) => typeof id === "string" && id.length > 0)
    : [];
  return {
    ok: true,
    actor: {
      id: payload.sub,
      role: typeof payload.role === "string" ? payload.role : null,
      hospitalId: typeof payload.hospitalId === "string" ? payload.hospitalId : null,
      wards,
    },
  };
}