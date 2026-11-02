import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const hospitalId = searchParams.get("hospitalId") || "";
    const wardId = searchParams.get("wardId") || "";
    const status = searchParams.get("status") || "";
    const year = searchParams.get("year") || "";

    const assetWhere: Record<string, unknown> = {};
    if (hospitalId) assetWhere.hospitalId = hospitalId;
    if (wardId) assetWhere.wardId = wardId;
    if (status) assetWhere.status = status;

    // KPIs
    const [totalAssets, assetsWithCost, activePlans, openPOs, pendingClaims, disposedAssets] = await Promise.all([
      prisma.asset.count({ where: assetWhere }),
      prisma.asset.aggregate({ _sum: { cost: true }, where: assetWhere }),
      prisma.plan.count({ where: { approved: true, ...(year ? { fiscalYear: parseInt(year) } : {}) } }),
      prisma.purchaseOrder.count({ where: { status: { notIn: ["CANCELLED", "COMPLETED"] }, ...(hospitalId ? { hospitalId } : {}) } }),
      prisma.paymentClaim.count({ where: { status: { in: ["DRAFT", "PENDING"] }, ...(hospitalId ? { hospitalId } : {}) } }),
      prisma.asset.count({ where: { ...assetWhere, status: "DISPOSED" } }),
    ]);

    // By Status (groupBy)
    const byStatusRaw = await prisma.asset.groupBy({
      by: ["status"],
      where: assetWhere,
      _count: { _all: true },
    });
    const byStatus = byStatusRaw.map(s => ({ status: s.status, count: s._count._all }));

    // By Ward (as "department" equivalent)
    const byWardRaw = await prisma.asset.groupBy({
      by: ["wardId"],
      where: assetWhere,
      _count: { _all: true },
      _sum: { cost: true },
    });
    const byDepartment = byWardRaw.map(w => ({
      department: w.wardId || "-",
      count: w._count._all,
      value: Math.round(Number(w._sum.cost || 0) / 1000),
    })).sort((a, b) => b.count - a.count).slice(0, 8);

    // Monthly Trend - last 12 months (based on AuditLog createdAt)
    const now = new Date();
    const monthlyTrend = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthLabel = d.toLocaleDateString("en", { month: "short", year: "2-digit" });
      const [created, completed] = await Promise.all([
        prisma.asset.count({ where: { ...assetWhere } }),
        prisma.auditLog.count({ where: { createdAt: { gte: d, lt: nextD }, ...(hospitalId ? { hospitalId } : {}) } }),
      ]);
      monthlyTrend.push({ month: monthLabel, created, completed });
    }

    // Procurement Pipeline
    const pipelineRaw = await prisma.purchaseOrder.groupBy({
      by: ["status"],
      where: hospitalId ? { hospitalId } : {},
      _count: { _all: true },
    });
    const procurementPipeline = pipelineRaw.map(p => ({
      stage: p.status,
      count: p._count._all,
      value: 0,
    }));

    // Recent Activity (AuditLog)
    const auditLogs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      where: hospitalId ? { hospitalId } : {},
    });
    const recentActivity = auditLogs.map(log => ({
      id: log.id,
      action: log.eventType,
      actor: log.actorSubject || "system",
      timestamp: log.createdAt?.toISOString() || "",
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalAssets,
        totalValue: Number(assetsWithCost._sum.cost || 0),
        activePlans,
        openPOs,
        pendingClaims,
        overdueItems: disposedAssets,
        byDepartment,
        byStatus,
        monthlyTrend,
        procurementPipeline,
        recentActivity,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}