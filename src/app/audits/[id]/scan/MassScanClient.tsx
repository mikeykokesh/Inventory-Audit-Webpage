"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Result = {
  token: string;
  type: "ASSET_ID" | "SERIAL";
  status: "FOUND" | "ALREADY_FOUND" | "NOT_FOUND";
  auditItemId?: string;
  message?: string;
};

export default function MassScanClient({ auditId }: { auditId: string }) {
  const storageKey = `massscan:${auditId}`;

  const [currentBin, setCurrentBin] = useState("");
  const [binLocked, setBinLocked] = useState(false);

  const [scanInput, setScanInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Load persisted lock/bin
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { currentBin?: string; binLocked?: boolean };
      if (typeof parsed.currentBin === "string") setCurrentBin(parsed.currentBin);
      if (typeof parsed.binLocked === "boolean") setBinLocked(parsed.binLocked);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist lock/bin
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ currentBin, binLocked }));
    } catch {}
  }, [storageKey, currentBin, binLocked]);

  const counts = useMemo(() => {
    let found = 0,
      already = 0,
      notFound = 0;
    for (const r of results) {
      if (r.status === "FOUND") found++;
      else if (r.status === "ALREADY_FOUND") already++;
      else notFound++;
    }
    return { found, already, notFound };
  }, [results]);

  const effectiveBin = currentBin.trim();

  async function processText(text: string) {
    const t = text.trim();
    if (!t) return;

    if (binLocked && !effectiveBin) {
      setResults((prev) => [
        {
          token: t,
          type: "SERIAL",
          status: "NOT_FOUND",
          message: "Bin is locked, but no bin number is set. Enter a bin first.",
        },
        ...prev,
      ]);
      inputRef.current?.focus();
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/audits/${auditId}/scan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: t,
          currentBin: effectiveBin || null,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setResults((prev) => [
          { token: t, type: "SERIAL", status: "NOT_FOUND", message: "Scan failed." },
          ...prev,
        ]);
      } else {
        const newResults: Result[] = (data.results || []) as Result[];
        setResults((prev) => [...newResults.reverse(), ...prev].slice(0, 200));

        // notify audit pages to refresh
        try {
          const bc = new BroadcastChannel("audit-scan");
          bc.postMessage({ auditId });
          bc.close();
        } catch {}

        // fallback
        try {
          localStorage.setItem(`audit-scan:${auditId}`, String(Date.now()));
        } catch {}
      }
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px]">
          <label className="block text-sm font-medium">Current Bin</label>

          <div className="flex gap-2">
            <input
              className="border rounded p-2 w-48"
              placeholder="ex: 321(1)"
              value={currentBin}
              onChange={(e) => setCurrentBin(e.target.value)}
              disabled={binLocked}
            />

            <button
              type="button"
              className="px-3 py-2 rounded border bg-white"
              onClick={() => setBinLocked((v) => !v)}
              title="Lock to this bin so every scan uses it"
            >
              {binLocked ? "Unlock" : "Lock"}
            </button>
          </div>

          {binLocked ? (
            <div className="text-xs text-gray-600 mt-1">
              Locked to bin: <span className="font-mono">{effectiveBin || "—"}</span>
              <span className="ml-2 text-gray-500">(persists until you unlock)</span>
            </div>
          ) : (
            <div className="text-xs text-gray-500 mt-1">
              Optional. If set, items found in a different bin will be flagged for review.
            </div>
          )}
        </div>

        <div className="flex-1 min-w-[260px]">
          <label className="block text-sm font-medium">Scan input</label>
          <input
            ref={inputRef}
            className="border rounded p-2 w-full"
            placeholder="Scan SN or Asset URL, then press Enter"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const t = scanInput;
                setScanInput("");
                processText(t);
              }
            }}
          />
        </div>

        <button
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          disabled={busy || !scanInput.trim()}
          onClick={() => {
            const t = scanInput;
            setScanInput("");
            processText(t);
          }}
          type="button"
        >
          {busy ? "Working..." : "Process"}
        </button>
      </div>

      <div className="text-sm text-gray-700">
        Results: ✅ {counts.found} | ↩️ {counts.already} | ❌ {counts.notFound}
      </div>

      <div className="border rounded overflow-auto max-h-[60vh]">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr className="text-left">
              <th className="p-2 w-40">Type</th>
              <th className="p-2">Token</th>
              <th className="p-2 w-36">Status</th>
              <th className="p-2">Message</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 ? (
              <tr>
                <td className="p-4 text-gray-600" colSpan={4}>
                  No scans yet. Click in the scan box and start scanning.
                </td>
              </tr>
            ) : (
              results.map((r, idx) => (
                <tr key={idx} className="border-t">
                  <td className="p-2">{r.type}</td>
                  <td className="p-2 font-mono">{r.token}</td>
                  <td className="p-2">
                    {r.status === "FOUND"
                      ? "✅ FOUND"
                      : r.status === "ALREADY_FOUND"
                      ? "↩️ Already"
                      : "❌ Not Found"}
                  </td>
                  <td className="p-2 text-gray-700">{r.message ?? ""}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-500">
        Tip: You can scan a string like:{" "}
        <span className="font-mono">
          8216200227E6CB. 8216200227E6C6, 8216200227E6C4
        </span>{" "}
        — it will process each SN.
      </div>
    </div>
  );
}
