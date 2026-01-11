import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function toNullIfEmpty(v: unknown) {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

function toNumberOrNull(v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type FoundStatus = "FOUND" | "MISSING" | null;

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await ctx.params;
  const body = await req.json();

  const onHand = toNumberOrNull(body.onHand);
  const physicalCount = toNumberOrNull(body.physicalCount);

  // Formula: Count Variance = On Hand - Physical Count
  const countVariance =
    onHand === null || physicalCount === null ? null : onHand - physicalCount;

  const foundStatus: FoundStatus =
    body.foundStatus === "FOUND" || body.foundStatus === "MISSING"
      ? body.foundStatus
      : null;

  // Derive the boolean + timestamps from foundStatus
  const found = foundStatus === "FOUND";
  const foundAt = found ? new Date() : null;
  const foundBin = found ? toNullIfEmpty(body.foundBin) : null;

  const reviewFlag = Boolean(body.reviewFlag);
  const reviewReason = reviewFlag ? toNullIfEmpty(body.reviewReason) ?? "Needs review" : null;

  const updated = await prisma.auditItem.update({
    where: { id: itemId },
    data: {
      item: toNullIfEmpty(body.item),
      description: toNullIfEmpty(body.description),
      prefVendor: toNullIfEmpty(body.prefVendor),

      onHand,
      physicalCount,
      countVariance,

      expectedBin: toNullIfEmpty(body.expectedBin),
      serialsRaw: toNullIfEmpty(body.serialsRaw),
      assetId: toNullIfEmpty(body.assetId),
      notes: toNullIfEmpty(body.notes),

      currentOnHandValue: toNumberOrNull(body.currentOnHandValue),
      currentValueVariance: toNumberOrNull(body.currentValueVariance),

      found,
      foundStatus,
      foundAt,
      foundBin,

      reviewFlag,
      reviewReason,
    },
  });

  return NextResponse.json({ ok: true, id: updated.id });
}
