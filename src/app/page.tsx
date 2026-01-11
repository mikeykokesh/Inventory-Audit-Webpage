import Link from "next/link";
import { prisma } from "@/lib/prisma";
import DeleteAuditButton from "./DeleteAuditButton";

export const revalidate = 0;

export default async function Home() {
  const audits = await prisma.audit.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory Audits</h1>
        <Link
          className="px-4 py-2 rounded bg-black text-white"
          href="/audits/new"
        >
          New Audit
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {audits.length === 0 ? (
          <p className="text-gray-600">No audits yet.</p>
        ) : (
          audits.map((a) => (
            <div
              key={a.id}
              className="border rounded p-4 flex items-start justify-between gap-4"
            >
              <Link href={`/audits/${a.id}`} className="flex-1">
                <div className="font-semibold">{a.name}</div>
                <div className="text-sm text-gray-600">
                  {a._count.items} items
                </div>
                {a.notes ? (
                  <div className="text-sm text-gray-700 mt-1">{a.notes}</div>
                ) : (
                  <div className="text-sm text-gray-500 mt-1 italic">
                    (no notes)
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  Created: {new Date(a.createdAt).toLocaleString()}
                </div>
              </Link>

              <DeleteAuditButton auditId={a.id} auditName={a.name} />
            </div>
          ))
        )}
      </div>
    </main>
  );
}
