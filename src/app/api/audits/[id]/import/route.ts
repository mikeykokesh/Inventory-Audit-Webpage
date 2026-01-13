import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toStringOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function splitSerials(raw: unknown): string[] {
  const s = toStringOrNull(raw);
  if (!s) return [];
  // handle: "8216...E6CB. 8216...E6C6, 8216...E6C4"
  return s
    .split(/[\s,.;]+/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

const REQUIRED_HEADERS = [
  "Item",
  "Description",
  "Pref. Vendor",
  "On Hand",
  "Physical Count",
  "Count Variance",
  "Bin Numbers",
  "Serial/Lot Numbers",
  "Asset ID",
  "Notes",
  "Current On Hand Value",
  "Current Value Variance",
];

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: auditId } = await ctx.params;

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });

  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

  // Validate headers (row 1)
  const first = rows[0] ?? {};
  const present = new Set(Object.keys(first));
  const missing = REQUIRED_HEADERS.filter((h) => !present.has(h));

  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required headers: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  // Import rows
  for (const r of rows) {
    const onHand = toNumberOrNull(r["On Hand"]);
    const physical = toNumberOrNull(r["Physical Count"]);

    // We enforce your formula on import too:
    const variance =
      onHand === null || physical === null ? null : onHand - physical;

    const item = await prisma.auditItem.create({
      data: {
        auditId,

        item: toStringOrNull(r["Item"]),
        description: toStringOrNull(r["Description"]),
        prefVendor: toStringOrNull(r["Pref. Vendor"]),

        onHand,
        physicalCount: physical,
        countVariance: variance,

        expectedBin: toStringOrNull(r["Bin Numbers"]),
        serialsRaw: toStringOrNull(r["Serial/Lot Numbers"]),
        assetId: toStringOrNull(r["Asset ID"]),
        notes: toStringOrNull(r["Notes"]),

        currentOnHandValue: toNumberOrNull(r["Current On Hand Value"]),
        currentValueVariance: toNumberOrNull(r["Current Value Variance"]),

        // Start blank (you can mark later)
        found: false,
        foundStatus: null,
        reviewFlag: false,
        reviewReason: null,
      },
    });

    // Optional: create per-SN records
    const serialList = splitSerials(r["Serial/Lot Numbers"]);
    for (const sn of serialList) {
      // Upsert avoids duplicates without needing createMany skipDuplicates
      await prisma.itemSerial.upsert({
        where: { auditItemId_sn: { auditItemId: item.id, sn } },
        update: {},
        create: { auditItemId: item.id, sn },
      });
    }
  }

  // After import, redirect back to audit page
return new NextResponse(null, {
  status: 303,
  headers: {
    Location: `/audits/${auditId}`,
  },
});
}
