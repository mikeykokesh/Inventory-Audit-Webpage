import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function getRequestOrigin(req: Request) {
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "localhost:3000";
  return `${proto}://${host}`;
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const name = String(formData.get("name") ?? "").trim();
  const notesRaw = formData.get("notes");
  const notes = notesRaw === null ? null : String(notesRaw).trim() || null;

  if (!name) {
    return NextResponse.json(
      { ok: false, error: "Name is required" },
      { status: 400 }
    );
  }

  const audit = await prisma.audit.create({
    data: { name, notes },
  });

  const origin = getRequestOrigin(req);
  const url = new URL(`/audits/${audit.id}`, origin);

  // 303 = redirect after POST (safe for forms)
  return NextResponse.redirect(url, { status: 303 });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const auditId = url.searchParams.get("id");

  if (!auditId) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }

  await prisma.audit.delete({
    where: { id: auditId },
  });

  return new NextResponse(null, { status: 204 });
}
