-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospitalId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "receiptId" TEXT,
    "assetNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "version" INTEGER NOT NULL DEFAULT 0,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "cost" DECIMAL NOT NULL,
    CONSTRAINT "Asset_hospitalId_receiptId_fkey" FOREIGN KEY ("hospitalId", "receiptId") REFERENCES "ReceiptLine" ("hospitalId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Asset" ("assetNo", "cost", "hospitalId", "id", "name", "needsReview", "receiptId", "status", "version", "wardId") SELECT "assetNo", "cost", "hospitalId", "id", "name", "needsReview", "receiptId", "status", "version", "wardId" FROM "Asset";
DROP TABLE "Asset";
ALTER TABLE "new_Asset" RENAME TO "Asset";
CREATE INDEX "Asset_hospitalId_wardId_status_idx" ON "Asset"("hospitalId", "wardId", "status");
CREATE UNIQUE INDEX "Asset_hospitalId_id_key" ON "Asset"("hospitalId", "id");
CREATE UNIQUE INDEX "Asset_hospitalId_assetNo_key" ON "Asset"("hospitalId", "assetNo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
