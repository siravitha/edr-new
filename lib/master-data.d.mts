export type MasterKind = "documents" | "departments" | "vendors";
export type MasterStatus = "ACTIVE" | "SUSPENDED" | "CANCELLED";
export interface MasterRecord { id: string; code: string; name: string; status: MasterStatus; fields: Record<string, string>; }
export interface MasterAudit { sequence: number; action: string; kind: MasterKind; recordId: string; code: string; role: string; beforeStatus?: MasterStatus; afterStatus?: MasterStatus; reason?: string; }
export interface MasterState { documents: MasterRecord[]; departments: MasterRecord[]; vendors: MasterRecord[]; sequences: Record<string, number>; audit: MasterAudit[]; }
export interface HospitalProfile { name: string; nameEnglish?: string; code: string; address: string; phone: string; email: string; website: string; logoDataUrl: string; }
export class MasterDataError extends Error { code: string; constructor(code: string, message: string); }
export function createMasterData(): MasterState;
export function nextCode(collection: readonly Pick<MasterRecord, "code">[], prefix: string, sequence: number): string;
export function nextCode(prefix: string, collection: readonly Pick<MasterRecord, "code">[], sequence?: number): string;
export function saveMasterRecord(state: MasterState, kind: MasterKind, draft: { id?: string; name: string; fields: Record<string, string> }, actorRole: string): MasterState;
export function changeMasterStatus(state: MasterState, kind: MasterKind, id: string, status: MasterStatus, actorRole: string, reason?: string): MasterState;
export function validateHospitalProfile(profile: Pick<HospitalProfile, "name"> & Partial<Omit<HospitalProfile, "name">>): HospitalProfile;
