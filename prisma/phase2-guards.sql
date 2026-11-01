-- สำหรับฐานทดสอบระยะที่ 2 เท่านั้น ต้องสร้างจาก phase2.prisma ก่อน
-- ห้ามรันกับฐานเดิมหรือฐานโรงพยาบาลโดยไม่ได้ตรวจชื่อและอำนาจบัญชี
ALTER TABLE BudgetEnvelope ADD CONSTRAINT budget_nonnegative CHECK
  (allocatedSatang >= 0 AND committedSatang >= 0 AND paidSatang >= 0
   AND allocatedSatang >= committedSatang + paidSatang);
ALTER TABLE Commitment ADD CONSTRAINT commitment_bounded CHECK
  (amountSatang >= 0 AND paidSatang >= 0 AND releasedSatang >= 0
   AND amountSatang >= paidSatang + releasedSatang);
ALTER TABLE PaymentPosting ADD CONSTRAINT payment_positive CHECK (amountSatang > 0);
ALTER TABLE ManagedResource ADD CONSTRAINT asset_cost_bounded CHECK
  (costSatang >= 0 AND residualSatang >= 0 AND residualSatang <= costSatang);
ALTER TABLE JournalLine ADD CONSTRAINT journal_line_valid CHECK
  ((debitSatang > 0 AND creditSatang = 0) OR (creditSatang > 0 AND debitSatang = 0));

-- ยอดสมดุลทั้งสมุดรายวันต้องตรวจขณะผ่านรายการในธุรกรรม ไม่ใช่ CHECK รายแถว
CREATE TRIGGER AuditEvent_no_update BEFORE UPDATE ON AuditEvent FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Append-only audit';
CREATE TRIGGER AuditEvent_no_delete BEFORE DELETE ON AuditEvent FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Append-only audit';
CREATE TRIGGER BudgetMovement_no_update BEFORE UPDATE ON BudgetMovement FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Append-only budget ledger';
CREATE TRIGGER BudgetMovement_no_delete BEFORE DELETE ON BudgetMovement FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Append-only budget ledger';
CREATE TRIGGER PaymentPosting_no_update BEFORE UPDATE ON PaymentPosting FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Append-only payment';
CREATE TRIGGER PaymentPosting_no_delete BEFORE DELETE ON PaymentPosting FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Append-only payment';
CREATE TRIGGER CommandReceipt_no_update BEFORE UPDATE ON CommandReceipt FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Append-only command receipt';
CREATE TRIGGER CommandReceipt_no_delete BEFORE DELETE ON CommandReceipt FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Append-only command receipt';
