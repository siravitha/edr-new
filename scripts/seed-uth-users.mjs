/**
 * หนึ่งครั้ง: สร้างบัญชีทดลอง (4 บทบาท) ลง dev.db โดยตรง
 * ใช้ hashPassword เดียวกับระบบ (lib/auth.mjs) → เข้า log in ได้ทันที
 * รัน: node scripts/seed-uth-users.mjs
 */
import { PrismaClient } from "../backend/node_modules/@prisma/client/default.js";
import { hashPassword } from "../lib/auth.mjs";

const prisma = new PrismaClient({
  datasources: { db: { url: "file:///home/admin/Working/edr-new/prisma/dev.db" } },
});

const HOSPITAL_ID = "UTH";
const PASSWORD = "uth12345"; // รหัสผ่านร่วมสำหรับบัญชีทดลอง
const pwHash = hashPassword(PASSWORD);

const users = [
  { staffCode: "12345", fullName: "ผู้ดูแลระบบ (Admin)", role: "ADMIN" },
  { staffCode: "WARE-01", fullName: "เจ้าหน้าที่คลัง (Warehouse)", role: "WAREHOUSE" },
  { staffCode: "WARD-01", fullName: "พยาบาลหอผู้ป่วย (Ward)", role: "WARD" },
  { staffCode: "AUDIT-01", fullName: "ผู้ตรวจสอบ (Auditor)", role: "AUDITOR" },
];

for (const u of users) {
  await prisma.user.upsert({
    where: { hospitalId_staffCode: { hospitalId: HOSPITAL_ID, staffCode: u.staffCode } },
    update: { passwordHash: pwHash, fullName: u.fullName, role: u.role, active: true },
    create: {
      hospitalId: HOSPITAL_ID,
      staffCode: u.staffCode,
      fullName: u.fullName,
      role: u.role,
      passwordHash: pwHash,
      active: true,
    },
  });
  console.log("seeded", u.staffCode, "->", u.role);
}

console.log("total users =", await prisma.user.count());
await prisma.$disconnect();
