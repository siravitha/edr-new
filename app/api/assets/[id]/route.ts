import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../../lib/prisma";
import { getActor, requireAction, singleAssetOk, type AuthError } from "../../../../lib/api-guard";

interface Params { params: Promise<{ id: string }> }

function reject(e: AuthError) {
  return NextResponse.json({ error: e.error, message: e.message }, { status: e.status });
}

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await getActor(request);
  if (!auth.ok) return reject(auth);
  const gate = requireAction(auth, "assets:read");
  if (!gate.ok) return reject(gate);

  const { id } = await params;
  const asset = await prisma.asset.findUnique({ where: { id } });
  const check = singleAssetOk(gate.value, asset);
  if (!check.ok) return reject(check);
  return NextResponse.json({ asset });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await getActor(request);
  if (!auth.ok) return reject(auth);
  const gate = requireAction(auth, "assets:update");
  if (!gate.ok) return reject(gate);

  const { id } = await params;
  const existing = await prisma.asset.findUnique({ where: { id } });
  const check = singleAssetOk(gate.value, existing);
  if (!check.ok) return reject(check);

  const body = await request.json();
  const { name, status, cost, wardId, needsReview } = body;

  const asset = await prisma.asset.update({
    where: { id },
    data: {
      name: name ?? existing.name,
      status: status ?? existing.status,
      cost: cost !== undefined ? new Prisma.Decimal(cost) : existing.cost,
      wardId: wardId ?? existing.wardId,
      needsReview: needsReview ?? existing.needsReview,
      version: existing.version + 1,
    },
  });

  return NextResponse.json({ asset });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await getActor(request);
  if (!auth.ok) return reject(auth);
  const gate = requireAction(auth, "assets:delete");
  if (!gate.ok) return reject(gate);

  const { id } = await params;
  const existing = await prisma.asset.findUnique({ where: { id } });
  const check = singleAssetOk(gate.value, existing);
  if (!check.ok) return reject(check);

  await prisma.asset.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
