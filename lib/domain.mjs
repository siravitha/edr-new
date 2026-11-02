const STATUSES = new Set(['AVAILABLE', 'IN_USE', 'REPAIR', 'QUARANTINED', 'DISPOSED']);
const ROLES = new Set(['warehouse', 'nurse', 'finance', 'accounting', 'strategy', 'procurement', 'executive', 'auditor']);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const text = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,100}$/.test(value);
const plain = value => value !== null && typeof value === 'object' && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const has = (value, fields) => plain(value) && fields.every(key => own(value, key));

// ตัวอย่างนี้รับตัวตนที่เซิร์ฟเวอร์ตรวจแล้วเท่านั้น ห้ามเชื่อ actor จาก HTTP body
function validActor(actor) {
  return has(actor, ['id', 'hospitalId', 'wardIds', 'role', 'deviceId']) &&
    [actor.id, actor.hospitalId, actor.deviceId].every(text) && ROLES.has(actor.role) &&
    Array.isArray(actor.wardIds) && actor.wardIds.every(text);
}

export function transitionAsset(state, command, actor) {
  const reject = code => ({ state, result: { status: 'REJECTED', code } });
  if (!validActor(actor)) return reject('INVALID_ACTOR');
  if (!has(command, ['id', 'assetId', 'baseVersion', 'nextStatus', 'deviceId']) ||
      ![command.id, command.assetId, command.deviceId].every(text) ||
      !Number.isSafeInteger(command.baseVersion) || command.baseVersion < 0 ||
      !STATUSES.has(command.nextStatus)) return reject('INVALID_COMMAND');
  if (command.deviceId !== actor.deviceId) return reject('DEVICE_MISMATCH');
  const asset = state.assets.find(item => item.id === command.assetId && item.hospitalId === actor.hospitalId);
  if (!asset || !actor.wardIds.includes(asset.wardId)) return reject('OUT_OF_SCOPE');
  if (!['warehouse', 'nurse'].includes(actor.role)) return reject('FORBIDDEN');
  if (actor.role === 'nurse' && !['IN_USE', 'REPAIR'].includes(command.nextStatus)) return reject('FORBIDDEN');

  // ใช้ tuple เพื่อไม่ให้รหัสที่มีตัวคั่นสร้าง key ชนกัน และไม่ใช้ object เป็น dictionary
  const key = JSON.stringify([actor.hospitalId, actor.deviceId, command.id]);
  const fingerprint = JSON.stringify([command.assetId, command.baseVersion, command.nextStatus, command.deviceId]);
  const previous = state.receipts.find(item => item.key === key);
  if (previous) {
    if (previous.fingerprint !== fingerprint || previous.actorId !== actor.id) return reject('IDEMPOTENCY_KEY_REUSED');
    return { state, result: { ...previous.result, replayed: true } };
  }
  const record = (result, changedAsset, conflict) => {
    const event = { sequence: state.audit.length + 1, commandId: command.id, actorId: actor.id,
      hospitalId: actor.hospitalId, deviceId: actor.deviceId, assetId: asset.id,
      beforeVersion: asset.version, afterVersion: changedAsset?.version ?? asset.version,
      outcome: result.status, code: result.code };
    return {
      state: { ...state,
        assets: changedAsset ? state.assets.map(item => item === asset ? changedAsset : item) : state.assets,
        receipts: [...state.receipts, { key, fingerprint, actorId: actor.id, result: { ...result } }],
        conflicts: conflict ? [...state.conflicts, conflict] : state.conflicts,
        audit: [...state.audit, event]
      }, result
    };
  };
  if (asset.version !== command.baseVersion) {
    const result = { status: 'CONFLICT', code: 'STALE_VERSION', currentVersion: asset.version };
    return record(result, null, { id: key, assetId: asset.id, actorId: actor.id,
      baseVersion: command.baseVersion, currentVersion: asset.version,
      requestedStatus: command.nextStatus, currentStatus: asset.status, resolution: 'PENDING_REVIEW' });
  }
  // สถานะเป็นคำสั่งธุรกิจ ไม่ใช่ timestamp แบบ last-write-wins
  const allowed = {
    AVAILABLE: ['IN_USE', 'REPAIR', 'QUARANTINED'],
    IN_USE: ['AVAILABLE', 'REPAIR', 'QUARANTINED'],
    REPAIR: ['QUARANTINED'],
    QUARANTINED: ['REPAIR'],
    DISPOSED: []
  };
  if (!own(allowed, asset.status) || !allowed[asset.status].includes(command.nextStatus)) {
    return record({ status: 'REJECTED', code: 'INVALID_TRANSITION' });
  }
  const updated = { ...asset, status: command.nextStatus, version: asset.version + 1 };
  return record({ status: 'APPLIED', code: 'OK', version: updated.version }, updated);
}

// ตัวอย่างนี้แยกวงจรการจ่ายออกจากสถานะ PO และไม่แก้เอกสาร revision เดิม
export function transitionPayment(payment, event, actor, options = {}) {
  const fail = code => ({ payment, result: { status: 'REJECTED', code } });
  if (!validActor(actor) || !plain(payment) || payment.hospitalId !== actor.hospitalId) return fail('OUT_OF_SCOPE');
  if (!plain(options)) return fail('INVALID_OPTIONS');
  const eventType = typeof event === 'string' ? event : (has(event, ['type']) ? event.type : null);
  const result = next => ({ payment: next, result: { status: 'APPLIED', code: 'OK' } });
  if (eventType === 'SUBMIT' && payment.status === 'DRAFT' && actor.role === 'procurement') {
    return result({ ...payment, status: 'SUBMITTED', makerId: actor.id });
  }
  if (eventType === 'RETURN' && payment.status === 'SUBMITTED' && actor.role === 'finance') {
    if (actor.id === payment.makerId) return fail('SEGREGATION_OF_DUTIES');
    if (typeof options.reason !== 'string' || !options.reason.trim() || options.reason.length > 2000) return fail('REASON_REQUIRED');
    return result({ ...payment, status: 'RETURNED', returnReason: options.reason.trim(), reviewerId: actor.id });
  }
  if (eventType === 'RESUBMIT' && payment.status === 'RETURNED' && actor.role === 'procurement') {
    return result({ ...payment, status: 'SUBMITTED', revision: (payment.revision ?? 1) + 1,
      makerId: actor.id, previousRevision: payment.revision ?? 1, returnReason: null,
      reviewerId: null, approverId: null, evidenceComplete: false, signatureVerified: false });
  }
  if (eventType === 'APPROVE' && payment.status === 'SUBMITTED' && actor.role === 'finance') {
    if (actor.id === payment.makerId) return fail('SEGREGATION_OF_DUTIES');
    if (options.evidenceComplete !== true || options.signatureVerified !== true) return fail('EVIDENCE_REQUIRED');
    return result({ ...payment, status: 'APPROVED', approverId: actor.id,
      evidenceComplete: true, signatureVerified: true });
  }
  if (eventType === 'PAY' && payment.status === 'APPROVED' && actor.role === 'finance') {
    if (actor.id === payment.makerId) return fail('SEGREGATION_OF_DUTIES');
    return result({ ...payment, status: 'PAID', payerId: actor.id });
  }
  return fail('INVALID_TRANSITION_OR_ROLE');
}
