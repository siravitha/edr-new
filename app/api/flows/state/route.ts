// /api/flows/state — per-hospital FlowState read + CAS commit.
// GET  ?hospitalId=X        -> { started, data, state, version, updatedAt }  (data/state null until first commit)
// POST { hospitalId, flow, expectedVersion, event? }   (also accepts `state` in place of `flow`)
//        -> 200 { hospitalId, data, state, version, updatedAt }
//        -> 409 { error:"conflict", expectedVersion, actualVersion }  on a CAS collision
//
// SECURITY (was previously open): GET requires `approvals:read`, POST requires `approvals:decide`;
// unauthenticated callers get 401 and roles without the action get 403 (lib/api-guard).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFlowState, commitFlowState, FlowConflictError, type FlowEventInput } from "@/lib/flow-store";
import type { FlowState } from "@/lib/procurement-flow";
import { getActor, requireAction, type AuthError } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

const READ_ACTION = "approvals:read";
const WRITE_ACTION = "approvals:decide";

function reject(e: AuthError) {
  return NextResponse.json({ error: e.error, message: e.message }, { status: e.status });
}

// The client posts the whole FlowState under `body.flow`; accept `body.state` as a backwards-compat alias.
function stateFromBody(body: Record<string, unknown>): FlowState | undefined {
  const candidate = (body.flow ?? body.state) as FlowState | undefined;
  if (!candidate || typeof candidate.revision !== "number") return undefined;
  return candidate;
}

export async function GET(req: NextRequest) {
  const auth = await getActor(req);
  if (!auth.ok) return reject(auth);
  const gate = requireAction(auth, READ_ACTION);
  if (!gate.ok) return reject(gate);

  const hospitalId = req.nextUrl.searchParams.get("hospitalId");
  if (!hospitalId) return NextResponse.json({ error: "hospitalId is required" }, { status: 400 });
  const record = await getFlowState(prisma, hospitalId);
  if (!record) return NextResponse.json({ hospitalId, started: false, data: null, state: null, version: 0 });
  return NextResponse.json({ hospitalId, started: true, data: record.state, state: record.state, version: record.version, updatedAt: record.updatedAt });
}

export async function POST(req: NextRequest) {
  const auth = await getActor(req);
  if (!auth.ok) return reject(auth);
  const gate = requireAction(auth, WRITE_ACTION);
  if (!gate.ok) return reject(gate);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const hospitalId = typeof body.hospitalId === "string" ? body.hospitalId : "";
  const state = stateFromBody(body);
  const expectedVersion = body.expectedVersion;
  const event = body.event as FlowEventInput | undefined;

  if (!hospitalId) return NextResponse.json({ error: "hospitalId is required" }, { status: 400 });
  if (!state) return NextResponse.json({ error: "flow (or state).revision is required" }, { status: 400 });
  if (typeof expectedVersion !== "number" || !Number.isInteger(expectedVersion) || expectedVersion < 0) {
    return NextResponse.json({ error: "expectedVersion must be a non-negative integer" }, { status: 400 });
  }

  try {
    const record = await commitFlowState(prisma, hospitalId, state, expectedVersion, event);
    return NextResponse.json({ hospitalId, started: true, data: record.state, state: record.state, version: record.version, updatedAt: record.updatedAt });
  } catch (err) {
    if (err instanceof FlowConflictError) {
      return NextResponse.json(
        { error: "conflict", message: err.message, expectedVersion, actualVersion: err.actual },
        { status: 409 },
      );
    }
    throw err;
  }
}