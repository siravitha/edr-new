// flow-store.ts — DB persistence for the per-hospital FlowState document.
// ONE mutable FlowState per hospital (FlowStateDoc.state = FlowState; `version` === FlowState.revision).
// commitFlowState does an OPTIMISTIC CAS (overwrite only when stored version === expectedVersion);
// the state write + audit event (FlowEvent) commit in ONE transaction (no torn state).
// A concurrent commit that advanced the version first -> FlowConflictError (API maps to HTTP 409).
// All fns take the Prisma client as a parameter (DI) so they work in the app AND in Node tests.
import type { Prisma, PrismaClient } from "@prisma/client";
import type { FlowState } from "./procurement-flow";

export type DB = PrismaClient;

export class FlowConflictError extends Error {
  actual: unknown;
  constructor(message: string, actual?: unknown) {
    super(message);
    this.name = "FlowConflictError";
    this.actual = actual;
  }
}

export interface FlowEventInput {
  action: string;
  actorId?: string | null;
  actorRole?: string | null;
  caseId?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface FlowStateRecord {
  hospitalId: string;
  state: FlowState;
  version: number;
  updatedAt: string;
}

function recordOf(row: { id: string; hospitalId: string; state: unknown; version: number; updatedAt: Date }): FlowStateRecord {
  return { hospitalId: row.hospitalId, state: row.state as FlowState, version: row.version, updatedAt: row.updatedAt.toISOString() };
}

function eventData(
  ev: FlowEventInput,
  docId: string,
  hospitalId: string,
  revision: number,
): Prisma.FlowEventUncheckedCreateInput {
  return {
    docId,
    hospitalId,
    revision,
    action: ev.action,
    actorId: ev.actorId ?? null,
    actorRole: ev.actorRole ?? null,
    caseId: ev.caseId ?? null,
    payload: ev.payload ? (ev.payload as unknown as Prisma.InputJsonValue) : undefined,
  };
}

/** Read the per-hospital FlowState document. Returns null if the hospital has none yet. */
export async function getFlowState(db: DB, hospitalId: string): Promise<FlowStateRecord | null> {
  const row = await db.flowStateDoc.findUnique({ where: { hospitalId } });
  return row ? recordOf(row) : null;
}

/**
 * Atomically persist a new FlowState using optimistic CAS on the stored version.
 * Succeeds iff stored version === expectedVersion (a missing document counts as version 0).
 * State write + audit event commit atomically. Throws FlowConflictError on a collision.
 */
export async function commitFlowState(
  db: DB,
  hospitalId: string,
  nextState: FlowState,
  expectedVersion: number,
  event?: FlowEventInput,
): Promise<FlowStateRecord> {
  if (!hospitalId) throw new Error("hospitalId is required");
  if (typeof nextState?.revision !== "number") throw new Error("nextState.revision must be a number");
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) throw new Error("expectedVersion must be a non-negative integer");

  const stateJson = nextState as unknown as Prisma.InputJsonValue;
  const newVersion = nextState.revision;

  return db.$transaction(async (tx) => {
    // Atomic CAS: overwrite ONLY if the stored version is exactly `expectedVersion`.
    const updated = await tx.flowStateDoc.updateMany({
      where: { hospitalId, version: expectedVersion },
      data: { state: stateJson, version: newVersion },
    });

    if (updated.count > 0) {
      const row = await tx.flowStateDoc.findUnique({ where: { hospitalId } });
      if (row) {
        if (event) await tx.flowEvent.create({ data: eventData(event, row.id, hospitalId, newVersion) });
        return recordOf(row);
      }
    }

    // No row matched: either missing (first commit) or version is stale (conflict).
    const existing = await tx.flowStateDoc.findUnique({ where: { hospitalId } });
    if (existing) {
      throw new FlowConflictError(`CAS conflict for hospital ${hospitalId}: expected revision ${expectedVersion} but found ${existing.version}`, existing.version);
    }

    if (expectedVersion !== 0) {
      throw new FlowConflictError(`no flow state exists for hospital ${hospitalId}; the first commit must use expectedVersion 0 (got ${expectedVersion})`, 0);
    }

    let created: { id: string; hospitalId: string; state: unknown; version: number; updatedAt: Date };
    try {
      created = await tx.flowStateDoc.create({ data: { hospitalId, state: stateJson, version: newVersion } });
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") throw new FlowConflictError(`flow state was created concurrently for hospital ${hospitalId}`);
      throw err;
    }
    if (event) await tx.flowEvent.create({ data: eventData(event, created.id, hospitalId, newVersion) });
    return recordOf(created);
  });
}

/** Return the audit trail for a hospital (newest first), optionally scoped to one case. */
export async function listFlowEvents(db: DB, hospitalId: string, caseId?: string, limit = 500) {
  const take = Math.min(Math.max(Math.trunc(limit) || 500, 1), 5000);
  const rows = await db.flowEvent.findMany({
    where: caseId ? { hospitalId, caseId } : { hospitalId },
    orderBy: [{ at: "desc" }, { id: "desc" }],
    take,
  });
  return rows.map((r) => ({
    id: r.id,
    hospitalId: r.hospitalId,
    caseId: r.caseId,
    action: r.action,
    actorId: r.actorId,
    actorRole: r.actorRole,
    revision: r.revision,
    payload: (r.payload as Record<string, unknown> | null) ?? null,
    at: r.at.toISOString(),
  }));
}