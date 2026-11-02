export interface SessionPayload {
  sub: string;
  role: "ADMIN" | "WAREHOUSE" | "WARD" | "AUDITOR";
  iat: number;
  exp: number;
}

export declare const SESSION_COOKIE: string;
export declare const SESSION_TTL_SECONDS: number;
export declare const UI_ROLE_TO_DB_ROLE: Readonly<Record<string, string>>;
export declare const DB_ROLE_TO_UI_ROLE: Readonly<Record<string, string>>;

export declare function resolveSessionSecret(env?: NodeJS.ProcessEnv): string;
export declare function hashPassword(password: string): string;
export declare function verifyPassword(password: string, stored: string): boolean;
export declare function createSessionToken(
  payload: { sub: string; role: string },
  secret: string,
  ttlSeconds?: number
): string;
export declare function verifySessionToken(
  token: string,
  secret: string
): SessionPayload | null;
export declare function parseCookies(cookieHeader: string | null | undefined): Record<string, string>;
export declare function buildSetCookie(token: string, ttlSeconds?: number): string;
export declare function buildClearCookie(): string;
export declare function requireRole(
  sessionRole: string,
  allowedRoles: string | string[]
): { ok: true } | { ok: false; error: string };