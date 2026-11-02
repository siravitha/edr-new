import {
  createPrivateKey,
  createPublicKey,
  randomBytes,
  scryptSync,
  sign as cryptoSign,
  timingSafeEqual,
  verify as cryptoVerify,
} from "node:crypto";

export const KNOWN_ROLES = ["ADMIN", "WAREHOUSE", "WARD", "AUDITOR"] as const;
type KnownRole = (typeof KNOWN_ROLES)[number];

/** ความผิดพลาดด้านตัวตน/สิทธิ์ — เซิร์ฟเวอร์แปลงเป็น 401 โดยไม่รั่วข้อมูล */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export interface JwtConfig {
  issuer: string;
  audience: string;
  publicKeyPem: string;
  /** กุญแจ RSA เอกสาร (PKCS#8 PEM) สำหรับออกโทเคนตอนล็อกอิน; ไม่มี = ปิดการออกโทเคน */
  signingKeyPem?: string;
  clockToleranceSeconds: number;
  maxTokenAgeSeconds: number;
  tokenTtlSeconds: number;
}

/** อ่านค่าจาก env เดิมกับ API sync ทุกตัว (JWT_ISSUER / JWT_AUDIENCE / JWT_PUBLIC_KEY_PEM)
 * รองรับ JWT_PRIVATE_KEY_PEM เพิ่มสำหรับการออกโทเคน */
export function loadJwtConfig(env: NodeJS.ProcessEnv = process.env): JwtConfig {
  const issuer = env.JWT_ISSUER;
  const audience = env.JWT_AUDIENCE;
  const publicKeyPem = env.JWT_PUBLIC_KEY_PEM?.replace(/\\n/g, "\n");
  if (!issuer || !audience || !publicKeyPem) throw new AuthError("JWT configuration required");
  const signingKeyPem = env.JWT_PRIVATE_KEY_PEM?.replace(/\\n/g, "\n");
  return {
    issuer,
    audience,
    publicKeyPem,
    signingKeyPem: signingKeyPem ? signingKeyPem : undefined,
    clockToleranceSeconds: 5,
    maxTokenAgeSeconds: 15 * 60,
    tokenTtlSeconds: 15 * 60,
  };
}

function base64UrlToJson(part: string, label: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    throw new AuthError(`Malformed ${label}`);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new AuthError(`Invalid ${label}`);
  }
  return value as Record<string, unknown>;
}

export function decodeJwtToken(token: string): {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signingInput: Buffer;
  signature: Buffer;
} {
  if (typeof token !== "string") throw new AuthError("Token must be a string");
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some(part => part.length === 0)) throw new AuthError("Malformed token");
  const header = base64UrlToJson(parts[0], "header");
  const payload = base64UrlToJson(parts[1], "payload");
  // รับเฉพาะ RS256 — ห้าม alg none หรืออัลกอริทึมอื่น
  if (header.alg !== "RS256") throw new AuthError("Unsupported algorithm");
  const signature = Buffer.from(parts[2], "base64url");
  if (signature.length === 0) throw new AuthError("Missing signature");
  return { header, payload, signingInput: Buffer.from(`${parts[0]}.${parts[1]}`, "utf8"), signature };
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AccessClaims {
  sub: string;
  hospitalId: string;
  deviceId: string;
  roles: readonly KnownRole[];
  wards: readonly string[];
  providerRef?: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

/** ตรวจลายมือชื่อ RS256 ด้วย node:crypto แล้วบังคับ claim มาตรฐาน (iss/aud/exp/iat/token_use/scope) */
export function verifyAccessToken(token: string, config: JwtConfig): AccessClaims {
  const { payload, signingInput, signature } = decodeJwtToken(token);
  if (cryptoVerify("RSA-SHA256", signingInput, createPublicKey(config.publicKeyPem), signature) !== true) {
    throw new AuthError("Invalid signature");
  }
  const nowMs = Date.now();
  const toleranceMs = config.clockToleranceSeconds * 1000;
  if (payload.iss !== config.issuer) throw new AuthError("Invalid issuer");
  if (payload.aud !== config.audience) throw new AuthError("Invalid audience");
  if (payload.token_use !== "access") throw new AuthError("Wrong token use");
  const { exp, iat } = payload;
  if (typeof exp !== "number" || !Number.isInteger(exp) || exp * 1000 < nowMs - toleranceMs) throw new AuthError("Token expired");
  if (typeof iat !== "number" || !Number.isInteger(iat) || iat * 1000 > nowMs + toleranceMs) throw new AuthError("Token issued in the future");
  if (nowMs - iat * 1000 > config.maxTokenAgeSeconds * 1000) throw new AuthError("Token too old");
  const { sub, hospitalId, deviceId, roles, wards, providerRef } = payload;
  if (typeof sub !== "string" || sub.length < 1 || sub.length > 191) throw new AuthError("Invalid subject");
  if (typeof hospitalId !== "string" || !UUID_RE.test(hospitalId)) throw new AuthError("Invalid hospital scope");
  if (typeof deviceId !== "string" || !UUID_RE.test(deviceId)) throw new AuthError("Invalid device scope");
  if (!Array.isArray(roles) || roles.length > 20 ||
      roles.some(role => typeof role !== "string" || !(KNOWN_ROLES as readonly string[]).includes(role))) {
    throw new AuthError("Invalid roles");
  }
  if (!Array.isArray(wards) || wards.length > 500 ||
      wards.some(ward => typeof ward !== "string" || !UUID_RE.test(ward))) {
    throw new AuthError("Invalid ward scope");
  }
  if (providerRef !== undefined &&
      (typeof providerRef !== "string" || providerRef.length < 1 || providerRef.length > 191)) {
    throw new AuthError("Invalid provider reference");
  }
  return {
    sub,
    hospitalId,
    deviceId,
    roles: roles as readonly KnownRole[],
    wards: wards as string[],
    providerRef: providerRef as string | undefined,
    iss: config.issuer,
    aud: config.audience,
    iat,
    exp,
  };
}
/** สุ่ม salt ต่อผู้ใช้งาน + scrypt (node:crypto) — ไม่ต้องพึ่ง native addon ใช้ออฟไลน์ได้ */
const SCRYPT_PARAMS = Object.freeze({ N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS).toString("hex");
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, n, r, p, salt, expectedHex] = stored.split("$");
  if (scheme !== "scrypt" || !/^[1-9]\d*$/.test(n ?? "") || !/^[1-9]\d*$/.test(r ?? "") ||
      !/^[1-9]\d*$/.test(p ?? "") || !salt || !expectedHex) {
    return false;
  }
  const expected = Buffer.from(expectedHex, "hex");
  if (expected.length !== SCRYPT_KEYLEN) return false;
  try {
    const derived = scryptSync(password, salt, expected.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT_PARAMS.maxmem,
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export interface AccessTokenInput {
  sub: string;
  hospitalId: string;
  deviceId: string;
  roles: readonly string[];
  wards: readonly string[];
  providerRef?: string;
}

/** ออก access token RS256 รูปแบบเดียวกับที่ฝั่งทดสอบลงนาม (header/payload/signature base64url) */
export function createAccessToken(input: AccessTokenInput, config: JwtConfig): string {
  if (!config.signingKeyPem) throw new AuthError("No signing key configured");
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" }), "utf8").toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: config.issuer,
    aud: config.audience,
    sub: input.sub,
    hospitalId: input.hospitalId,
    deviceId: input.deviceId,
    roles: input.roles,
    wards: input.wards,
    ...(input.providerRef ? { providerRef: input.providerRef } : {}),
    iat: now,
    exp: now + config.tokenTtlSeconds,
    token_use: "access",
  }), "utf8").toString("base64url");
  const signingInput = Buffer.from(`${header}.${payload}`, "utf8");
  const signature = cryptoSign("RSA-SHA256", signingInput, createPrivateKey(config.signingKeyPem)).toString("base64url");
  return `${header}.${payload}.${signature}`;
}