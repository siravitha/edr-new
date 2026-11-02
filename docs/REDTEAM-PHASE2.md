# ผลตรวจ Red Team ระยะที่ 2

**@RedTeam_Hacker:** นโยบาย offline ของโรงพยาบาลยังไม่ได้รับการอนุมัติ ตัวอย่าง APPROVED ในชุดทดสอบเป็น fixture เท่านั้น ไม่ใช่มติจริง Helper จะปฏิเสธโดยปริยายด้วย OFFLINE_POLICY_UNAPPROVED ส่วน endpoint `/api/sync` ระงับคำสั่งที่ผ่าน auth/role/schema แล้วด้วย HTTP 503 และข้อความ OFFLINE_POLICY_UNAPPROVED ก่อนเข้าฐานข้อมูล โดยใช้ค่าคงที่ UNSPECIFIED ไม่มี environment bypass การรับคำสั่งจริงต้องพัฒนา trusted policy integration เพิ่ม ไม่ใช่เปลี่ยนค่าคงที่แล้วเปิดใช้ทันที

## ขอบเขตการรับคำสั่ง

`authorizeOfflineCommand` ต้องรับ policy, บุคลากร, device assignment, active/revoked, ขอบเขต asset และเวลา lease จากบริการฝั่งเซิร์ฟเวอร์ที่เชื่อถือได้เท่านั้น การส่ง object ชื่อ trusted จาก HTTP body ไม่ได้พิสูจน์อะไร ผู้เรียกต้องสร้าง envelope ใหม่จากฐานข้อมูลและเวลาเซิร์ฟเวอร์ ไม่กระจาย properties จาก client

หลังอนุมัตินโยบายอย่างชัดแจ้ง ยังรับได้เฉพาะร่างข้อสังเกต OBSERVE_PRESENT, REPORT_DAMAGE_DRAFT และ REQUEST_TRANSFER_DRAFT ตาม allowlist ไม่เปลี่ยนสถานะบัญชี ไม่จ่ายเงิน ไม่ตรวจรับแทนกรรมการ และไม่จำหน่าย ขณะนี้ไม่ตั้งค่า TTL ที่มีผลจริง: ต้องได้ระยะเวลาและเลขอ้างอิงอนุมัติก่อน เปิดใช้ lease ต้องตรวจอายุเมื่อเซิร์ฟเวอร์รับคำสั่ง ไม่ใช้ capturedAt ของแท็บเล็ตย้อนหลังเพื่อเลี่ยง expiry

barcode รับเพียงรูปแบบป้าย UTH-YY-NNNNN ตัดเฉพาะ CR/LF ท้ายจาก scanner ปฏิเสธ URL, HN/เลขบัตรตามรูปแบบ, SQL strings และ control characters กลางรหัส รหัสที่ถูกตามรูปแบบยังต้องค้นทะเบียนภายใต้สิทธิ์ ไม่ใช่หลักฐานว่า tag อยู่กับครุภัณฑ์จริง OCR, bulk import และ RFID ยังรออนุมัติแยก การมีช่องสาธิต CSV ไม่ถือเป็นอนุมัติใช้งานจริง

## เหตุล้มเหลวก่อนเปิดใช้

| เหตุการณ์ | การควบคุมที่ต้องมี | หลักฐานที่ต้องทดสอบ |
|---|---|---|
| แท็บเล็ตถูกถอนสิทธิ์แต่ยังมีคิว | device identity, lease revocation, current actor/ward scope ตอน sync | ปิด device แล้ว replay ต้องถูกปฏิเสธ |
| ผู้ใช้แก้เวลาเครื่องเพื่อส่งคำสั่งเก่า | server-issued lease และ server receipt time | capturedAt เก่า/อนาคตไม่ยืด TTL |
| ค่าเสื่อมครบแล้วระบบจำหน่ายทันที | ค่าเสื่อมและการจำหน่ายเป็นคนละวงจร ต้องมีอนุมัติจำหน่ายและหลักฐานครบ | book value ศูนย์ยังคงทะเบียนและผู้รับผิดชอบ |
| ใบแจ้งหนี้เดียวจ่ายสองครั้ง | unique normalized supplier/invoice identity ตามขอบเขตที่กำหนด, installment allocation, transaction lock, payment reference และ bank reconciliation | retry/worker สองตัวไม่สร้างยอดจ่ายซ้ำ |
| กรรมการสองคนทำรายการแทนกันหรือคนเดียวถูกนับสองครั้ง | appointment revision, unique committee/person/decision, quorum ตามคำสั่งแต่งตั้ง, maker/checker แยกคน | submit พร้อมกันไม่เพิ่มจำนวนเสียงซ้ำ; อำนาจหมดอายุถูกบล็อก |
| AP/Gateway 500 ตัว reconnect พร้อมกัน | handshake admission cap, jitter เมื่ออุปกรณ์รองรับ, bounded durable queue, per-device rate limit, batching และ backpressure | วัด event-loop lag, memory, queue lag, loss และ DB pool saturation |
| BLE ถูก spoof หรือย้ายป้าย | telemetry เป็น observation มี confidence และ lastSeen ไม่เปลี่ยนผู้ถือครอง/บัญชีโดยตรง | packet ปลอมไม่โอนครุภัณฑ์ |

BLE beacon ไม่ได้เป็น WebSocket client แต่ละตัวโดยปริยาย โดยทั่วไป AP/Gateway รับ BLE แล้วส่งข้อมูลผ่าน transport profile ต้องยืนยันรุ่น firmware, telemetry schema และวิธี authentication จริงก่อนกำหนดจำนวน connection หรือขนาด payload อ้างอิง [HPE Aruba transport profile](https://arubanetworking.hpe.com/techdocs/CLI-Bank/Content/instant/iot-transportpro.htm?Highlight=iot+transport+profile)

## ลายเซ็นหมึกและการตรวจสอบย้อนหลัง

ตรึง PDF revision → เก็บ hash ของ PDF ก่อนพิมพ์ → พิมพ์พร้อม document ID/revision/QR อ้างอิง → ผู้มีอำนาจลงหมึก → สแกนครบทุกหน้า → คนตรวจอีกคนเทียบเนื้อหาและผู้ลงนาม → เก็บ hash ของ signed scan แยกจาก hash ของ PDF เดิม → บันทึกผู้รับฝาก สถานที่เก็บต้นฉบับ วันรับส่ง และ chain of custody

แก้เนื้อหาต้องออก revision ใหม่และลงนามใหม่ ไม่แทนไฟล์เดิม รูปลายเซ็นและ hash พิสูจน์ตัวผู้ลงนามด้วยตัวเองไม่ได้ ห้ามสรุปว่ามีสแกนแล้วทำลายต้นฉบับได้ การใช้ลายมือชื่ออิเล็กทรอนิกส์ต้องพิจารณาเอกสารและระเบียบเฉพาะ ไม่กล่าวว่า สตง. บังคับหมึกทุกประเภท หรือ Provider ID login เท่ากับลงนามอนุมัติ อ้างอิง [ETDA แนวทางลายมือชื่ออิเล็กทรอนิกส์](https://www.etda.or.th/th/contact/faq/e-Signature.aspx?feed=bd61b8bf-38ac-40b2-b02c-424dfc10fbfe)

## ขอบเขตผลทดสอบ

ชุดทดสอบ policy ตรวจ fail-closed, barcode, อายุ lease, device/ward/hospital scope, unknown roles และการห้ามคำสั่งการเงิน offline ไม่ได้พิสูจน์ความปลอดภัยของฐานข้อมูลหรือ endpoint เมื่อเชื่อมระบบจริง ต้องทดสอบ helper ที่ถูกผูกเข้ากับ trusted server context และ MySQL transaction แยกก่อนใช้งานจริง

## ข้อพบจาก schema ขณะตรวจ

ตรวจ `prisma/schema.prisma` ฉบับที่มี Plan, PurchaseOrder, ReceiptLine, Asset, PaymentClaim และ JournalEntry พบว่ายังเป็นฐานเริ่มต้น ไม่ใช่การควบคุมวงจรครบถ้วน:

- PaymentClaim ยังไม่มี supplier/invoice identity, payment transaction, unique payment reference หรือ allocation จึงใช้ claimNo/revision อย่างเดียวป้องกันใบแจ้งหนี้เดียวสร้างหลายคำขอไม่ได้
- ReceiptLine ยังมี acceptedBy คนเดียว ไม่มี appointment/committee membership/quorum หรือ unique vote ต่อคน จึงพิสูจน์การตรวจรับโดยกรรมการหลายคนไม่ได้
- JournalEntry มี debit/credit รายแถว แต่ไม่มี journal header/transaction เพื่อรับรองผลรวมเดบิตเท่ากับเครดิต และ reversalOf ยังไม่มี foreign key/unique reversal constraint ที่จำเป็นตามรูปแบบที่เลือก
- ค่า quantity, acceptedQty, cost, amount, version ยังไม่มี SQL CHECK หรือการควบคุมยอดรับสะสมไม่เกิน PO จึงต้องเสริม validation และ transaction constraints ไม่อาศัย Prisma type อย่างเดียว
- AuditLog model ยังไม่รับรอง append-only ด้วยตัวเอง ต้องตรวจสิทธิ์ runtime DB user, migration grants และ immutable external checkpoint จริง

ไม่ได้แก้ schema ของผู้รับผิดชอบฐานข้อมูล ข้อพบนี้ระบุสถานะ ณ เวลาตรวจ ต้องตรวจซ้ำกับ migration และบริการ lifecycle ฉบับสุดท้ายก่อนอ้างว่าปิดช่องโหว่แล้ว

ตรวจ `lib/lifecycle.mjs` เพิ่มเติม: โมดูลนี้ระบุว่าเป็นแบบจำลองในเบราว์เซอร์ การตรวจ role/tenant และ signed/verified จาก command ไม่ใช่หลักฐาน authentication หรือการตรวจเอกสารจริง ฉบับปรับปรุงมี expectedVersion, paidReferences และเงื่อนไขตรวจรับก่อนจ่ายแล้ว แต่ paymentRef ที่ผู้เรียกเปลี่ยนค่าได้ยังต้องผูกกับ invoice/installment identity และทะเบียนชำระจริงในฐานข้อมูลเพื่อป้องกันการจ่ายใบแจ้งหนี้เดิมซ้ำโดยสร้างเลขอ้างอิงใหม่ ยังไม่มี committee quorum และ lifecycleSteps ทั้ง 15 เป็นแค็ตตาล็อก ไม่ใช่ state-machine guard ครบทุกขั้น ต้องคงข้อความสาธิตและไม่ผูก API จริงจนกว่าจะเติมการควบคุมฝั่งเซิร์ฟเวอร์เหล่านี้
