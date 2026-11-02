import { PrismaClient } from "@prisma/client";
const c = new PrismaClient({ datasourceUrl: "file:./prisma/dev.db" });
console.log("user:", !!c.user, "userWard:", !!c.userWard, "loginLog:", !!c.userLoginLog);
await c.$disconnect();
