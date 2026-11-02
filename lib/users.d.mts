export type UserDraft = { id?: string; staffCode: string; fullName: string; position: string; departmentId: string; role: string; authority: string; orderRef: string; startsOn: string; endsOn: string };
export type DemoUser = UserDraft & { id: string; code: string; status: string; identity: string; cancellationReason?: string };
export const userRoleOptions: readonly (readonly string[])[];
export function createDemoUsers(): DemoUser[];
export function validateUserDraft(raw: UserDraft, allowedDepartments: string[]): Omit<UserDraft, 'id'>;
export function saveDemoUser(users: DemoUser[], draft: UserDraft, context: { actorRole: string; allowedDepartments: string[]; newId: string }): DemoUser[];
export function toggleDemoUser(users: DemoUser[], id: string, actorRole: string): DemoUser[];
export function normalizeDemoUsers(users: (UserDraft & { id: string; code?: string; status: string; identity: string; cancellationReason?: string })[]): DemoUser[];
export function cancelDemoUser(users: DemoUser[], id: string, actorRole: string, reason: string): DemoUser[];
