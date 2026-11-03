import { PrismaClient } from "./backend/node_modules/@prisma/client/default.js";
import { hashPassword } from "./lib/auth.mjs";

// Login route uppercases staffCode (app/api/auth/route.ts), so the key MUST be stored
// uppercase to match what the user types. User asked for: username "admin" / password "admin".
const prisma = new PrismaClient({
  datasources: { db: { url: "file:///home/admin/Working/edr-new/prisma/dev.db" } },
});

const hash = hashPassword("admin");

await prisma.user.upsert({
  where: { hospitalId_staffCode: { hospitalId: "UTH", staffCode: "ADMIN" } },
  update: { passwordHash: hash, role: "ADMIN", fullName: "ผู้ดูแลระบบ (Admin)", active: true },
  create: {
    hospitalId: "UTH",
    staffCode: "ADMIN",
    fullName: "ผู้ดูแลระบบ (Admin)",
    role: "ADMIN",
    passwordHash: hash,
    active: true,
  },
});

// Remove the stray lowercase 'admin' row (never matches login, just clutters the table)
await prisma.user
  .deleteMany({ where: { staffCode: "admin" } })
  .catch(() => {});

console.log("Accounts now in DB:");
console.log(await prisma.user.findMany({ select: { staffCode: true, role: true }, orderBy: { staffCode: "asc" } }));
await prisma.$disconnect();
