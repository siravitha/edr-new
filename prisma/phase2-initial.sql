-- CreateTable
CREATE TABLE `Fund` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `type` ENUM('ANNUAL_BUDGET', 'HOSPITAL_REVENUE', 'DONATION') NOT NULL,
    `purpose` TEXT NULL,
    `legalBasis` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `Fund_hospitalId_id_key`(`hospitalId`, `id`),
    UNIQUE INDEX `Fund_hospitalId_code_key`(`hospitalId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AnnualPlan` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `fiscalYear` INTEGER NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    `version` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `AnnualPlan_hospitalId_id_key`(`hospitalId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DemandRequest` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `planId` CHAR(36) NULL,
    `departmentId` CHAR(36) NOT NULL,
    `requestedBy` VARCHAR(191) NOT NULL,
    `workType` ENUM('PURCHASE', 'HIRE', 'SERVICE', 'MAINTENANCE', 'LEASE', 'CONSTRUCTION', 'DONATION_IN_KIND') NOT NULL,
    `rationale` TEXT NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    `version` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `DemandRequest_hospitalId_id_key`(`hospitalId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BudgetEnvelope` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `planId` CHAR(36) NOT NULL,
    `fundId` CHAR(36) NOT NULL,
    `fiscalYear` INTEGER NOT NULL,
    `departmentId` CHAR(36) NOT NULL,
    `allocatedSatang` BIGINT NOT NULL,
    `committedSatang` BIGINT NOT NULL DEFAULT 0,
    `paidSatang` BIGINT NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 0,

    INDEX `BudgetEnvelope_hospitalId_fiscalYear_fundId_departmentId_idx`(`hospitalId`, `fiscalYear`, `fundId`, `departmentId`),
    UNIQUE INDEX `BudgetEnvelope_hospitalId_id_key`(`hospitalId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProcurementCase` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `planId` CHAR(36) NOT NULL,
    `demandId` CHAR(36) NOT NULL,
    `prNo` VARCHAR(80) NOT NULL,
    `workType` ENUM('PURCHASE', 'HIRE', 'SERVICE', 'MAINTENANCE', 'LEASE', 'CONSTRUCTION', 'DONATION_IN_KIND') NOT NULL,
    `method` ENUM('SPECIFIC', 'E_MARKET', 'E_BIDDING', 'SELECTION', 'OTHER_LEGAL', 'NOT_APPLICABLE') NOT NULL,
    `legalBasis` VARCHAR(255) NOT NULL,
    `procedureVersion` VARCHAR(80) NOT NULL,
    `referencePriceSatang` BIGINT NULL,
    `torDocumentRef` CHAR(36) NULL,
    `egpReference` VARCHAR(100) NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'PR_DRAFT',
    `version` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `ProcurementCase_hospitalId_id_key`(`hospitalId`, `id`),
    UNIQUE INDEX `ProcurementCase_hospitalId_prNo_key`(`hospitalId`, `prNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contract` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `caseId` CHAR(36) NOT NULL,
    `number` VARCHAR(80) NOT NULL,
    `amountSatang` BIGINT NOT NULL,
    `signedAt` DATETIME(3) NULL,
    `signatureDocRef` CHAR(36) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    `version` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `Contract_hospitalId_id_key`(`hospitalId`, `id`),
    UNIQUE INDEX `Contract_hospitalId_number_key`(`hospitalId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Commitment` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `contractId` CHAR(36) NOT NULL,
    `budgetId` CHAR(36) NOT NULL,
    `amountSatang` BIGINT NOT NULL,
    `paidSatang` BIGINT NOT NULL DEFAULT 0,
    `releasedSatang` BIGINT NOT NULL DEFAULT 0,

    UNIQUE INDEX `Commitment_hospitalId_id_key`(`hospitalId`, `id`),
    UNIQUE INDEX `Commitment_hospitalId_contractId_budgetId_key`(`hospitalId`, `contractId`, `budgetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BudgetMovement` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `budgetId` CHAR(36) NOT NULL,
    `commitmentId` CHAR(36) NOT NULL,
    `operationId` CHAR(36) NOT NULL,
    `type` ENUM('COMMIT', 'PAY', 'RELEASE', 'ADJUST') NOT NULL,
    `amountSatang` BIGINT NOT NULL,
    `sourceRef` VARCHAR(100) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BudgetMovement_hospitalId_operationId_commitmentId_type_key`(`hospitalId`, `operationId`, `commitmentId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Delivery` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `contractId` CHAR(36) NOT NULL,
    `installmentNo` INTEGER NOT NULL,
    `acceptedSatang` BIGINT NOT NULL,
    `acceptedAt` DATETIME(3) NULL,
    `inspectionDocRef` CHAR(36) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',

    UNIQUE INDEX `Delivery_hospitalId_id_key`(`hospitalId`, `id`),
    UNIQUE INDEX `Delivery_hospitalId_contractId_installmentNo_key`(`hospitalId`, `contractId`, `installmentNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentClaim` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `contractId` CHAR(36) NOT NULL,
    `claimNo` VARCHAR(80) NOT NULL,
    `revision` INTEGER NOT NULL,
    `supersedesId` CHAR(36) NULL,
    `amountSatang` BIGINT NOT NULL,
    `makerId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    `returnReason` TEXT NULL,

    UNIQUE INDEX `PaymentClaim_hospitalId_id_key`(`hospitalId`, `id`),
    UNIQUE INDEX `PaymentClaim_hospitalId_claimNo_revision_key`(`hospitalId`, `claimNo`, `revision`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClaimDelivery` (
    `hospitalId` CHAR(36) NOT NULL,
    `claimId` CHAR(36) NOT NULL,
    `deliveryId` CHAR(36) NOT NULL,
    `amountSatang` BIGINT NOT NULL,

    PRIMARY KEY (`hospitalId`, `claimId`, `deliveryId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentPosting` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `claimId` CHAR(36) NOT NULL,
    `paymentRef` VARCHAR(100) NOT NULL,
    `operationId` CHAR(36) NOT NULL,
    `amountSatang` BIGINT NOT NULL,
    `confirmedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PaymentPosting_hospitalId_paymentRef_key`(`hospitalId`, `paymentRef`),
    UNIQUE INDEX `PaymentPosting_hospitalId_operationId_key`(`hospitalId`, `operationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DonationReceipt` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `fundId` CHAR(36) NOT NULL,
    `receiptNo` VARCHAR(80) NOT NULL,
    `purpose` TEXT NOT NULL,
    `acceptanceDocRef` CHAR(36) NOT NULL,
    `valueSatang` BIGINT NOT NULL,
    `acceptedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DonationReceipt_hospitalId_id_key`(`hospitalId`, `id`),
    UNIQUE INDEX `DonationReceipt_hospitalId_receiptNo_key`(`hospitalId`, `receiptNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ManagedResource` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `resourceNo` VARCHAR(80) NOT NULL,
    `type` ENUM('OWNED_ASSET', 'SUPPLY', 'SERVICE_DELIVERABLE', 'CONSTRUCTION_IN_PROGRESS', 'LEASED_EQUIPMENT') NOT NULL,
    `contractId` CHAR(36) NULL,
    `deliveryId` CHAR(36) NULL,
    `donationId` CHAR(36) NULL,
    `policyId` CHAR(36) NULL,
    `costSatang` BIGINT NOT NULL,
    `residualSatang` BIGINT NOT NULL,
    `availableForUseAt` DATE NULL,
    `operationalStatus` VARCHAR(32) NOT NULL DEFAULT 'QUARANTINED',
    `custodianDepartmentId` CHAR(36) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `ManagedResource_hospitalId_id_key`(`hospitalId`, `id`),
    UNIQUE INDEX `ManagedResource_hospitalId_resourceNo_key`(`hospitalId`, `resourceNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustodyEvent` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `resourceId` CHAR(36) NOT NULL,
    `fromDepartmentId` CHAR(36) NULL,
    `toDepartmentId` CHAR(36) NOT NULL,
    `senderId` VARCHAR(191) NOT NULL,
    `receiverId` VARCHAR(191) NOT NULL,
    `signedDocRef` CHAR(36) NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MaintenanceOrder` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `resourceId` CHAR(36) NOT NULL,
    `reportedBy` VARCHAR(191) NOT NULL,
    `diagnosis` TEXT NOT NULL,
    `repairCaseRef` CHAR(36) NULL,
    `costSatang` BIGINT NOT NULL DEFAULT 0,
    `status` VARCHAR(32) NOT NULL DEFAULT 'REPORTED',
    `safetyReleaseDocRef` CHAR(36) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DepreciationPolicy` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `categoryCode` VARCHAR(64) NOT NULL,
    `revision` INTEGER NOT NULL,
    `method` VARCHAR(32) NOT NULL,
    `lifetimeMonths` INTEGER NOT NULL,
    `prorationRule` VARCHAR(80) NOT NULL,
    `roundingRule` VARCHAR(80) NOT NULL,
    `legalRef` VARCHAR(255) NOT NULL,
    `approvedBy` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `effectiveFrom` DATE NOT NULL,

    UNIQUE INDEX `DepreciationPolicy_hospitalId_id_key`(`hospitalId`, `id`),
    UNIQUE INDEX `DepreciationPolicy_hospitalId_categoryCode_revision_key`(`hospitalId`, `categoryCode`, `revision`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DepreciationPosting` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `resourceId` CHAR(36) NOT NULL,
    `period` CHAR(7) NOT NULL,
    `adjustmentNo` INTEGER NOT NULL DEFAULT 0,
    `policySnapshot` JSON NOT NULL,
    `expenseSatang` BIGINT NOT NULL,
    `accumulatedSatang` BIGINT NOT NULL,
    `journalRef` CHAR(36) NOT NULL,

    UNIQUE INDEX `DepreciationPosting_hospitalId_resourceId_period_adjustmentN_key`(`hospitalId`, `resourceId`, `period`, `adjustmentNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Journal` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `number` VARCHAR(80) NOT NULL,
    `period` CHAR(7) NOT NULL,
    `sourceRef` VARCHAR(100) NOT NULL,
    `reversalOfId` CHAR(36) NULL,
    `postedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Journal_hospitalId_id_key`(`hospitalId`, `id`),
    UNIQUE INDEX `Journal_hospitalId_number_key`(`hospitalId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JournalLine` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `journalId` CHAR(36) NOT NULL,
    `accountCode` VARCHAR(32) NOT NULL,
    `debitSatang` BIGINT NOT NULL DEFAULT 0,
    `creditSatang` BIGINT NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InventoryObservation` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `resourceId` CHAR(36) NOT NULL,
    `fiscalYear` INTEGER NOT NULL,
    `inspectorId` VARCHAR(191) NOT NULL,
    `physicallyPresent` BOOLEAN NOT NULL,
    `condition` VARCHAR(80) NOT NULL,
    `evidenceDocRef` CHAR(36) NOT NULL,
    `observedAt` DATETIME(3) NOT NULL,

    INDEX `InventoryObservation_hospitalId_fiscalYear_resourceId_idx`(`hospitalId`, `fiscalYear`, `resourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DisposalCase` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `resourceId` CHAR(36) NOT NULL,
    `reason` TEXT NOT NULL,
    `method` VARCHAR(40) NOT NULL,
    `proposerId` VARCHAR(191) NOT NULL,
    `approverId` VARCHAR(191) NULL,
    `approvalDocRef` CHAR(36) NULL,
    `executionDocRef` CHAR(36) NULL,
    `executionAt` DATETIME(3) NULL,
    `proceedsSatang` BIGINT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'PROPOSED',
    `version` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `DisposalCase_hospitalId_id_key`(`hospitalId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentRevision` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `documentNo` VARCHAR(80) NOT NULL,
    `revision` INTEGER NOT NULL,
    `state` ENUM('DRAFT', 'FROZEN', 'AWAITING_INK', 'SCAN_RECEIVED', 'VERIFIED', 'SUPERSEDED') NOT NULL DEFAULT 'DRAFT',
    `originalPdfHash` BINARY(32) NULL,
    `signedScanHash` BINARY(32) NULL,
    `objectRef` VARCHAR(255) NOT NULL,
    `paperLocation` VARCHAR(255) NULL,
    `verifiedBy` VARCHAR(191) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `supersedesId` CHAR(36) NULL,

    UNIQUE INDEX `DocumentRevision_hospitalId_id_key`(`hospitalId`, `id`),
    UNIQUE INDEX `DocumentRevision_hospitalId_documentNo_revision_key`(`hospitalId`, `documentNo`, `revision`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommitteeMandate` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `caseId` CHAR(36) NOT NULL,
    `orderDocRef` CHAR(36) NOT NULL,
    `committeeType` VARCHAR(64) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `position` VARCHAR(32) NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,

    INDEX `CommitteeMandate_hospitalId_caseId_subject_idx`(`hospitalId`, `caseId`, `subject`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExternalMapping` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `systemCode` VARCHAR(80) NOT NULL,
    `entityType` VARCHAR(64) NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `internalId` CHAR(36) NOT NULL,
    `sourceVersion` VARCHAR(100) NULL,
    `lastReconciledAt` DATETIME(3) NULL,

    UNIQUE INDEX `ExternalMapping_hospitalId_systemCode_entityType_externalId_key`(`hospitalId`, `systemCode`, `entityType`, `externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditStream` (
    `hospitalId` CHAR(36) NOT NULL,
    `streamId` VARCHAR(100) NOT NULL,
    `sequence` BIGINT NOT NULL DEFAULT 0,
    `headHash` BINARY(32) NOT NULL,

    PRIMARY KEY (`hospitalId`, `streamId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditEvent` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `streamId` VARCHAR(100) NOT NULL,
    `sequence` BIGINT NOT NULL,
    `entityId` CHAR(36) NOT NULL,
    `eventType` VARCHAR(80) NOT NULL,
    `actorSubject` VARCHAR(191) NOT NULL,
    `providerIdRef` VARCHAR(191) NULL,
    `ip` VARCHAR(45) NOT NULL,
    `deviceId` CHAR(36) NULL,
    `operationId` CHAR(36) NOT NULL,
    `payload` JSON NOT NULL,
    `previousHash` BINARY(32) NOT NULL,
    `eventHash` BINARY(32) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AuditEvent_hospitalId_streamId_sequence_key`(`hospitalId`, `streamId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OutboxEvent` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `operationId` CHAR(36) NOT NULL,
    `eventType` VARCHAR(80) NOT NULL,
    `payload` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deliveredAt` DATETIME(3) NULL,

    UNIQUE INDEX `OutboxEvent_hospitalId_operationId_eventType_key`(`hospitalId`, `operationId`, `eventType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommandReceipt` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `deviceId` CHAR(36) NOT NULL,
    `operationId` CHAR(36) NOT NULL,
    `actorSubject` VARCHAR(191) NOT NULL,
    `requestHash` CHAR(64) NOT NULL,
    `outcome` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CommandReceipt_hospitalId_deviceId_operationId_key`(`hospitalId`, `deviceId`, `operationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SyncConflict` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `resourceId` CHAR(36) NOT NULL,
    `deviceId` CHAR(36) NOT NULL,
    `operationId` CHAR(36) NOT NULL,
    `baseVersion` INTEGER NOT NULL,
    `currentVersion` INTEGER NOT NULL,
    `currentState` JSON NOT NULL,
    `proposedChange` JSON NOT NULL,
    `resolutionCommandId` CHAR(36) NULL,
    `status` VARCHAR(24) NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SyncConflict_hospitalId_resourceId_status_idx`(`hospitalId`, `resourceId`, `status`),
    UNIQUE INDEX `SyncConflict_hospitalId_deviceId_operationId_key`(`hospitalId`, `deviceId`, `operationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoleGrant` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `role` VARCHAR(64) NOT NULL,
    `departmentId` CHAR(36) NULL,
    `caseId` CHAR(36) NULL,
    `orderDocRef` CHAR(36) NOT NULL,
    `maxAmountSatang` BIGINT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,

    INDEX `RoleGrant_hospitalId_subject_role_idx`(`hospitalId`, `subject`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeviceEnrollment` (
    `id` CHAR(36) NOT NULL,
    `hospitalId` CHAR(36) NOT NULL,
    `keyThumbprint` VARCHAR(191) NOT NULL,
    `assignedSubject` VARCHAR(191) NOT NULL,
    `enrolledAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,

    UNIQUE INDEX `DeviceEnrollment_hospitalId_keyThumbprint_key`(`hospitalId`, `keyThumbprint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DemandRequest` ADD CONSTRAINT `DemandRequest_hospitalId_planId_fkey` FOREIGN KEY (`hospitalId`, `planId`) REFERENCES `AnnualPlan`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BudgetEnvelope` ADD CONSTRAINT `BudgetEnvelope_hospitalId_planId_fkey` FOREIGN KEY (`hospitalId`, `planId`) REFERENCES `AnnualPlan`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BudgetEnvelope` ADD CONSTRAINT `BudgetEnvelope_hospitalId_fundId_fkey` FOREIGN KEY (`hospitalId`, `fundId`) REFERENCES `Fund`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcurementCase` ADD CONSTRAINT `ProcurementCase_hospitalId_planId_fkey` FOREIGN KEY (`hospitalId`, `planId`) REFERENCES `AnnualPlan`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcurementCase` ADD CONSTRAINT `ProcurementCase_hospitalId_demandId_fkey` FOREIGN KEY (`hospitalId`, `demandId`) REFERENCES `DemandRequest`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contract` ADD CONSTRAINT `Contract_hospitalId_caseId_fkey` FOREIGN KEY (`hospitalId`, `caseId`) REFERENCES `ProcurementCase`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Commitment` ADD CONSTRAINT `Commitment_hospitalId_contractId_fkey` FOREIGN KEY (`hospitalId`, `contractId`) REFERENCES `Contract`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Commitment` ADD CONSTRAINT `Commitment_hospitalId_budgetId_fkey` FOREIGN KEY (`hospitalId`, `budgetId`) REFERENCES `BudgetEnvelope`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BudgetMovement` ADD CONSTRAINT `BudgetMovement_hospitalId_budgetId_fkey` FOREIGN KEY (`hospitalId`, `budgetId`) REFERENCES `BudgetEnvelope`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BudgetMovement` ADD CONSTRAINT `BudgetMovement_hospitalId_commitmentId_fkey` FOREIGN KEY (`hospitalId`, `commitmentId`) REFERENCES `Commitment`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Delivery` ADD CONSTRAINT `Delivery_hospitalId_contractId_fkey` FOREIGN KEY (`hospitalId`, `contractId`) REFERENCES `Contract`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentClaim` ADD CONSTRAINT `PaymentClaim_hospitalId_contractId_fkey` FOREIGN KEY (`hospitalId`, `contractId`) REFERENCES `Contract`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClaimDelivery` ADD CONSTRAINT `ClaimDelivery_hospitalId_claimId_fkey` FOREIGN KEY (`hospitalId`, `claimId`) REFERENCES `PaymentClaim`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClaimDelivery` ADD CONSTRAINT `ClaimDelivery_hospitalId_deliveryId_fkey` FOREIGN KEY (`hospitalId`, `deliveryId`) REFERENCES `Delivery`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentPosting` ADD CONSTRAINT `PaymentPosting_hospitalId_claimId_fkey` FOREIGN KEY (`hospitalId`, `claimId`) REFERENCES `PaymentClaim`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DonationReceipt` ADD CONSTRAINT `DonationReceipt_hospitalId_fundId_fkey` FOREIGN KEY (`hospitalId`, `fundId`) REFERENCES `Fund`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManagedResource` ADD CONSTRAINT `ManagedResource_hospitalId_contractId_fkey` FOREIGN KEY (`hospitalId`, `contractId`) REFERENCES `Contract`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManagedResource` ADD CONSTRAINT `ManagedResource_hospitalId_deliveryId_fkey` FOREIGN KEY (`hospitalId`, `deliveryId`) REFERENCES `Delivery`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManagedResource` ADD CONSTRAINT `ManagedResource_hospitalId_donationId_fkey` FOREIGN KEY (`hospitalId`, `donationId`) REFERENCES `DonationReceipt`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManagedResource` ADD CONSTRAINT `ManagedResource_hospitalId_policyId_fkey` FOREIGN KEY (`hospitalId`, `policyId`) REFERENCES `DepreciationPolicy`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustodyEvent` ADD CONSTRAINT `CustodyEvent_hospitalId_resourceId_fkey` FOREIGN KEY (`hospitalId`, `resourceId`) REFERENCES `ManagedResource`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceOrder` ADD CONSTRAINT `MaintenanceOrder_hospitalId_resourceId_fkey` FOREIGN KEY (`hospitalId`, `resourceId`) REFERENCES `ManagedResource`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DepreciationPosting` ADD CONSTRAINT `DepreciationPosting_hospitalId_resourceId_fkey` FOREIGN KEY (`hospitalId`, `resourceId`) REFERENCES `ManagedResource`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalLine` ADD CONSTRAINT `JournalLine_hospitalId_journalId_fkey` FOREIGN KEY (`hospitalId`, `journalId`) REFERENCES `Journal`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryObservation` ADD CONSTRAINT `InventoryObservation_hospitalId_resourceId_fkey` FOREIGN KEY (`hospitalId`, `resourceId`) REFERENCES `ManagedResource`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DisposalCase` ADD CONSTRAINT `DisposalCase_hospitalId_resourceId_fkey` FOREIGN KEY (`hospitalId`, `resourceId`) REFERENCES `ManagedResource`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommitteeMandate` ADD CONSTRAINT `CommitteeMandate_hospitalId_caseId_fkey` FOREIGN KEY (`hospitalId`, `caseId`) REFERENCES `ProcurementCase`(`hospitalId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;
