-- CreateTable
CREATE TABLE `Plan` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `fiscalYear` INTEGER NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `approved` BOOLEAN NOT NULL DEFAULT false,
    `budget` DECIMAL(18, 2) NOT NULL,

    UNIQUE INDEX `Plan_hospitalId_id_key`(`hospitalId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseOrder` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `planId` CHAR(36) NOT NULL,
    `number` VARCHAR(80) NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'DRAFT',

    UNIQUE INDEX `PurchaseOrder_hospitalId_id_key`(`hospitalId`, `id`),
    UNIQUE INDEX `PurchaseOrder_hospitalId_number_key`(`hospitalId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `POLine` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `poId` CHAR(36) NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitCost` DECIMAL(18, 2) NOT NULL,

    UNIQUE INDEX `POLine_hospitalId_id_key`(`hospitalId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReceiptLine` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `poLineId` CHAR(36) NOT NULL,
    `documentNo` VARCHAR(80) NOT NULL,
    `acceptedQty` INTEGER NOT NULL,
    `acceptedAt` DATETIME(3) NOT NULL,
    `acceptedBy` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `ReceiptLine_hospitalId_id_key`(`hospitalId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Asset` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `wardId` CHAR(36) NOT NULL,
    `receiptId` CHAR(36) NOT NULL,
    `assetNo` VARCHAR(80) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `status` ENUM('AVAILABLE', 'IN_USE', 'REPAIR', 'QUARANTINED', 'DISPOSED') NOT NULL DEFAULT 'AVAILABLE',
    `version` INTEGER NOT NULL DEFAULT 0,
    `needsReview` BOOLEAN NOT NULL DEFAULT false,
    `cost` DECIMAL(18, 2) NOT NULL,

    INDEX `Asset_hospitalId_wardId_status_idx`(`hospitalId`, `wardId`, `status`),
    UNIQUE INDEX `Asset_hospitalId_id_key`(`hospitalId`, `id`),
    UNIQUE INDEX `Asset_hospitalId_assetNo_key`(`hospitalId`, `assetNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentClaim` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `poId` CHAR(36) NOT NULL,
    `claimNo` VARCHAR(80) NOT NULL,
    `revision` INTEGER NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    `amount` DECIMAL(18, 2) NOT NULL,
    `reason` VARCHAR(1000) NULL,

    UNIQUE INDEX `PaymentClaim_hospitalId_claimNo_revision_key`(`hospitalId`, `claimNo`, `revision`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JournalEntry` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `assetId` CHAR(36) NOT NULL,
    `referenceNo` VARCHAR(80) NOT NULL,
    `accountCode` VARCHAR(32) NOT NULL,
    `debit` DECIMAL(18, 2) NOT NULL,
    `credit` DECIMAL(18, 2) NOT NULL,
    `postedAt` DATETIME(3) NOT NULL,
    `reversalOf` CHAR(36) NULL,

    INDEX `JournalEntry_hospitalId_assetId_idx`(`hospitalId`, `assetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowException` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `poId` CHAR(36) NOT NULL,
    `type` VARCHAR(64) NOT NULL,
    `reason` VARCHAR(1000) NOT NULL,
    `ownerSubject` VARCHAR(191) NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    `dueAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WorkflowException_hospitalId_status_dueAt_idx`(`hospitalId`, `status`, `dueAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `assetId` CHAR(36) NOT NULL,
    `actorSubject` VARCHAR(191) NOT NULL,
    `providerRef` VARCHAR(191) NULL,
    `deviceId` CHAR(36) NOT NULL,
    `mutationId` CHAR(36) NOT NULL,
    `ip` VARCHAR(45) NOT NULL,
    `eventType` VARCHAR(64) NOT NULL,
    `detail` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_hospitalId_assetId_createdAt_idx`(`hospitalId`, `assetId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SyncReceipt` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `deviceId` CHAR(36) NOT NULL,
    `mutationId` CHAR(36) NOT NULL,
    `actorSubject` VARCHAR(191) NOT NULL,
    `requestHash` CHAR(64) NOT NULL,
    `result` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SyncReceipt_hospitalId_deviceId_mutationId_key`(`hospitalId`, `deviceId`, `mutationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConflictCase` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `assetId` CHAR(36) NOT NULL,
    `baseVersion` INTEGER NOT NULL,
    `currentVersion` INTEGER NOT NULL,
    `proposedStatus` ENUM('AVAILABLE', 'IN_USE', 'REPAIR', 'QUARANTINED', 'DISPOSED') NOT NULL,
    `deviceId` CHAR(36) NOT NULL,
    `mutationId` CHAR(36) NOT NULL,
    `status` VARCHAR(24) NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ConflictCase_hospitalId_assetId_status_idx`(`hospitalId`, `assetId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_hospitalId_planId_fkey` FOREIGN KEY (`hospitalId`, `planId`) REFERENCES `Plan`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `POLine` ADD CONSTRAINT `POLine_hospitalId_poId_fkey` FOREIGN KEY (`hospitalId`, `poId`) REFERENCES `PurchaseOrder`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReceiptLine` ADD CONSTRAINT `ReceiptLine_hospitalId_poLineId_fkey` FOREIGN KEY (`hospitalId`, `poLineId`) REFERENCES `POLine`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Asset` ADD CONSTRAINT `Asset_hospitalId_receiptId_fkey` FOREIGN KEY (`hospitalId`, `receiptId`) REFERENCES `ReceiptLine`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentClaim` ADD CONSTRAINT `PaymentClaim_hospitalId_poId_fkey` FOREIGN KEY (`hospitalId`, `poId`) REFERENCES `PurchaseOrder`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalEntry` ADD CONSTRAINT `JournalEntry_hospitalId_assetId_fkey` FOREIGN KEY (`hospitalId`, `assetId`) REFERENCES `Asset`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowException` ADD CONSTRAINT `WorkflowException_hospitalId_poId_fkey` FOREIGN KEY (`hospitalId`, `poId`) REFERENCES `PurchaseOrder`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConflictCase` ADD CONSTRAINT `ConflictCase_hospitalId_assetId_fkey` FOREIGN KEY (`hospitalId`, `assetId`) REFERENCES `Asset`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;
