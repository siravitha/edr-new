-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospitalId" TEXT NOT NULL,
    "staffCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserWard" (
    "userId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    CONSTRAINT "UserWard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserLoginLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "failReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserLoginLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "User_hospitalId_active_idx" ON "User"("hospitalId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "User_hospitalId_staffCode_key" ON "User"("hospitalId", "staffCode");

-- CreateIndex
CREATE INDEX "UserWard_userId_idx" ON "UserWard"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserWard_userId_wardId_key" ON "UserWard"("userId", "wardId");

-- CreateIndex
CREATE INDEX "UserLoginLog_userId_createdAt_idx" ON "UserLoginLog"("userId", "createdAt");
