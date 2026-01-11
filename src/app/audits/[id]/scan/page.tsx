import Link from "next/link";
import MassScanClient from "./MassScanClient";

export const revalidate = 0;

export default async function ScanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="p-4 w-screen max-w-none">
      <div className="max-w-4xl">
        <Link href={`/audits/${id}`} className="text-sm text-blue-600">
          ← Back to audit
        </Link>

        <h1 className="text-2xl font-bold mt-2">Mass Scan</h1>

        <p className="text-sm text-gray-600 mt-2">
          Scan Serial Numbers or Asset ID URLs. Press Enter after each scan.
        </p>

        <MassScanClient auditId={id} />
      </div>
    </main>
  );
}
