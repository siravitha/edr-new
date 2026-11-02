import { z } from 'zod';

// รับเฉพาะเลขป้ายครุภัณฑ์ ไม่รับ URL, HN หรือข้อความอิสระจากเครื่องสแกน
export const barcodeSchema = z.string().max(80)
  .transform(value => value.replace(/[\r\n]+$/, ''))
  .pipe(z.string().regex(/^(?:UTH-\d{2}-\d{5}|\d{4}-\d{3}-\d{4,5}\/\d{2})$/i).refine(value=>/^UTH-/i.test(value)||Number(/-(\d{4,5})\/\d{2}$/.exec(value)?.[1]??0)>0))
  .transform(value => value.toUpperCase());

export const INPUT_APPROVAL_POLICY = Object.freeze({
  status: 'SCANNING_ONLY' as const,
  acceptedChannels: Object.freeze(['ASSET_BARCODE'] as const),
  ocr: 'PENDING_APPROVAL', bulkImport: 'PENDING_APPROVAL', rfid: 'PENDING_APPROVAL',
});

const observationActions = ['OBSERVE_PRESENT', 'REPORT_DAMAGE_DRAFT', 'REQUEST_TRANSFER_DRAFT'] as const;
const actionSchema = z.enum(observationActions);
const time = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const id = z.string().min(1).max(191);
const policySchema = z.strictObject({
  status: z.literal('APPROVED'),
  approvalReference: z.string().trim().min(1).max(191),
  approvedBy: id,
  approvedAtMs: time,
  ttlSeconds: z.number().int().positive().max(Math.floor(Number.MAX_SAFE_INTEGER / 1000)),
  allowedActions: z.array(actionSchema).min(1).max(3),
});
const inputSchema = z.strictObject({
  policy: policySchema,
  command: z.strictObject({
    action: actionSchema,
    assetId: id,
    deviceId: id,
    barcode: barcodeSchema,
    // เวลาจากแท็บเล็ตเก็บเป็นข้อมูลประกอบ ไม่ใช้คำนวณอายุสิทธิ์
    capturedAt: z.string().max(80).optional(),
  }),
  trusted: z.strictObject({
    actor: z.strictObject({
      id, hospitalId: id, role: z.enum(['WAREHOUSE', 'WARD']),
      wardIds: z.array(id).max(500), active: z.boolean(),
    }),
    device: z.strictObject({ id, hospitalId: id, active: z.boolean(), assignedActorId: id }),
    asset: z.strictObject({ id, hospitalId: id, wardId: id, barcode: barcodeSchema }),
    serverReceivedAtMs: time,
    leaseIssuedAtMs: time,
    leaseRevoked: z.boolean(),
  }),
});

type Decision = { allowed: false; code: string } | {
  allowed: true; code: 'DRAFT_OBSERVATION_ONLY'; action: typeof observationActions[number];
  normalizedBarcode: string; approvalReference: string;
};

/** เรียกจากบริการภายในเท่านั้น: trusted และ policy ต้องมาจากฐานข้อมูล/เวลาเซิร์ฟเวอร์
 * ชื่อนี้ไม่ได้ทำให้ HTTP body น่าเชื่อถือ ห้ามส่ง req.body เข้า helper โดยตรง
 * ผลอนุญาตใช้สร้างร่างข้อสังเกตเท่านั้น ไม่อนุมัติการเงินหรือเปลี่ยนทะเบียนทรัพย์สิน
 */
export function authorizeOfflineCommand(input: unknown): Decision {
  if (input === null || typeof input !== 'object' || !('policy' in input) ||
      input.policy === null || typeof input.policy !== 'object' ||
      !('status' in input.policy) || input.policy.status !== 'APPROVED') {
    return { allowed: false, code: 'OFFLINE_POLICY_UNAPPROVED' };
  }
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { allowed: false, code: 'INVALID_OFFLINE_ENVELOPE' };
  const { command, trusted, policy } = parsed.data;
  const { actor, device, asset, serverReceivedAtMs: received, leaseIssuedAtMs: issued } = trusted;
  if (!actor.active || !device.active || trusted.leaseRevoked) return { allowed: false, code: 'OFFLINE_IDENTITY_INACTIVE' };
  if (device.id !== command.deviceId || device.assignedActorId !== actor.id) return { allowed: false, code: 'OFFLINE_DEVICE_MISMATCH' };
  if (actor.hospitalId !== asset.hospitalId || device.hospitalId !== actor.hospitalId ||
      !actor.wardIds.includes(asset.wardId) || asset.id !== command.assetId || asset.barcode !== command.barcode) {
    return { allowed: false, code: 'OFFLINE_OUT_OF_SCOPE' };
  }
  if (policy.approvedAtMs > issued || issued > received || received - issued >= policy.ttlSeconds * 1000) {
    return { allowed: false, code: 'OFFLINE_LEASE_EXPIRED_OR_INVALID' };
  }
  if (!policy.allowedActions.includes(command.action)) return { allowed: false, code: 'OFFLINE_ACTION_NOT_APPROVED' };
  return { allowed: true, code: 'DRAFT_OBSERVATION_ONLY', action: command.action,
    normalizedBarcode: command.barcode, approvalReference: policy.approvalReference };
}
