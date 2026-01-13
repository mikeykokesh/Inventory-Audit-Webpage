import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AuditItemsTable from "./AuditItemsTable";

export const revalidate = 0;

export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) return notFound();

  const audit = await prisma.audit.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!audit) return notFound();

  const total = audit.items.length;
  const found = audit.items.filter((i) => i.found === true).length;

  return (
    <main className="p-4 w-screen max-w-none">
<div className="flex items-start justify-between gap-4">
  <div>
    <Link href="/" className="text-sm text-blue-600">← Back</Link>
    <h1 className="text-2xl font-bold mt-2">{audit.name}</h1>
    {audit.notes ? <p className="text-gray-700 mt-2">{audit.notes}</p> : null}
  </div>

  <div className="flex gap-2">
    <Link className="px-3 py-1 rounded border bg-white" href={`/audits/${audit.id}/import`}>
      Import Excel
    </Link>

<a
  className="px-3 py-1 rounded border bg-white"
  href={`/api/audits/${audit.id}/export`}
>
  Export Excel
</a>

<Link
  className="px-3 py-1 rounded border bg-white"
  href={`/audits/${audit.id}/scan`}
>
  Mass Scan
</Link>

<Link className="px-3 py-1 rounded border bg-white" href={`/audits/${audit.id}/trail`}>
  Audit Trail
</Link>

  </div>
</div>
      <AuditItemsTable items={audit.items as any} auditId={audit.id} />
    </main>
  );
}
