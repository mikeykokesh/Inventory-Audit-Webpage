import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

function safeFileName(name: string) {
  return name
    .replace(/[^a-z0-9\-_\s]/gi, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: auditId } = await ctx.params;

  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  // Build rows matching your Excel headers
  const rows = audit.items.map((i) => ({
    Item: i.item ?? "",
    Description: i.description ?? "",
    "Pref. Vendor": i.prefVendor ?? "",
    "On Hand": i.onHand ?? "",
    "Physical Count": i.physicalCount ?? "",
    "Count Variance": i.countVariance ?? "",
    "Bin Numbers": i.expectedBin ?? "",
    "Serial/Lot Numbers": i.serialsRaw ?? "",
    "Asset ID": i.assetId ?? "",
    Notes: i.notes ?? "",
    "Current On Hand Value": i.currentOnHandValue ?? "",
    "Current Value Variance": i.currentValueVariance ?? "",

    // Extra helpful columns (feel free to delete if you don’t want them)
    "Found Status": i.foundStatus ?? "",
    Found: i.found ? "YES" : "NO",
    "Found Bin": i.foundBin ?? "",
    "Needs Review": i.reviewFlag ? "YES" : "NO",
    "Review Reason": i.reviewReason ?? "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  XLSX.utils.book_append_sheet(wb, ws, "Audit Items");

  const fileBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const fileName = `${safeFileName(audit.name || "audit")}_${audit.id}.xlsx`;

  return new NextResponse(fileBuffer as any, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
