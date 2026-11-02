import type { FastifyInstance, FastifyReply } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { createAccessToken, hashPassword, verifyPassword, type JwtConfig } from "../auth.js";

export interface AuthRouteOptions {
  db: PrismaClient;
  config: JwtConfig;
  /** เปิดเฉพาะสิ่งแวดล้อมทดสอบ/ติดตั้งภายในเท่านั้น */
  allowUserSeeding?: boolean;
}

// deviceId สำรองสำหรับเบราว์เซอร์ที่ไม่ได้ผูกแท็บเล็ต (ยังต้องเป็น UUID ตาม claims schema)
const DEFAULT_WEB_DEVICE_ID = "00000000-0000-0000-0000-000000000000";

const ROLE_ENUM = z.enum(["ADMIN", "WAREHOUSE", "WARD", "AUDITOR"]);

const loginSchema = z
  .object({
    hospitalId: z.uuid(),
    staffCode: z.string().trim().min(1).max(64),
    password: z.string().min(8).max(128),
    deviceId: z.uuid().optional(),
  })
  .strict();

const seedSchema = z
  .object({
    hospitalId: z.uuid(),
    staffCode: z.string().trim().min(1).max(64),
    fullName: z.string().trim().min(1).max(191),
    role: ROLE_ENUM,
    password: z.string().min(8).max(128),
    wardIds: z.array(z.uuid()).max(500).default([]),
  })
  .strict();

function sendError(reply: FastifyReply, status: number, message: string) {
  return reply.code(status).send({ error: message });
}

async function logLogin(
  db: PrismaClient,
  userId: string,
  ip: string,
  success: boolean,
  failReason?: string,
): Promise<void> {
  await db.userLoginLog
    .create({ data: { userId, ip, success, failReason } })
    .catch(() => {}); // บันทึก log ไม่ได้ต้องไม่บล็อกการล็อกอิน
}

/** Login + RBAC: ตรวจรหัสพนักงาน/รหัสผ่านในฐานข้อมูลแล้วออก access token RS256
 * คำตอบผิดพลาดไม่เปิดเผยว่าผู้ใช้มีอยู่จริงหรือไม่ (ป้องกันการสแกนรายชื่อพนักงาน) */
export async function authRoutes(app: FastifyInstance, options: AuthRouteOptions): Promise<void> {
  const { db, config } = options;

  app.post("/api/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body ?? null);
    if (!parsed.success) return sendError(reply, 400, "Invalid login request");
    const { hospitalId, staffCode, password, deviceId } = parsed.data;
    const user = await db.user.findUnique({
      where: { hospitalId_staffCode: { hospitalId, staffCode } },
      include: { wards: true },
    });
    if (!user) return sendError(reply, 401, "Invalid staff code or password");
    if (!user.active) {
      await logLogin(db, user.id, req.ip, false, "inactive account");
      return sendError(reply, 401, "Invalid staff code or password");
    }
    if (!verifyPassword(password, user.passwordHash)) {
      await logLogin(db, user.id, req.ip, false, "bad password");
      return sendError(reply, 401, "Invalid staff code or password");
    }
    if (!config.signingKeyPem) return sendError(reply, 503, "JWT_SIGNING_KEY_NOT_CONFIGURED");
    const token = createAccessToken({
      sub: user.id,
      hospitalId: user.hospitalId,
      deviceId: deviceId ?? DEFAULT_WEB_DEVICE_ID,
      roles: [user.role],
      wards: user.wards.map(ward => ward.wardId),
    }, config);
    await logLogin(db, user.id, req.ip, true);
    return reply.code(200).send({
      token,
      tokenType: "Bearer",
      expiresIn: config.tokenTtlSeconds,
      user: {
        id: user.id,
        staffCode: user.staffCode,
        fullName: user.fullName,
        hospitalId: user.hospitalId,
        role: user.role,
        wards: user.wards.map(ward => ward.wardId),
      },
    });
  });

  if (options.allowUserSeeding) {
    app.post("/api/users/seed", async (req, reply) => {
      const parsed = seedSchema.safeParse(req.body ?? null);
      if (!parsed.success) return sendError(reply, 400, "Invalid user seed request");
      const data = parsed.data;
      const user = await db.user.upsert({
        where: { hospitalId_staffCode: { hospitalId: data.hospitalId, staffCode: data.staffCode } },
        update: {
          fullName: data.fullName,
          role: data.role,
          passwordHash: hashPassword(data.password),
          active: true,
        },
        create: {
          hospitalId: data.hospitalId,
          staffCode: data.staffCode,
          fullName: data.fullName,
          role: data.role,
          passwordHash: hashPassword(data.password),
        },
      });
      // ตั้ง ward scope ใหม่ทั้งก้อน: ลบ link เก่าที่ไม่ได้อยู่ในรายการแล้ว create ใหม่
      await db.userWard.deleteMany({
        where: { userId: user.id, NOT: { wardId: { in: data.wardIds } } },
      });
      if (data.wardIds.length > 0) {
        await db.userWard.createMany({
          data: data.wardIds.map(wardId => ({ userId: user.id, wardId })),
        });
      }
      const wards = await db.userWard.findMany({ where: { userId: user.id } });
      return reply.code(200).send({
        id: user.id,
        staffCode: user.staffCode,
        fullName: user.fullName,
        role: user.role,
        wards: wards.map(ward => ward.wardId),
      });
    });
  }
}

export default authRoutes;