-- บังคับประวัติและผลซิงก์เป็นแบบเพิ่มต่อท้าย ต้องแยกสิทธิ์ผู้ดูแลอีกชั้น
CREATE TRIGGER AuditLog_no_update BEFORE UPDATE ON AuditLog FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'AuditLog is append-only';
CREATE TRIGGER AuditLog_no_delete BEFORE DELETE ON AuditLog FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'AuditLog is append-only';
CREATE TRIGGER SyncReceipt_no_update BEFORE UPDATE ON SyncReceipt FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SyncReceipt is append-only';
CREATE TRIGGER SyncReceipt_no_delete BEFORE DELETE ON SyncReceipt FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SyncReceipt is append-only';
