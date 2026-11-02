import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Prisma-backed authentication helpers (pure ESM — ใช้ใน API routes ได้ และ node:test รันตรงได้)
 *
 * - hashPassword/verifyPassword: scrypt ในรูปแบบเดียวกับ backend/src/auth.ts
 *   (`scrypt$N$r$p$salt$hash`) เพื่อความเข้ากันได้
 * - createSessionToken/verifySessionToken: โทเคน `v1.<payload>.<hmac-sha256>`
 *   ลงนามด้วย HMAC-SHA256 + เปรียบเทียบ timing-safe
 * - parseCookies / buildSetCookie / buildClearCookie: ทำงานกับค่า cookie header ได้ทั้ง
 *   browser (หน้า login) และ Node (API routes)
 * - UI_ROLE_TO_DB_ROLE / DB_ROLE_TO_UI_ROLE: 12 บทบาท UI ↔ 4 บทบาท Prisma (UserRole)
 */

export const SESSION_COOKIE = "uth_session";
/** ระยะเวลาเซสชัน: 8 ชั่วโมง */
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

const SCRYPT_PARAMS = Object.freeze({ N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const SCRYPT_KEYLEN = 64;
const SESSION_VERSION = "v1";
const SECRET_WARNING = { shown: false };

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function fromBase64url(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(prefix, secret) {
  return createHmac("sha256", secret).update(prefix).digest();
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * หา secret สำหรับเซสชัน — แนะนำให้ตั้ง `AUTH_SESSION_SECRET` เสมอ;
 * production บังคับต้องมี (ป้องกันใช้ secret สำรองในเว็บจริง)
 */
export function resolveSessionSecret(env = process.env) {
  if (env.AUTH_SESSION_SECRET) return env.AUTH_SESSION_SECRET;
  if (env.NODE_ENV === "production") {
    throw new Error("AUTH_SESSION_SECRET is required in production");
  }
  if (!SECRET_WARNING.shown) {
    SECRET_WARNING.shown = true;
    console.warn("[auth] AUTH_SESSION_SECRET ไม่ได้ตั้ง — ใช้ dev fallback (ห้ามใช้กับ production)");
  }
  return "uth-dev-session-secret-do-not-use-in-production";
}

/** scrypt hash — รูปแบบ `scrypt$N$r$p$salt$hash` */
export function hashPassword(password) {
  if (typeof password !== "string" || password.length === 0) {
    throw new TypeError("password must be a non-empty string");
  }
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS).toString("hex");
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt}$${derived}`;
}

/** ตรวจรหัสผ่านเทียบกับ hash ที่จัดเก็บ (timing-safe) */
export function verifyPassword(password, stored) {
  if (typeof password !== "string" || typeof stored !== "string") return false;
  const [scheme, n, r, p, salt, expectedHex] = stored.split("$");
  if (
    scheme !== "scrypt" ||
    !/^[1-9]\d*$/.test(n ?? "") ||
    !/^[1-9]\d*$/.test(r ?? "") ||
    !/^[1-9]\d*$/.test(p ?? "") ||
    !salt ||
    !expectedHex
  ) {
    return false;
  }
  const expected = Buffer.from(expectedHex, "hex");
  if (expected.length !== SCRYPT_KEYLEN) return false;
  try {
    const derived = scryptSync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT_PARAMS.maxmem,
    });
    return derived.length === expected.length && safeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** ออก session token — `v1.<base64url(JSON)>.<base64url(HMAC-SHA256)>` */
export function createSessionToken(payload, secret, ttlSeconds = SESSION_TTL_SECONDS) {
  if (!payload || typeof payload.sub !== "string" || typeof payload.role !== "string") {
    throw new TypeError("payload must include sub and role");
  }
  if (typeof secret !== "string" || secret.length === 0) throw new TypeError("secret is required");
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(JSON.stringify({ iat: now, exp: now + ttlSeconds, ...payload }));
  const signature = base64url(sign(`${SESSION_VERSION}.${body}`, secret));
  return `${SESSION_VERSION}.${body}.${signature}`;
}

/** ตรวจ session token — คืน payload ถ้าถูกต้อง, `null` ถ้าลายเซ็นผิด/หมดอายุ/รูปแบบเสีย */
export function verifySessionToken(token, secret) {
  if (typeof token !== "string" || typeof secret !== "string" || secret.length === 0) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0) || parts[0] !== SESSION_VERSION) {
    return null;
  }
  const expected = sign(`${SESSION_VERSION}.${parts[1]}`, secret);
  let signature;
  try {
    signature = Buffer.from(parts[2], "base64url");
  } catch {
    return null;
  }
  if (!safeEqual(expected, signature)) return null;
  let payload;
  try {
    payload = JSON.parse(fromBase64url(parts[1]));
  } catch {
    return null;
  }
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return null;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= now) return null;
  if (typeof payload.sub !== "string" || typeof payload.role !== "string") return null;
  return payload;
}

/** อ่านค่าจาก cookie header (`name=value; name2=value2`) → object */
export function parseCookies(cookieHeader) {
  const result = {};
  if (typeof cookieHeader !== "string") return result;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    result[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return result;
}

/** สร้างค่า Set-Cookie สำหรับเซสชัน */
export function buildSetCookie(token, ttlSeconds = SESSION_TTL_SECONDS) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ttlSeconds}`;
}

/** สร้างค่า Set-Cookie สำหรับล้างเซสชัน */
export function buildClearCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** 12 บทบาท UI (lib/users.mjs) ↔ 4 บทบาทใน Prisma UserRole */
export const UI_ROLE_TO_DB_ROLE = Object.freeze({
  executive: "ADMIN",
  admin: "ADMIN",
  approver: "ADMIN",
  committee: "ADMIN",
  warehouse: "WAREHOUSE",
  procurement: "WAREHOUSE",
  nurse: "WARD",
  finance: "WARD",
  accounting: "WARD",
  legal: "WARD",
  strategy: "WARD",
  auditor: "AUDITOR",
});

export const DB_ROLE_TO_UI_ROLE = Object.freeze({
  ADMIN: "admin",
  WAREHOUSE: "warehouse",
  WARD: "nurse",
  AUDITOR: "auditor",
});

/** ตรวจสิทธิ์จาก role ในเซสชัน (เช่น ต้องการ "ADMIN") */
export function requireRole(sessionRole, allowedRoles) {
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (allowed.includes(sessionRole)) return { ok: true };
  return { ok: false, error: "PERMISSION_DENIED" };
}