import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: auditId } = await ctx.params;

  const items = await prisma.auditItem.findMany({
    where: { auditId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ ok: true, items });
}
