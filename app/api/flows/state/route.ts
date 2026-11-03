// /api/flows/state — per-hospital FlowState read + CAS commit.
// GET  ?hospitalId=X        -> { started, state, version, updatedAt }  (state is null until first commit)
// POST { hospitalId, state, expectedVersion, event? }
//        -> 200 { hospitalId, state, version, updatedAt }
//        -> 409 { error:"conflict", expectedVersion, actualVersion }  on a CAS collision
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFlowState, commitFlowState, FlowConflictError, type FlowEventInput } from "@/lib/flow-store";
import type { FlowState } from "@/lib/procurement-flow";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const hospitalId = req.nextUrl.searchParams.get("hospitalId");
  if (!hospitalId) return NextResponse.json({ error: "hospitalId is required" }, { status: 400 });
  const record = await getFlowState(prisma, hospitalId);
  if (!record) return NextResponse.json({ hospitalId, started: false, state: null, version: 0 });
  return NextResponse.json({ hospitalId, started: true, state: record.state, version: record.version, updatedAt: record.updatedAt });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const hospitalId = typeof body.hospitalId === "string" ? body.hospitalId : "";
  const state = body.state as FlowState | undefined;
  const expectedVersion = body.expectedVersion;
  const event = body.event as FlowEventInput | undefined;

  if (!hospitalId) return NextResponse.json({ error: "hospitalId is required" }, { status: 400 });
  if (!state || typeof state.revision !== "number") return NextResponse.json({ error: "state.revision is required" }, { status: 400 });
  if (typeof expectedVersion !== "number" || !Number.isInteger(expectedVersion) || expectedVersion < 0) {
    return NextResponse.json({ error: "expectedVersion must be a non-negative integer" }, { status: 400 });
  }

  try {
    const record = await commitFlowState(prisma, hospitalId, state, expectedVersion, event);
    return NextResponse.json({ hospitalId, started: true, state: record.state, version: record.version, updatedAt: record.updatedAt });
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