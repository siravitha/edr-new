import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Available", IN_USE: "In use", REPAIR: "Repair",
  QUARANTINED: "Quarantined", DISPOSED: "Disposed",
};

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const search = (p.get("search") || "").toLowerCase();
  const status = p.get("status") || "";
  const wardId = p.get("wardId") || "";
  const hospitalId = p.get("hospitalId") || "";

  const where: Record<string, unknown> = {};
  if (hospitalId) where.hospitalId = hospitalId;
  if (wardId) where.wardId = wardId;
  if (status) where.status = status;
  if (search) where.OR = [{ assetNo: { contains: search } }, { name: { contains: search } }];

  const assets = await prisma.asset.findMany({ where, orderBy: { id: "desc" } });

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margin = 32;
  const now = new Date();

  doc.setFontSize(16);
  doc.text("UTH Smart Assets - Asset Register Report", margin, margin);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Generated ${now.toISOString()} | ${assets.length} assets`, margin, margin + 16);

  autoTable(doc, {
    startY: margin + 32,
    margin: { left: margin, right: margin, top: margin },
    head: [["#", "Asset No", "Name", "Ward", "Status", "Cost (THB)", "Version"]],
    body: assets.map((a, i) => [
      String(i + 1), a.assetNo, a.name, a.wardId || "-",
      STATUS_LABEL[a.status] || a.status, Number(a.cost).toLocaleString("en-US"), String(a.version),
    ]),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
    columnStyles: { 5: { halign: "right" }, 6: { halign: "center" } },
  });

  const bytes = doc.output("arraybuffer");
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="uth-assets-${now.toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
