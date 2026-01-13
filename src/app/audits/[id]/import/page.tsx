import Link from "next/link";
import ImportForm from "./ImportForm";

export const revalidate = 0;

export default async function ImportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="p-4 w-screen max-w-none">
      <div className="max-w-3xl">
        <Link href={`/audits/${id}`} className="text-sm text-blue-600">
          ← Back to audit
        </Link>

        <h1 className="text-2xl font-bold mt-2">Import Excel</h1>

        <p className="text-sm text-gray-600 mt-2">
          Excel file (.xlsx). Only upload files you trust (from your organization).
        </p>

        <ImportForm auditId={id} />
      </div>
    </main>
  );
}
