-- รันด้วยบัญชี migration หลังสร้าง schema และก่อนเปิดใช้บัญชี runtime
DELIMITER $$
CREATE TRIGGER AuditLog_no_update BEFORE UPDATE ON AuditLog FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'AuditLog is append-only';
END$$
CREATE TRIGGER AuditLog_no_delete BEFORE DELETE ON AuditLog FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'AuditLog is append-only';
END$$
CREATE TRIGGER SyncReceipt_no_update BEFORE UPDATE ON SyncReceipt FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SyncReceipt is append-only';
END$$
CREATE TRIGGER SyncReceipt_no_delete BEFORE DELETE ON SyncReceipt FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SyncReceipt is append-only';
END$$
DELIMITER ;

-- ตัวอย่างสิทธิ์ ต้องเปลี่ยนชื่อฐานข้อมูลและบัญชีให้ตรงสภาพแวดล้อม
-- GRANT SELECT, INSERT ON uth_assets.AuditLog TO 'asset_runtime'@'localhost';
-- GRANT SELECT, INSERT ON uth_assets.SyncReceipt TO 'asset_runtime'@'localhost';
-- ห้ามให้บัญชี runtime มี ALTER, DROP, TRIGGER หรือสิทธิ์ระดับฐานข้อมูลแบบครอบคลุม
