import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Body = {
  raw: string;
  auditId: string;
  mode: "mass" | "bin";
  binLock: string | null;
  assetId: string | null;
  serialTokens: string[]; // may contain 1+ serials
};

function cleanSerial(sn: string) {
  return sn.trim();
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  if (!body.auditId) {
    return NextResponse.json({ error: "Missing auditId" }, { status: 400 });
  }

  const binLock = body.binLock?.trim() || null;

  // 1) If assetId is present, find matching item by assetId
  if (body.assetId) {
    const item = await prisma.auditItem.findFirst({
      where: { auditId: body.auditId, assetId: body.assetId },
    });

    if (!item) {
      return NextResponse.json(
        { error: `No row found for Asset ID ${body.assetId}` },
        { status: 404 }
      );
    }

    const updated = await markItemFoundAndReviewIfNeeded(item.id, item.expectedBin, binLock);
    return NextResponse.json({ message: updated.message });
  }

  // 2) Otherwise treat as serial scan.
  // If scan contains multiple serials, we try to mark each one found.
  const serials = (body.serialTokens || []).map(cleanSerial).filter(Boolean);
  if (serials.length === 0) {
    return NextResponse.json(
      { error: "Scan did not contain an Asset ID or any serials" },
      { status: 400 }
    );
  }

  // Find any serial matches in this audit.
  // We update per-serial, then compute item "found" state.
  let foundCount = 0;
  let notFoundCount = 0;

  for (const sn of serials) {
    const s = await prisma.itemSerial.findFirst({
      where: { sn, auditItem: { auditId: body.auditId } },
      include: { auditItem: true },
    });

    if (!s) {
      notFoundCount++;
      continue;
    }

    if (!s.found) {
      await prisma.itemSerial.update({
        where: { id: s.id },
        data: { found: true, foundAt: new Date() },
      });
    }
    foundCount++;

    // After updating a serial, check if all serials for that row are found.
    const allSerials = await prisma.itemSerial.findMany({
      where: { auditItemId: s.auditItemId },
    });
    const allFound = allSerials.length > 0 && allSerials.every((x) => x.found);

    if (allFound && !s.auditItem.found) {
      await prisma.auditItem.update({
        where: { id: s.auditItemId },
        data: {
          found: true,
          foundAt: new Date(),
          foundBin: binLock, // in mass mode this will be null; that's ok
        },
      });

      // Bin-by-bin review logic
      if (binLock && s.auditItem.expectedBin && s.auditItem.expectedBin !== binLock) {
        await prisma.auditItem.update({
          where: { id: s.auditItemId },
          data: {
            reviewFlag: true,
            reviewReason: `Found while locked to bin ${binLock} but expected bin is ${s.auditItem.expectedBin}`,
          },
        });
      }
    }
  }

  return NextResponse.json({
    message: `Serial scan processed. Matched: ${foundCount}, Not matched: ${notFoundCount}`,
  });
}

async function markItemFoundAndReviewIfNeeded(
  itemId: string,
  expectedBin: string | null,
  binLock: string | null
) {
  await prisma.auditItem.update({
    where: { id: itemId },
    data: {
      found: true,
      foundAt: new Date(),
      foundBin: binLock,
    },
  });

  if (binLock && expectedBin && expectedBin !== binLock) {
    await prisma.auditItem.update({
      where: { id: itemId },
      data: {
        reviewFlag: true,
        reviewReason: `Found while locked to bin ${binLock} but expected bin is ${expectedBin}`,
      },
    });
    return { message: `Asset marked found (REVIEW: expected ${expectedBin}, found in ${binLock})` };
  }

  return { message: "Asset marked found" };
}
