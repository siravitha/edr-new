import Fastify from "fastify";
import { createHash } from "node:crypto";
import { Prisma, PrismaClient, AssetStatus } from "@prisma/client";
import { z } from "zod";
import { loadJwtConfig, verifyAccessToken, type AccessClaims } from "./auth.js";
import { authRoutes } from "./routes/auth.js";

const app = Fastify({ logger: { redact: ["req.headers.authorization"] }, bodyLimit: 4096, trustProxy: false });
const db = new PrismaClient();
// เธฃเธฐเธเธฑเธเธเธณเธชเธฑเนเธเธเธฃเธดเธเธเธเธเธงเนเธฒเธเธฐเธกเธตเธเนเธขเธเธฒเธขเธญเธเธธเธกเธฑเธ•เธดเนเธฅเธฐ trusted policy integration เนเธกเนเธกเธตเธ—เธฒเธเธเนเธฒเธกเธเนเธฒเธ env
const offlinePolicyStatus: string = 'UNSPECIFIED';
const jwtConfig = loadJwtConfig();
// เธเธฒเธ”เธเธฒเธฃเธ•เธฑเนเธเธเนเธฒเธ•เธฑเธงเธ•เธเธเธฐเนเธกเนเน€เธเธดเธ”เน€เธเธดเธฃเนเธเน€เธงเธญเธฃเน
const commandSchema = z.object({
  mutationId: z.uuid(),
  assetId: z.uuid(),
  baseVersion: z.number().int().nonnegative().max(2147483646),
  status: z.enum(["AVAILABLE", "IN_USE", "REPAIR", "QUARANTINED"]),
  reason: z.string().trim().min(3).max(500).refine(s => !/[\x00-\x1f\x7f]/.test(s)),
}).strict();
class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}
const transitions: Record<AssetStatus, readonly AssetStatus[]> = {
  AVAILABLE: ["IN_USE", "REPAIR", "QUARANTINED"],
  IN_USE: ["AVAILABLE", "REPAIR", "QUARANTINED"],
  REPAIR: ["QUARANTINED"],
  QUARANTINED: ["REPAIR"],
  DISPOSED: [],
};

app.get("/api/health", async () => ({ status: "ok", integration: "not-configured" }));
// Login + RBAC routes (login endpoint; user seeding only when ALLOW_USER_SEEDING=true)
app.register(authRoutes, { db, config: jwtConfig, allowUserSeeding: process.env.ALLOW_USER_SEEDING === "true" });
app.post("/api/sync", async (req, reply) => {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) throw new HttpError(401, "Authentication required");
  let claims: AccessClaims;
  try {
    claims = verifyAccessToken(authorization.slice(7), jwtConfig);
  } catch { throw new HttpError(401, "Invalid access token"); }
  if (!claims.roles.some(r => r === "WAREHOUSE" || r === "WARD")) {
    throw new HttpError(403, "Operational role required");
  }
  const parsed = commandSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Invalid sync command");
  const cmd = parsed.data;
  if (!claims.roles.includes("WAREHOUSE") && !["IN_USE", "REPAIR"].includes(cmd.status)) {
    throw new HttpError(403, "Ward role may only request IN_USE or REPAIR");
  }
  if (offlinePolicyStatus !== 'APPROVED') throw new HttpError(503, 'OFFLINE_POLICY_UNAPPROVED');
  // เธชเธฃเนเธฒเธเธฅเธณเธ”เธฑเธเธเธดเธฅเธ”เนเนเธเนเธเธญเธ เนเธฅเธฐเนเธกเนเนเธเนเน€เธงเธฅเธฒเน€เธเธฃเธทเนเธญเธเธ•เธฑเธ”เธชเธดเธเธเนเธญเธเธฑเธ”เนเธขเนเธ
  const requestHash = createHash("sha256").update(JSON.stringify([
    cmd.mutationId, cmd.assetId, cmd.baseVersion, cmd.status, cmd.reason,
  ])).digest("hex");
  const receiptKey = { hospitalId: claims.hospitalId, deviceId: claims.deviceId, mutationId: cmd.mutationId };
  const readExisting = async (client: Prisma.TransactionClient | PrismaClient) => {
    const receipt = await client.syncReceipt.findUnique({ where: { hospitalId_deviceId_mutationId: receiptKey } });
    if (receipt && (receipt.requestHash !== requestHash || receipt.actorSubject !== claims.sub)) {
      throw new HttpError(409, "Mutation identifier already used");
    }
    return receipt;
  };
  let result: Prisma.JsonValue;
  try {
    result = await db.$transaction(async tx => {
      // เธฅเนเธญเธเธเธฃเธธเธ เธฑเธ“เธ‘เนเนเธเนเธฃเธเธเธขเธฒเธเธฒเธฅเธ—เธตเนเธฃเธฐเธเธธเนเธเนเธ—เน€เธเธเน€เธ—เนเธฒเธเธฑเนเธ
      const rows = await tx.$queryRaw<Array<{ id: string; wardId: string; status: AssetStatus; version: number; needsReview: boolean }>>`
        SELECT id, wardId, status, version, needsReview FROM Asset
        WHERE hospitalId = ${claims.hospitalId} AND id = ${cmd.assetId} FOR UPDATE
      `;
      const asset = rows[0];
      if (!asset || !claims.wards.includes(asset.wardId)) throw new HttpError(404, "Asset unavailable");
      const previous = await readExisting(tx);
      if (previous) return previous.result;
      const mismatch = asset.version !== cmd.baseVersion;
      let response: Prisma.InputJsonObject;
      if (mismatch) {
        const conflict = await tx.conflictCase.create({ data: {
          ...receiptKey, assetId: asset.id, baseVersion: cmd.baseVersion,
          currentVersion: asset.version, proposedStatus: cmd.status,
        } });
        await tx.asset.update({ where: { id: asset.id }, data: { needsReview: true } });
        response = { outcome: "CONFLICT", conflictId: conflict.id, version: asset.version };
      } else {
        if (asset.needsReview) throw new HttpError(409, "Supervisor review required");
        if (!transitions[asset.status].includes(cmd.status)) throw new HttpError(422, "Transition prohibited");
        await tx.asset.update({ where: { id: asset.id }, data: { status: cmd.status, version: { increment: 1 } } });
        response = { outcome: "APPLIED", version: asset.version + 1, status: cmd.status };
      }
      await tx.auditLog.create({ data: {
        ...receiptKey, assetId: asset.id, actorSubject: claims.sub,
        providerRef: claims.providerRef, ip: req.ip,
        eventType: mismatch ? "OFFLINE_CONFLICT" : "ASSET_STATUS_CHANGED",
        detail: { before: asset.status, baseVersion: cmd.baseVersion, reason: cmd.reason, proposed: cmd.status, result: response },
      } });
      await tx.syncReceipt.create({ data: { ...receiptKey, actorSubject: claims.sub, requestHash, result: response } });
      return response as Prisma.JsonObject;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 3000, timeout: 5000 });
  } catch (error) {
    // เธเธณเธชเธฑเนเธเธเนเธณเธ•เนเธฒเธเธเธฃเธธเธ เธฑเธ“เธ‘เนเธญเธฒเธเธเธ unique key เธซเธฅเธฑเธเธญเธตเธเธเธธเธฃเธเธฃเธฃเธก commit
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await readExisting(db);
      if (!existing) throw error;
      result = existing.result;
    } else if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2028"].includes(error.code)) {
      reply.header("Retry-After", "2");
      throw new HttpError(503, "Retry the same mutation identifier");
    } else { throw error; }
  }
  const isConflict = result !== null && typeof result === "object" && !Array.isArray(result)
    && result.outcome === "CONFLICT";
  return reply.code(isConflict ? 409 : 200).send(result);
});
app.setErrorHandler((error, _req, reply) => {
  const nativeStatus = typeof error === "object" && error !== null && "statusCode" in error
    ? error.statusCode : undefined;
  const status = error instanceof HttpError ? error.statusCode
    : nativeStatus === 400 || nativeStatus === 413 ? nativeStatus : 500;
  if (status === 500) app.log.error({ err: error }, "Request failed");
  const message = error instanceof HttpError ? error.message
    : status === 400 ? "Invalid request body"
    : status === 413 ? "Request body too large" : "Internal server error";
  reply.code(status).send({ error: message });
});
app.addHook("onClose", async () => { await db.$disconnect(); });
await app.listen({ port: Number(process.env.PORT ?? 3001), host: process.env.HOST ?? "127.0.0.1" });
