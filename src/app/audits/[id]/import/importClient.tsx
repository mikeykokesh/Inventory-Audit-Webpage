"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ImportClient({ auditId }: { auditId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("");

    if (!file) {
      setStatus("Please choose a file.");
      return;
    }

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch(`/api/audits/${auditId}/import`, {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      const text = await res.text();
      setStatus(`Import failed: ${text}`);
      return;
    }

    // Go back to audit page
    router.push(`/audits/${auditId}`);
    router.refresh();
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={onSubmit}>
      <div>
        <label className="block text-sm font-medium">Excel file (.xlsx)</label>
        <input
          className="mt-1 w-full"
          type="file"
          accept=".xlsx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
        />
        <p className="text-xs text-red-600 mt-2">
          Only upload Excel files you trust (from your organization).
        </p>
      </div>

      <button className="px-4 py-2 rounded bg-black text-white">Import</button>

      {status ? <pre className="text-xs whitespace-pre-wrap">{status}</pre> : null}

      <p className="text-xs text-gray-600">
        Header row must be line 1 and include: Item, Description, Pref. Vendor, On Hand, Physical
        Count, Count Variance, Bin Numbers, Serial/Lot Numbers, Asset ID, Notes, Current On Hand
        Value, Current Value Variance.
      </p>
    </form>
  );
}
