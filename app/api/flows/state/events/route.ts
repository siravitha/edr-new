// /api/flows/state/events — the per-hospital audit trail (FlowEvent), newest first.
// GET ?hospitalId=X[&caseId=Y][&limit=N] -> { hospitalId, caseId, count, events: [...] }
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listFlowEvents } from "@/lib/flow-store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const hospitalId = req.nextUrl.searchParams.get("hospitalId");
  if (!hospitalId) return NextResponse.json({ error: "hospitalId is required" }, { status: 400 });
  const caseId = req.nextUrl.searchParams.get("caseId") ?? undefined;
  const rawLimit = Number(req.nextUrl.searchParams.get("limit") ?? 500);
  const events = await listFlowEvents(prisma, hospitalId, caseId, Number.isFinite(rawLimit) ? rawLimit : 500);
  return NextResponse.json({ hospitalId, caseId: caseId ?? null, count: events.length, events });
}