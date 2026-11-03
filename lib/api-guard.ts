import { cookies } from "next/headers";
import {
  parseCookies,
  resolveSessionSecret,
  verifySessionToken,
} from "./auth.mjs";
import {
  actorFromUser,
  assetInHospital,
  assetInScope,
  assetScopeWhere,
  can,
} from "./rbac.mjs";
import { prisma } from "./prisma";

export type AuthError = {
  ok: false;
  status: number;
  error: string;
  message: string;
};
export type AuthOk<T> = { ok: true; value: T };
export type AuthResult<T> = AuthError | AuthOk<T>;

function authError(status: number, error: string, message: string): AuthError {
  return { ok: false, status, error, message };
}

async function actorFromDb(
  userId: string,
  role: string,
  hospitalId: string | null,
): Promise<Record<string, unknown>> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wards: true },
    });
    if (user) return actorFromUser(user) as unknown as Record<string, unknown>;
  } catch {
    /* fall through to a minimal actor */
  }
  return { id: userId, role, hospitalId, wards: [] };
}

export async function getActor(
  request?: Request,
): Promise<AuthResult<Record<string, unknown>>> {
  try {
    const stored = await cookies();
    const raw = stored.get("uth_session")?.value;
    const header = raw
      ? `uth_session=${raw}`
      : (request?.headers?.get("cookie") ?? null);
    const cookieMap = parseCookies(header);
    const token = cookieMap["uth_session"];
    const payload = token
      ? verifySessionToken(token, resolveSessionSecret())
      : null;
    if (payload) {
      const hospitalId =
        (payload as { hospitalId?: string | null }).hospitalId ?? null;
      const actor = await actorFromDb(payload.sub, payload.role, hospitalId);
      return { ok: true, value: actor };
    }
  } catch {
    /* treat as unauthenticated */
  }
  return authError(401, "UNAUTHENTICATED", "Not authenticated.");
}

export function requireAction(
  result: AuthResult<Record<string, unknown>>,
  action: string,
): AuthResult<Record<string, unknown>> {
  if (result.ok === false) return result;
  const actor = result.value as { role?: string };
  if (!can(actor?.role, action)) {
    return authError(403, "FORBIDDEN", `Requires permission: ${action}`);
  }
  return result;
}

export function scopedWhere(actor: Record<string, unknown>): Record<string, unknown> {
  const a = actor as { role?: string; wards?: string[] };
  return assetScopeWhere(a?.role, a?.wards ?? []);
}

export function singleAssetOk(
  actor: Record<string, unknown>,
  asset: Record<string, unknown> | null,
): AuthResult<Record<string, unknown>> {
  if (!asset) return authError(404, "NOT_FOUND", "Asset not found.");
  if (!assetInHospital(actor, asset) || !assetInScope(actor, asset)) {
    return authError(404, "NOT_FOUND", "Asset not found.");
  }
  return { ok: true, value: asset };
}

export default { getActor, requireAction, scopedWhere, singleAssetOk };
