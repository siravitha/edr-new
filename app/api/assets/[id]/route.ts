import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

interface Params { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ asset });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { name, status, cost, wardId, needsReview } = body;

  const asset = await prisma.asset.update({
    where: { id },
    data: {
      name: name ?? existing.name,
      status: status ?? existing.status,
      cost: cost !== undefined ? new prisma.Decimal(cost) : existing.cost,
      wardId: wardId ?? existing.wardId,
      needsReview: needsReview ?? existing.needsReview,
      version: existing.version + 1,
    },
  });

  return NextResponse.json({ asset });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.asset.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}