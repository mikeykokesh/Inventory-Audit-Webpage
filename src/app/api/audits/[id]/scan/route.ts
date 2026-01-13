import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type ScanType = "ASSET_ID" | "SERIAL";
type ScanStatus = "FOUND" | "ALREADY_FOUND" | "NOT_FOUND";

type ScanResult = {
  token: string;
  type: ScanType;
  status: ScanStatus;
  auditItemId?: string;
  message?: string;
};

function extractTokens(input: string) {
  const raw = (input || "").trim();
  if (!raw) return { assetIds: [] as string[], serials: [] as string[] };

  const assetIds: string[] = [];
  const serials: string[] = [];

  // AssetID=12345 in URLs
  for (const m of raw.matchAll(/AssetID=(\d+)/gi)) assetIds.push(m[1]);

  // URL that ends with digits
  const urlLike = raw.startsWith("http://") || raw.startsWith("https://");
  if (urlLike) {
    const endDigits = raw.match(/(\d+)\s*$/);
    if (endDigits) assetIds.push(endDigits[1]);
  }

  // split tokens from full string
  const parts = raw
    .split(/[\s,.;|]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const p of parts) {
    if (p.startsWith("http://") || p.startsWith("https://")) continue;

    if (/^\d{4,}$/.test(p)) {
      assetIds.push(p);
      continue;
    }

    if (/^[a-z0-9]+$/i.test(p)) serials.push(p);
  }

  return {
    assetIds: Array.from(new Set(assetIds)),
    serials: Array.from(new Set(serials)),
  };
}

function buildBinNote(expectedBin: string | null, foundBin: string) {
  return `Bin mismatch: expected ${expectedBin ?? "(blank)"}; found ${foundBin}`;
}

function buildReviewReason(expectedBin: string | null, foundBin: string) {
  return `Expected bin: ${expectedBin ?? "(blank)"} | Found bin: ${foundBin}`;
}

function appendNote(existing: string | null, noteToAdd: string) {
  if (!existing || existing.trim() === "") return noteToAdd;
  if (existing.includes(noteToAdd)) return existing; // avoid duplicates
  return `${existing}\n${noteToAdd}`;
}

async function logScanEvent(args: {
  auditId: string;
  auditItemId?: string | null;
  token: string;
  type: ScanType;
  status: ScanStatus;
  currentBin?: string | null;
  expectedBin?: string | null;
  foundBin?: string | null;
  message?: string | null;
}) {
  await prisma.scanEvent.create({
    data: {
      auditId: args.auditId,
      auditItemId: args.auditItemId ?? null,
      token: args.token,
      type: args.type,
      status: args.status,
      currentBin: args.currentBin ?? null,
      expectedBin: args.expectedBin ?? null,
      foundBin: args.foundBin ?? null,
      message: args.message ?? null,
    },
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: auditId } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const text = String(body?.text ?? "");
  const currentBin = body?.currentBin ? String(body.currentBin).trim() : null;

  const { assetIds, serials } = extractTokens(text);
  const results: ScanResult[] = [];
  const now = new Date();

  // -----------------------
  // Asset IDs
  // -----------------------
  for (const assetId of assetIds) {
    const item = await prisma.auditItem.findFirst({
      where: { auditId, assetId },
      include: { serials: true },
    });

    if (!item) {
      const message = "No row with this Asset ID in this audit.";
      results.push({ token: assetId, type: "ASSET_ID", status: "NOT_FOUND", message });
      await logScanEvent({
        auditId,
        auditItemId: null,
        token: assetId,
        type: "ASSET_ID",
        status: "NOT_FOUND",
        currentBin,
        message,
      });
      continue;
    }

    if (item.foundStatus === "FOUND") {
      results.push({ token: assetId, type: "ASSET_ID", status: "ALREADY_FOUND", auditItemId: item.id });
      await logScanEvent({
        auditId,
        auditItemId: item.id,
        token: assetId,
        type: "ASSET_ID",
        status: "ALREADY_FOUND",
        currentBin,
        expectedBin: item.expectedBin,
        foundBin: item.foundBin,
      });
      continue;
    }

    const binMismatch =
      !!currentBin && !!item.expectedBin && currentBin !== item.expectedBin;

    const noteToAdd =
      binMismatch && currentBin ? buildBinNote(item.expectedBin, currentBin) : null;

    const message = binMismatch
      ? "Found (wrong bin → flagged review + note added)."
      : "Found.";

    await prisma.auditItem.update({
      where: { id: item.id },
      data: {
        found: true,
        foundStatus: "FOUND",
        foundAt: now,
        foundBin: currentBin,

        reviewFlag: binMismatch ? true : item.reviewFlag,
        reviewReason:
          binMismatch && currentBin
            ? buildReviewReason(item.expectedBin, currentBin)
            : item.reviewReason,

        notes:
          binMismatch && currentBin && noteToAdd
            ? appendNote(item.notes, noteToAdd)
            : item.notes,
      },
    });

    results.push({ token: assetId, type: "ASSET_ID", status: "FOUND", auditItemId: item.id, message });

    await logScanEvent({
      auditId,
      auditItemId: item.id,
      token: assetId,
      type: "ASSET_ID",
      status: "FOUND",
      currentBin,
      expectedBin: item.expectedBin,
      foundBin: currentBin,
      message,
    });
  }

  // -----------------------
  // Serials
  // -----------------------
  for (const sn of serials) {
    const serialRow = await prisma.itemSerial.findFirst({
      where: { sn, auditItem: { auditId } },
      include: { auditItem: { include: { serials: true } } },
    });

    if (!serialRow) {
      const message = "No row with this Serial in this audit.";
      results.push({ token: sn, type: "SERIAL", status: "NOT_FOUND", message });
      await logScanEvent({
        auditId,
        auditItemId: null,
        token: sn,
        type: "SERIAL",
        status: "NOT_FOUND",
        currentBin,
        message,
      });
      continue;
    }

    // mark this SN found if not already
    if (!serialRow.found) {
      await prisma.itemSerial.update({
        where: { id: serialRow.id },
        data: { found: true, foundAt: now },
      });
    }

    const item = serialRow.auditItem;

    if (item.foundStatus === "FOUND") {
      results.push({ token: sn, type: "SERIAL", status: "ALREADY_FOUND", auditItemId: item.id });
      await logScanEvent({
        auditId,
        auditItemId: item.id,
        token: sn,
        type: "SERIAL",
        status: "ALREADY_FOUND",
        currentBin,
        expectedBin: item.expectedBin,
        foundBin: item.foundBin,
      });
      continue;
    }

    // All serials found?
    const allSerialsFound =
      item.serials.length > 0 &&
      item.serials.every((s) => (s.id === serialRow.id ? true : s.found));

    if (!allSerialsFound) {
      const message = "Serial matched; waiting for other serials in the row.";
      results.push({ token: sn, type: "SERIAL", status: "FOUND", auditItemId: item.id, message });
      await logScanEvent({
        auditId,
        auditItemId: item.id,
        token: sn,
        type: "SERIAL",
        status: "FOUND",
        currentBin,
        expectedBin: item.expectedBin,
        foundBin: currentBin,
        message,
      });
      continue;
    }

    // mark row found
    const binMismatch =
      !!currentBin && !!item.expectedBin && currentBin !== item.expectedBin;

    const noteToAdd =
      binMismatch && currentBin ? buildBinNote(item.expectedBin, currentBin) : null;

    const message = binMismatch
      ? "Serial matched; all serials found (wrong bin → flagged review + note added)."
      : "Serial matched; all serials found (row marked found).";

    await prisma.auditItem.update({
      where: { id: item.id },
      data: {
        found: true,
        foundStatus: "FOUND",
        foundAt: now,
        foundBin: currentBin,

        reviewFlag: binMismatch ? true : item.reviewFlag,
        reviewReason:
          binMismatch && currentBin
            ? buildReviewReason(item.expectedBin, currentBin)
            : item.reviewReason,

        notes:
          binMismatch && currentBin && noteToAdd
            ? appendNote(item.notes, noteToAdd)
            : item.notes,
      },
    });

    results.push({ token: sn, type: "SERIAL", status: "FOUND", auditItemId: item.id, message });

    await logScanEvent({
      auditId,
      auditItemId: item.id,
      token: sn,
      type: "SERIAL",
      status: "FOUND",
      currentBin,
      expectedBin: item.expectedBin,
      foundBin: currentBin,
      message,
    });
  }

  return NextResponse.json({
    ok: true,
    auditId,
    tokens: { assetIds, serials },
    results,
  });
}
