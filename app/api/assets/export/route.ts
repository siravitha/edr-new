import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import ExcelJS from "exceljs";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
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

  const assets = await prisma.asset.findMany({
    where,
    orderBy: { assetNo: "asc" },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "UTH Smart Assets";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Assets");
  sheet.columns = [
    { header: "Asset No", key: "assetNo", width: 18 },
    { header: "Name", key: "name", width: 42 },
    { header: "Ward", key: "wardId", width: 10 },
    { header: "Status", key: "status", width: 16 },
    { header: "Cost (THB)", key: "cost", width: 16 },
    { header: "Version", key: "version", width: 10 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const a of assets) {
    sheet.addRow({
      assetNo: a.assetNo,
      name: a.name,
      wardId: a.wardId,
      status: a.status,
      cost: Number(a.cost),
      version: a.version,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `assets-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

