"use client";

import { useState } from "react";

export default function ImportForm({ auditId }: { auditId: string }) {
  const [fileName, setFileName] = useState("No file selected");

  return (
    <form
      className="mt-6 space-y-4 border rounded p-6 bg-white"
      action={`/api/audits/${auditId}/import`}
      method="post"
      encType="multipart/form-data"
    >
      <input
        id="file"
        name="file"
        type="file"
        accept=".xlsx"
        required
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          setFileName(f ? f.name : "No file selected");
        }}
      />

      <div className="flex items-center gap-4">
        <label
          htmlFor="file"
          className="px-4 py-2 rounded bg-gray-100 border cursor-pointer hover:bg-gray-200"
        >
          Choose Excel file
        </label>

        <span className="text-sm text-gray-600 italic">{fileName}</span>
      </div>

      <button className="px-4 py-2 rounded bg-black text-white" type="submit">
        Import
      </button>

      <div className="text-xs text-gray-500 pt-2">
        Header row must be line 1 and include: Item, Description, Pref. Vendor, On Hand,
        Physical Count, Count Variance, Bin Numbers, Serial/Lot Numbers, Asset ID, Notes,
        Current On Hand Value, Current Value Variance.
      </div>
    </form>
  );
}
