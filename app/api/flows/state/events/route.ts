// /api/flows/state/events — the per-hospital audit trail (FlowEvent), newest first.
// GET ?hospitalId=X[&caseId=Y][&limit=N] -> { hospitalId, caseId, count, events: [...] }
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listFlowEvents } from "@/lib/flow-store";
import { getActor, requireAction } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

const READ_ACTION = "approvals:read";

export async function GET(req: NextRequest) {
  const auth = await getActor(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const denied = requireAction(auth, READ_ACTION);
  if (denied) return denied;

  const hospitalId = req.nextUrl.searchParams.get("hospitalId");
  if (!hospitalId) return NextResponse.json({ error: "hospitalId is required" }, { status: 400 });
  const caseId = req.nextUrl.searchParams.get("caseId") ?? undefined;
  const rawLimit = Number(req.nextUrl.searchParams.get("limit") ?? 500);
  const events = await listFlowEvents(prisma, hospitalId, caseId, Number.isFinite(rawLimit) ? rawLimit : 500);
  return NextResponse.json({ hospitalId, caseId: caseId ?? null, count: events.length, events });
}