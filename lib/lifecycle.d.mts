export type LifecycleRole = "strategy" | "procurement" | "finance" | "accounting" | "warehouse" | "approver" | "inspector";
export type LifecycleCommandType = "SIGN_CONTRACT" | "PAY" | "CANCEL_CONTRACT" | "PROPOSE_DISPOSAL" | "APPROVE_DISPOSAL" | "EXECUTE_DISPOSAL";
export class DomainError extends Error { code: string; constructor(code: string, message: string); }
export interface WetInkDocument { signed: boolean; verified: boolean; [key: string]: string | number | boolean; }
export interface LifecycleCommand {
  opId: string; tenantId: string; actorId: string; role: LifecycleRole; type: LifecycleCommandType; expectedVersion: number;
  payload: { document: WetInkDocument; amountSatang?: number; inspectionVerified?: boolean; executionEvidenceVerified?: boolean; paymentRef?: string; acceptanceVerified?: boolean };
}
export interface LifecycleState {
  readonly tenantId: string; readonly caseId: string; readonly version: number;
  readonly budget: { readonly allocatedSatang: number; readonly committedSatang: number; readonly paidSatang: number };
  readonly contract: { readonly signed: boolean; readonly cancelled: boolean; readonly amountSatang: number };
  readonly disposal: { readonly inspectionVerified: boolean; readonly approved: boolean; readonly executed: boolean; readonly inspectedBy?: string; readonly approvedBy?: string };
  readonly paidReferences: readonly string[];
  readonly operations: readonly { opId: string; requestHash: string; canonical: string; tenantId: string; actorId: string; role: string; type: string }[];
}
export const lifecycleSteps: readonly { readonly id: string; readonly label: string; readonly role: LifecycleRole }[];
export const scopeCatalog: { readonly caseTypes: readonly string[]; readonly fundSources: readonly string[] };
export function createLifecycle(input: { tenantId: string; caseId: string; allocatedSatang: number }): LifecycleState;
export function availableBudget(state: LifecycleState): number;
export function applyLifecycleCommand(state: LifecycleState, command: LifecycleCommand): LifecycleState;
export function calculateDepreciation(input: { costSatang: number; residualSatang: number; lifetimeMonths: number; elapsedMonths: number; policyApproved: boolean; startDate: string }): {
  readonly accumulatedSatang: number; readonly bookValueSatang: number; readonly fullyDepreciated: boolean; readonly elapsedMonths: number; readonly disposalEligible: false;
};
