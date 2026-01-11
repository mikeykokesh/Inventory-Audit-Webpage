"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

function normalizeSerialTokens(input: string): string[] {
  // Supports:
  // - single: 8216200227E6CB
  // - string: 8216200227E6CB. 8216200227E6C6, 8216200227E6C4
  // We'll split on common separators: dot, comma, whitespace
  return input
    .split(/[\s,\.]+/g)
    .map((t) => t.trim())
    .filter(Boolean);
}

function extractAssetId(input: string): string | null {
  // Accepts:
  // - 170403
  // - https://...AssetID=170403
  const match = input.match(/AssetID=(\d+)/i);
  if (match?.[1]) return match[1];
  const digitsOnly = input.trim().match(/^\d+$/);
  if (digitsOnly) return input.trim();
  return null;
}

export default function ScanClient({
  auditId,
  auditName,
}: {
  auditId: string;
  auditName: string;
}) {
  const [scanValue, setScanValue] = useState("");
  const [binLock, setBinLock] = useState<string>("");
  const [mode, setMode] = useState<"mass" | "bin">("mass");
  const [lastResult, setLastResult] = useState<string>("");

  const placeholder = useMemo(() => {
    return mode === "mass"
      ? "Scan Asset ID or Serial Number and press Enter"
      : "Bin mode: lock to a bin, then scan Asset ID / SN";
  }, [mode]);

  async function submitScan(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;

    const assetId = extractAssetId(trimmed);
    const serialTokens = normalizeSerialTokens(trimmed);

    const payload = {
      raw: trimmed,
      auditId,
      mode,
      binLock: mode === "bin" ? (binLock.trim() || null) : null,
      assetId,
      serialTokens,
    };

    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      setLastResult(`❌ ${data.error || "Scan failed"}`);
      return;
    }
    setLastResult(`✅ ${data.message}`);
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/audits/${auditId}`} className="text-sm text-blue-600">
            ← Back to Audit
          </Link>
          <h1 className="text-2xl font-bold mt-2">Scanner: {auditName}</h1>
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        <button
          className={`px-3 py-2 rounded border ${mode === "mass" ? "bg-black text-white" : ""}`}
          onClick={() => setMode("mass")}
        >
          Mass Scan
        </button>
        <button
          className={`px-3 py-2 rounded border ${mode === "bin" ? "bg-black text-white" : ""}`}
          onClick={() => setMode("bin")}
        >
          Bin-by-bin
        </button>
      </div>

      {mode === "bin" ? (
        <div className="mt-4">
          <label className="block text-sm font-medium">Locked Bin</label>
          <input
            className="mt-1 w-full border rounded p-2"
            value={binLock}
            onChange={(e) => setBinLock(e.target.value)}
            placeholder="e.g. BIN-A12"
          />
          <p className="text-xs text-gray-600 mt-1">
            If an item expected in another bin is found while locked, it will be flagged for review.
          </p>
        </div>
      ) : null}

      <div className="mt-6">
        <label className="block text-sm font-medium">Scan input</label>
        <input
          className="mt-1 w-full border rounded p-3 text-lg"
          value={scanValue}
          onChange={(e) => setScanValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitScan(scanValue);
              setScanValue("");
            }
          }}
          placeholder={placeholder}
          autoFocus
        />
        <div className="mt-3 text-sm">{lastResult}</div>
      </div>

      <div className="mt-6 text-xs text-gray-600">
        Accepted scans:
        <ul className="list-disc ml-5 mt-2">
          <li>Asset ID: <code>170403</code></li>
          <li>Asset URL: <code>...AssetID=170403</code></li>
          <li>SN single: <code>8216200227E6CB</code></li>
          <li>SN string: <code>8216200227E6CB. 8216200227E6C6, 8216200227E6C4</code></li>
        </ul>
      </div>
    </main>
  );
}
