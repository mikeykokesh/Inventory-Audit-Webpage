import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export const revalidate = 0;

export default async function TrailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const audit = await prisma.audit.findUnique({
    where: { id },
    select: { id: true, name: true },
  });

  if (!audit) return notFound();

  const events = await prisma.scanEvent.findMany({
    where: { auditId: id },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      auditItem: {
        select: {
          id: true,
          item: true,
          assetId: true,
          expectedBin: true,
        },
      },
    },
  });

  return (
    <main className="p-4 w-screen max-w-none">
      <div className="max-w-6xl">
        <Link href={`/audits/${id}`} className="text-sm text-blue-600">
          ← Back to audit
        </Link>

        <h1 className="text-2xl font-bold mt-2">Audit Trail</h1>
        <p className="text-sm text-gray-600 mt-1">{audit.name}</p>

        <div className="mt-4 border rounded overflow-auto max-h-[75vh]">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="text-left">
                <th className="p-2 w-44">Time</th>
                <th className="p-2 w-28">Type</th>
                <th className="p-2">Token</th>
                <th className="p-2 w-40">Status</th>
                <th className="p-2 w-36">Current Bin</th>
                <th className="p-2 w-36">Expected Bin</th>
                <th className="p-2">Matched Item</th>
                <th className="p-2">Message</th>
              </tr>
            </thead>

            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td className="p-4 text-gray-600" colSpan={8}>
                    No scan events yet.
                  </td>
                </tr>
              ) : (
                events.map((e) => (
                  <tr key={e.id} className="border-t align-top">
                    <td className="p-2 text-xs text-gray-600">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td className="p-2">{e.type}</td>
                    <td className="p-2 font-mono">{e.token}</td>
                    <td className="p-2">
                      {e.status === "FOUND"
                        ? "✅ FOUND"
                        : e.status === "ALREADY_FOUND"
                        ? "↩️ Already"
                        : "❌ Not Found"}
                    </td>
                    <td className="p-2 font-mono">{e.currentBin ?? ""}</td>
                    <td className="p-2 font-mono">
                      {e.expectedBin ?? e.auditItem?.expectedBin ?? ""}
                    </td>
                    <td className="p-2">
                      {e.auditItem ? (
                        <span className="text-gray-800">
                          {e.auditItem.item ?? e.auditItem.assetId ?? e.auditItem.id}
                        </span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="p-2 text-gray-700">{e.message ?? ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500 mt-2">Showing most recent 500 events.</p>
      </div>
    </main>
  );
}
