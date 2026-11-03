import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getActor, requireAction, scopedWhere, type AuthError } from "../../../lib/api-guard";

function reject(e: AuthError) {
  return NextResponse.json({ error: e.error, message: e.message }, { status: e.status });
}

export async function GET(request: NextRequest) {
  const auth = await getActor(request);
  if (!auth.ok) return reject(auth);
  const gate = requireAction(auth, "assets:read");
  if (!gate.ok) return reject(gate);
  const actor = gate.value;

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") || 1));
  const pageSize = Math.min(100, Number(params.get("pageSize") || 25));
  const search = (params.get("search") || "").toLowerCase();
  const status = params.get("status") || "";
  const wardId = params.get("wardId") || "";
  const hospitalId = params.get("hospitalId") || "";

  const where: Record<string, unknown> = {};
  if (hospitalId) where.hospitalId = hospitalId;
  if (wardId) where.wardId = wardId;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { assetNo: { contains: search } },
      { name: { contains: search } },
    ];
  }

  // RBAC: WARD is scoped to their assigned wards; other roles see all wards.
  const scope = scopedWhere(actor);
  const finalWhere: Record<string, unknown> =
    Object.keys(scope).length > 0 ? { AND: [where, scope] } : where;

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({
      where: finalWhere,
      orderBy: { id: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.asset.count({ where: finalWhere }),
  ]);

  return NextResponse.json({ assets, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

export async function POST(request: NextRequest) {
  const auth = await getActor(request);
  if (!auth.ok) return reject(auth);
  const gate = requireAction(auth, "assets:create");
  if (!gate.ok) return reject(gate);

  const body = await request.json();
  const { hospitalId, wardId, receiptId, assetNo, name, cost, status } = body;

  if (!hospitalId || !assetNo || !name) {
    return NextResponse.json({ error: "hospitalId, assetNo and name are required" }, { status: 400 });
  }

  const dupCheck = await prisma.asset.findFirst({ where: { hospitalId, assetNo } });
  if (dupCheck) {
    return NextResponse.json({ error: `Asset ${assetNo} already exists for this hospital` }, { status: 409 });
  }

  const asset = await prisma.asset.create({
    data: {
      hospitalId,
      wardId: wardId || "",
      assetNo,
      name,
      status: status || "AVAILABLE",
      cost: cost ?? 0,
      version: 0,
      needsReview: false,
    },
  });

  return NextResponse.json({ asset }, { status: 201 });
}
