-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospitalId" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "budget" DECIMAL NOT NULL
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospitalId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    CONSTRAINT "PurchaseOrder_hospitalId_planId_fkey" FOREIGN KEY ("hospitalId", "planId") REFERENCES "Plan" ("hospitalId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "POLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospitalId" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL NOT NULL,
    CONSTRAINT "POLine_hospitalId_poId_fkey" FOREIGN KEY ("hospitalId", "poId") REFERENCES "PurchaseOrder" ("hospitalId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReceiptLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospitalId" TEXT NOT NULL,
    "poLineId" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "acceptedQty" INTEGER NOT NULL,
    "acceptedAt" DATETIME NOT NULL,
    "acceptedBy" TEXT NOT NULL,
    CONSTRAINT "ReceiptLine_hospitalId_poLineId_fkey" FOREIGN KEY ("hospitalId", "poLineId") REFERENCES "POLine" ("hospitalId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospitalId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "assetNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "version" INTEGER NOT NULL DEFAULT 0,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "cost" DECIMAL NOT NULL,
    CONSTRAINT "Asset_hospitalId_receiptId_fkey" FOREIGN KEY ("hospitalId", "receiptId") REFERENCES "ReceiptLine" ("hospitalId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospitalId" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "claimNo" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL NOT NULL,
    "reason" TEXT,
    CONSTRAINT "PaymentClaim_hospitalId_poId_fkey" FOREIGN KEY ("hospitalId", "poId") REFERENCES "PurchaseOrder" ("hospitalId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospitalId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "referenceNo" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "debit" DECIMAL NOT NULL,
    "credit" DECIMAL NOT NULL,
    "postedAt" DATETIME NOT NULL,
    "reversalOf" TEXT,
    CONSTRAINT "JournalEntry_hospitalId_assetId_fkey" FOREIGN KEY ("hospitalId", "assetId") REFERENCES "Asset" ("hospitalId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkflowException" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospitalId" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "ownerSubject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "dueAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowException_hospitalId_poId_fkey" FOREIGN KEY ("hospitalId", "poId") REFERENCES "PurchaseOrder" ("hospitalId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospitalId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "actorSubject" TEXT NOT NULL,
    "providerRef" TEXT,
    "deviceId" TEXT NOT NULL,
    "mutationId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SyncReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospitalId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "mutationId" TEXT NOT NULL,
    "actorSubject" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ConflictCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospitalId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "baseVersion" INTEGER NOT NULL,
    "currentVersion" INTEGER NOT NULL,
    "proposedStatus" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "mutationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConflictCase_hospitalId_assetId_fkey" FOREIGN KEY ("hospitalId", "assetId") REFERENCES "Asset" ("hospitalId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_hospitalId_id_key" ON "Plan"("hospitalId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_hospitalId_id_key" ON "PurchaseOrder"("hospitalId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_hospitalId_number_key" ON "PurchaseOrder"("hospitalId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "POLine_hospitalId_id_key" ON "POLine"("hospitalId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptLine_hospitalId_id_key" ON "ReceiptLine"("hospitalId", "id");

-- CreateIndex
CREATE INDEX "Asset_hospitalId_wardId_status_idx" ON "Asset"("hospitalId", "wardId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_hospitalId_id_key" ON "Asset"("hospitalId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_hospitalId_assetNo_key" ON "Asset"("hospitalId", "assetNo");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentClaim_hospitalId_claimNo_revision_key" ON "PaymentClaim"("hospitalId", "claimNo", "revision");

-- CreateIndex
CREATE INDEX "JournalEntry_hospitalId_assetId_idx" ON "JournalEntry"("hospitalId", "assetId");

-- CreateIndex
CREATE INDEX "WorkflowException_hospitalId_status_dueAt_idx" ON "WorkflowException"("hospitalId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "AuditLog_hospitalId_assetId_createdAt_idx" ON "AuditLog"("hospitalId", "assetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncReceipt_hospitalId_deviceId_mutationId_key" ON "SyncReceipt"("hospitalId", "deviceId", "mutationId");

-- CreateIndex
CREATE INDEX "ConflictCase_hospitalId_assetId_status_idx" ON "ConflictCase"("hospitalId", "assetId", "status");
