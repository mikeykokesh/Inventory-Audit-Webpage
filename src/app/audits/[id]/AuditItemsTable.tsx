"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type FoundStatus = "FOUND" | "MISSING" | null;

type Item = {
  id: string;

  item: string | null;
  description: string | null;
  prefVendor: string | null;

  onHand: number | null;
  physicalCount: number | null;
  countVariance: number | null;

  expectedBin: string | null;
  serialsRaw: string | null;
  assetId: string | null;
  notes: string | null;

  currentOnHandValue: number | null;
  currentValueVariance: number | null;

  found: boolean;
  foundStatus: FoundStatus;
  foundBin: string | null;

  reviewFlag: boolean;
  reviewReason: string | null;

  createdAt?: string;
  updatedAt?: string;
};

type ColKey =
  | "item"
  | "description"
  | "prefVendor"
  | "onHand"
  | "physicalCount"
  | "countVariance"
  | "expectedBin"
  | "serialsRaw"
  | "assetId"
  | "notes"
  | "currentOnHandValue"
  | "currentValueVariance"
  | "found"
  | "review";

const COL_LABEL: Record<ColKey, string> = {
  item: "Item",
  description: "Description",
  prefVendor: "Pref. Vendor",
  onHand: "On Hand",
  physicalCount: "Physical Count",
  countVariance: "Count Variance",
  expectedBin: "Bin Numbers",
  serialsRaw: "Serial/Lot Numbers",
  assetId: "Asset ID",
  notes: "Notes",
  currentOnHandValue: "Current On Hand Value",
  currentValueVariance: "Current Value Variance",
  found: "Found",
  review: "Review",
};

const DEFAULT_VISIBLE: Record<ColKey, boolean> = {
  item: true,
  description: true,
  prefVendor: true,
  onHand: true,
  physicalCount: true,
  countVariance: true,
  expectedBin: true,
  serialsRaw: true,
  assetId: true,
  notes: true,
  currentOnHandValue: true,
  currentValueVariance: true,
  found: true,
  review: true,
};

function asText(v: unknown) {
  return v === null || v === undefined ? "" : String(v);
}

function toNumOrNull(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function normalizeForCompare(row: Item) {
  return {
    item: row.item ?? null,
    description: row.description ?? null,
    prefVendor: row.prefVendor ?? null,

    onHand: row.onHand ?? null,
    physicalCount: row.physicalCount ?? null,
    countVariance: row.countVariance ?? null,

    expectedBin: row.expectedBin ?? null,
    serialsRaw: row.serialsRaw ?? null,
    assetId: row.assetId ?? null,
    notes: row.notes ?? null,

    currentOnHandValue: row.currentOnHandValue ?? null,
    currentValueVariance: row.currentValueVariance ?? null,

    foundStatus: row.foundStatus ?? null,
    reviewFlag: !!row.reviewFlag,
    reviewReason: row.reviewFlag ? row.reviewReason ?? "Needs review" : null,
  };
}

async function fetchLatestItems(auditId: string): Promise<Item[]> {
  const res = await fetch(`/api/audits/${auditId}/items`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to refresh items");
  const data = await res.json();
  return (data.items || []) as Item[];
}

export default function AuditItemsTable({
  items,
  auditId,
}: {
  items: Item[];
  auditId: string;
}) {
  const [rows, setRows] = useState<Item[]>(items);

  const [baseline, setBaseline] = useState<Record<string, ReturnType<typeof normalizeForCompare>>>(() => {
    const map: Record<string, ReturnType<typeof normalizeForCompare>> = {};
    for (const it of items) map[it.id] = normalizeForCompare(it);
    return map;
  });

  const [msg, setMsg] = useState("");
  const [savingAll, setSavingAll] = useState(false);

  const storageKey = `audit-columns:${auditId}`;
  const [visible, setVisible] = useState<Record<ColKey, boolean>>(DEFAULT_VISIBLE);
  const [showCols, setShowCols] = useState(false);

  const [filters, setFilters] = useState({
    item: "",
    description: "",
    prefVendor: "",
    expectedBin: "",
    serialsRaw: "",
    assetId: "",
    notes: "",

    found: "all" as "all" | "found" | "missing" | "blank",
    review: "all" as "all" | "review" | "blank",

    onHandMin: "",
    onHandMax: "",
    physicalMin: "",
    physicalMax: "",
    varianceMin: "",
    varianceMax: "",
  });

  // Sticky bottom scrollbar
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const bottomInnerRef = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef(false);

  // Load column prefs
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Record<ColKey, boolean>>;
      setVisible((v) => ({ ...v, ...parsed }));
    } catch {}
  }, [storageKey]);

  // Save column prefs
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(visible));
    } catch {}
  }, [visible, storageKey]);

  function updateRow(id: string, patch: Partial<Item>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const dirtyIds = useMemo(() => {
    const ids: string[] = [];
    for (const r of rows) {
      const base = baseline[r.id];
      if (!base) continue;
      const now = normalizeForCompare(r);
      if (JSON.stringify(now) !== JSON.stringify(base)) ids.push(r.id);
    }
    return ids;
  }, [rows, baseline]);

  const contains = (v: unknown, q: string) =>
    String(v ?? "").toLowerCase().includes(q.toLowerCase());

  const inRange = (value: number | null, minStr: string, maxStr: string) => {
    if (value === null || value === undefined) return false;
    const min = toNumOrNull(minStr);
    const max = toNumOrNull(maxStr);
    if (min !== null && value < min) return false;
    if (max !== null && value > max) return false;
    return true;
  };

  const visibleRows = useMemo(() => {
    return rows.filter((r) => {
      if (visible.item && filters.item && !contains(r.item, filters.item)) return false;
      if (visible.description && filters.description && !contains(r.description, filters.description))
        return false;
      if (visible.prefVendor && filters.prefVendor && !contains(r.prefVendor, filters.prefVendor))
        return false;
      if (visible.expectedBin && filters.expectedBin && !contains(r.expectedBin, filters.expectedBin))
        return false;
      if (visible.serialsRaw && filters.serialsRaw && !contains(r.serialsRaw, filters.serialsRaw))
        return false;
      if (visible.assetId && filters.assetId && !contains(r.assetId, filters.assetId)) return false;
      if (visible.notes && filters.notes && !contains(r.notes, filters.notes)) return false;

      if (visible.onHand && (filters.onHandMin.trim() || filters.onHandMax.trim())) {
        if (!inRange(r.onHand, filters.onHandMin, filters.onHandMax)) return false;
      }
      if (visible.physicalCount && (filters.physicalMin.trim() || filters.physicalMax.trim())) {
        if (!inRange(r.physicalCount, filters.physicalMin, filters.physicalMax)) return false;
      }
      if (visible.countVariance && (filters.varianceMin.trim() || filters.varianceMax.trim())) {
        if (!inRange(r.countVariance, filters.varianceMin, filters.varianceMax)) return false;
      }

      const fs = r.foundStatus ?? null;
      if (filters.found === "found" && fs !== "FOUND") return false;
      if (filters.found === "missing" && fs !== "MISSING") return false;
      if (filters.found === "blank" && fs !== null) return false;

      if (filters.review === "review" && !r.reviewFlag) return false;
      if (filters.review === "blank" && r.reviewFlag) return false;

      return true;
    });
  }, [rows, filters, visible]);

  async function saveAll() {
    if (dirtyIds.length === 0) {
      setMsg("No changes to save.");
      return;
    }

    setSavingAll(true);
    setMsg("");

    try {
      for (const id of dirtyIds) {
        const row = rows.find((r) => r.id === id);
        if (!row) continue;

        const res = await fetch(`/api/audit-items/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            item: row.item,
            description: row.description,
            prefVendor: row.prefVendor,

            onHand: row.onHand,
            physicalCount: row.physicalCount,

            expectedBin: row.expectedBin,
            serialsRaw: row.serialsRaw,
            assetId: row.assetId,
            notes: row.notes,

            currentOnHandValue: row.currentOnHandValue,
            currentValueVariance: row.currentValueVariance,

            foundStatus: row.foundStatus,
            reviewFlag: row.reviewFlag,
            reviewReason: row.reviewReason,
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Save failed for ${id}: ${text}`);
        }
      }

      setBaseline(() => {
        const map: Record<string, ReturnType<typeof normalizeForCompare>> = {};
        for (const r of rows) map[r.id] = normalizeForCompare(r);
        return map;
      });

      setMsg(`Saved ${dirtyIds.length} row(s).`);
    } catch (e: any) {
      setMsg(e?.message || "Save failed.");
    } finally {
      setSavingAll(false);
    }
  }

  // Ctrl+S / Cmd+S to Save All
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isSave = (e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S");
      if (!isSave) return;
      e.preventDefault();
      if (!savingAll) saveAll();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savingAll, dirtyIds, rows, baseline]);

  // Live refresh when scan happens (BroadcastChannel + storage fallback)
  useEffect(() => {
    let bc: BroadcastChannel | null = null;

    async function refreshFromServer() {
      try {
        const latest = await fetchLatestItems(auditId);
        setRows(latest);

        setBaseline(() => {
          const map: Record<string, ReturnType<typeof normalizeForCompare>> = {};
          for (const r of latest) map[r.id] = normalizeForCompare(r);
          return map;
        });
      } catch {
        // ignore
      }
    }

    try {
      bc = new BroadcastChannel("audit-scan");
      bc.onmessage = (ev) => {
        if (ev?.data?.auditId === auditId) refreshFromServer();
      };
    } catch {
      bc = null;
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === `audit-scan:${auditId}`) refreshFromServer();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      if (bc) bc.close();
      window.removeEventListener("storage", onStorage);
    };
  }, [auditId]);

  // Bottom horizontal scrollbar sync
  useEffect(() => {
    const wrap = wrapRef.current;
    const bottom = bottomRef.current;
    const inner = bottomInnerRef.current;
    if (!wrap || !bottom || !inner) return;

    const syncSizes = () => {
      inner.style.width = `${wrap.scrollWidth}px`;
    };
    syncSizes();

    const ro = new ResizeObserver(syncSizes);
    ro.observe(wrap);
    window.addEventListener("resize", syncSizes);

    const onWrapScroll = () => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      bottom.scrollLeft = wrap.scrollLeft;
      syncingRef.current = false;
    };

    const onBottomScroll = () => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      wrap.scrollLeft = bottom.scrollLeft;
      syncingRef.current = false;
    };

    wrap.addEventListener("scroll", onWrapScroll);
    bottom.addEventListener("scroll", onBottomScroll);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", syncSizes);
      wrap.removeEventListener("scroll", onWrapScroll);
      bottom.removeEventListener("scroll", onBottomScroll);
    };
  }, [visibleRows.length, visible]);

  function toggleFound(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const cur = row.foundStatus ?? null;
    const next: FoundStatus = cur === null ? "FOUND" : cur === "FOUND" ? "MISSING" : null;
    updateRow(id, { foundStatus: next, found: next === "FOUND" });
  }

  function toggleReview(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const next = !row.reviewFlag;
    updateRow(id, {
      reviewFlag: next,
      reviewReason: next ? (row.reviewReason ?? "Needs review") : null,
    });
  }

  function toggleAll(on: boolean) {
    setVisible((v) => {
      const next: Record<ColKey, boolean> = { ...v };
      (Object.keys(COL_LABEL) as ColKey[]).forEach((k) => (next[k] = on));
      return next;
    });
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-sm">
          {msg ? msg : dirtyIds.length > 0 ? `Unsaved changes: ${dirtyIds.length}` : ""}
          {dirtyIds.length > 0 ? <span className="ml-2 text-xs text-gray-500">(Ctrl+S)</span> : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 rounded bg-black text-white disabled:opacity-50"
            disabled={savingAll || dirtyIds.length === 0}
            onClick={saveAll}
            type="button"
          >
            {savingAll ? "Saving..." : `Save All${dirtyIds.length ? ` (${dirtyIds.length})` : ""}`}
          </button>

          <div className="relative">
            <button
              className="px-3 py-1 rounded border bg-white"
              onClick={() => setShowCols((s) => !s)}
              type="button"
            >
              Columns
            </button>

            {showCols ? (
              <div className="absolute right-0 mt-2 w-[320px] max-h-[60vh] overflow-auto border rounded bg-white shadow p-3 z-50">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Show / Hide Columns</div>
                  <button className="text-sm text-blue-600" onClick={() => setShowCols(false)}>
                    Close
                  </button>
                </div>

                <div className="flex gap-2 mt-2">
                  <button className="text-xs px-2 py-1 rounded border" onClick={() => toggleAll(true)}>
                    Show all
                  </button>
                  <button className="text-xs px-2 py-1 rounded border" onClick={() => toggleAll(false)}>
                    Hide all
                  </button>
                  <button
                    className="text-xs px-2 py-1 rounded border"
                    onClick={() => setVisible(DEFAULT_VISIBLE)}
                  >
                    Reset
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2">
                  {(Object.keys(COL_LABEL) as ColKey[]).map((k) => (
                    <label key={k} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={visible[k]}
                        onChange={(e) => setVisible((v) => ({ ...v, [k]: e.target.checked }))}
                      />
                      <span>{COL_LABEL[k]}</span>
                    </label>
                  ))}
                </div>

                <div className="mt-3 text-xs text-gray-500">Saved per audit on this device.</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div ref={wrapRef} className="border rounded overflow-auto h-[calc(100vh-170px)]">
        <table className="w-full min-w-[1600px] text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr className="text-left">
              {visible.item && <th className="p-2">{COL_LABEL.item}</th>}
              {visible.description && <th className="p-2">{COL_LABEL.description}</th>}
              {visible.prefVendor && <th className="p-2">{COL_LABEL.prefVendor}</th>}
              {visible.onHand && <th className="p-2">{COL_LABEL.onHand}</th>}
              {visible.physicalCount && <th className="p-2">{COL_LABEL.physicalCount}</th>}
              {visible.countVariance && <th className="p-2">{COL_LABEL.countVariance}</th>}
              {visible.expectedBin && <th className="p-2">{COL_LABEL.expectedBin}</th>}
              {visible.serialsRaw && <th className="p-2">{COL_LABEL.serialsRaw}</th>}
              {visible.assetId && <th className="p-2">{COL_LABEL.assetId}</th>}
              {visible.notes && <th className="p-2">{COL_LABEL.notes}</th>}
              {visible.currentOnHandValue && <th className="p-2">{COL_LABEL.currentOnHandValue}</th>}
              {visible.currentValueVariance && <th className="p-2">{COL_LABEL.currentValueVariance}</th>}
              {visible.found && <th className="p-2">{COL_LABEL.found}</th>}
              {visible.review && <th className="p-2">{COL_LABEL.review}</th>}
            </tr>

            <tr className="border-t">
              {visible.item && (
                <th className="p-1">
                  <input className="border rounded p-1 w-56" placeholder="Filter..." value={filters.item}
                    onChange={(e) => setFilters((f) => ({ ...f, item: e.target.value }))} />
                </th>
              )}
              {visible.description && (
                <th className="p-1">
                  <input className="border rounded p-1 w-72" placeholder="Filter..." value={filters.description}
                    onChange={(e) => setFilters((f) => ({ ...f, description: e.target.value }))} />
                </th>
              )}
              {visible.prefVendor && (
                <th className="p-1">
                  <input className="border rounded p-1 w-56" placeholder="Filter..." value={filters.prefVendor}
                    onChange={(e) => setFilters((f) => ({ ...f, prefVendor: e.target.value }))} />
                </th>
              )}

              {visible.onHand && (
                <th className="p-1">
                  <div className="flex gap-1">
                    <input className="border rounded p-1 w-16" placeholder="min" value={filters.onHandMin}
                      onChange={(e) => setFilters((f) => ({ ...f, onHandMin: e.target.value }))} />
                    <input className="border rounded p-1 w-16" placeholder="max" value={filters.onHandMax}
                      onChange={(e) => setFilters((f) => ({ ...f, onHandMax: e.target.value }))} />
                  </div>
                </th>
              )}

              {visible.physicalCount && (
                <th className="p-1">
                  <div className="flex gap-1">
                    <input className="border rounded p-1 w-16" placeholder="min" value={filters.physicalMin}
                      onChange={(e) => setFilters((f) => ({ ...f, physicalMin: e.target.value }))} />
                    <input className="border rounded p-1 w-16" placeholder="max" value={filters.physicalMax}
                      onChange={(e) => setFilters((f) => ({ ...f, physicalMax: e.target.value }))} />
                  </div>
                </th>
              )}

              {visible.countVariance && (
                <th className="p-1">
                  <div className="flex gap-1">
                    <input className="border rounded p-1 w-16" placeholder="min" value={filters.varianceMin}
                      onChange={(e) => setFilters((f) => ({ ...f, varianceMin: e.target.value }))} />
                    <input className="border rounded p-1 w-16" placeholder="max" value={filters.varianceMax}
                      onChange={(e) => setFilters((f) => ({ ...f, varianceMax: e.target.value }))} />
                  </div>
                </th>
              )}

              {visible.expectedBin && (
                <th className="p-1">
                  <input className="border rounded p-1 w-36" placeholder="Filter..." value={filters.expectedBin}
                    onChange={(e) => setFilters((f) => ({ ...f, expectedBin: e.target.value }))} />
                </th>
              )}
              {visible.serialsRaw && (
                <th className="p-1">
                  <input className="border rounded p-1 w-64" placeholder="Filter..." value={filters.serialsRaw}
                    onChange={(e) => setFilters((f) => ({ ...f, serialsRaw: e.target.value }))} />
                </th>
              )}
              {visible.assetId && (
                <th className="p-1">
                  <input className="border rounded p-1 w-28" placeholder="Filter..." value={filters.assetId}
                    onChange={(e) => setFilters((f) => ({ ...f, assetId: e.target.value }))} />
                </th>
              )}
              {visible.notes && (
                <th className="p-1">
                  <input className="border rounded p-1 w-64" placeholder="Filter..." value={filters.notes}
                    onChange={(e) => setFilters((f) => ({ ...f, notes: e.target.value }))} />
                </th>
              )}

              {visible.currentOnHandValue && <th />}
              {visible.currentValueVariance && <th />}

              {visible.found && (
                <th className="p-1">
                  <select className="border rounded p-1" value={filters.found}
                    onChange={(e) => setFilters((f) => ({ ...f, found: e.target.value as any }))}>
                    <option value="all">All</option>
                    <option value="found">Found</option>
                    <option value="missing">Missing</option>
                    <option value="blank">Blank</option>
                  </select>
                </th>
              )}

              {visible.review && (
                <th className="p-1">
                  <select className="border rounded p-1" value={filters.review}
                    onChange={(e) => setFilters((f) => ({ ...f, review: e.target.value as any }))}>
                    <option value="all">All</option>
                    <option value="review">Needs review</option>
                    <option value="blank">Blank</option>
                  </select>
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td className="p-4 text-gray-600" colSpan={50}>
                  No matching items.
                </td>
              </tr>
            ) : (
              visibleRows.map((r) => {
                const isDirty = dirtyIds.includes(r.id);
                const dirtyClass = isDirty ? "border-orange-400" : "";

                const fs = r.foundStatus ?? null;
                const foundLabel = fs === "FOUND" ? "Found" : fs === "MISSING" ? "Missing" : "";

                return (
                  <tr key={r.id} className="border-t align-top">
                    {visible.item && (
                      <td className="p-1">
                        <input className={`border rounded p-1 w-56 ${dirtyClass}`} value={asText(r.item)}
                          onChange={(e) => updateRow(r.id, { item: e.target.value })} />
                      </td>
                    )}

                    {visible.description && (
                      <td className="p-1">
                        <input className={`border rounded p-1 w-72 ${dirtyClass}`} value={asText(r.description)}
                          onChange={(e) => updateRow(r.id, { description: e.target.value })} />
                      </td>
                    )}

                    {visible.prefVendor && (
                      <td className="p-1">
                        <input className={`border rounded p-1 w-56 ${dirtyClass}`} value={asText(r.prefVendor)}
                          onChange={(e) => updateRow(r.id, { prefVendor: e.target.value })} />
                      </td>
                    )}

                    {visible.onHand && (
                      <td className="p-1">
                        <input className={`border rounded p-1 w-24 ${dirtyClass}`} value={asText(r.onHand)}
                          onChange={(e) => {
                            const onHand = e.target.value === "" ? null : Number(e.target.value);
                            const physical = r.physicalCount;
                            const variance = onHand === null || physical === null ? null : onHand - physical;
                            updateRow(r.id, { onHand, countVariance: variance });
                          }} />
                      </td>
                    )}

                    {visible.physicalCount && (
                      <td className="p-1">
                        <input className={`border rounded p-1 w-24 ${dirtyClass}`} value={asText(r.physicalCount)}
                          onChange={(e) => {
                            const physicalCount = e.target.value === "" ? null : Number(e.target.value);
                            const onHand = r.onHand;
                            const variance = onHand === null || physicalCount === null ? null : onHand - physicalCount;
                            updateRow(r.id, { physicalCount, countVariance: variance });
                          }} />
                      </td>
                    )}

                    {visible.countVariance && (
                      <td className="p-1">
                        <input className="border rounded p-1 w-24 bg-gray-100" value={asText(r.countVariance)} readOnly />
                      </td>
                    )}

                    {visible.expectedBin && (
                      <td className="p-1">
                        <input className={`border rounded p-1 w-36 ${dirtyClass}`} value={asText(r.expectedBin)}
                          onChange={(e) => updateRow(r.id, { expectedBin: e.target.value })} />
                      </td>
                    )}

                    {visible.serialsRaw && (
                      <td className="p-1">
                        <input className={`border rounded p-1 w-64 ${dirtyClass}`} value={asText(r.serialsRaw)}
                          onChange={(e) => updateRow(r.id, { serialsRaw: e.target.value })} />
                      </td>
                    )}

                    {visible.assetId && (
                      <td className="p-1">
                        <input className={`border rounded p-1 w-28 ${dirtyClass}`} value={asText(r.assetId)}
                          onChange={(e) => updateRow(r.id, { assetId: e.target.value })} />
                      </td>
                    )}

                    {visible.notes && (
                      <td className="p-1">
                        <input className={`border rounded p-1 w-64 ${dirtyClass}`} value={asText(r.notes)}
                          onChange={(e) => updateRow(r.id, { notes: e.target.value })} />
                      </td>
                    )}

                    {visible.currentOnHandValue && (
                      <td className="p-1">
                        <input className={`border rounded p-1 w-28 ${dirtyClass}`} value={asText(r.currentOnHandValue)}
                          onChange={(e) =>
                            updateRow(r.id, { currentOnHandValue: e.target.value === "" ? null : Number(e.target.value) })
                          } />
                      </td>
                    )}

                    {visible.currentValueVariance && (
                      <td className="p-1">
                        <input className={`border rounded p-1 w-28 ${dirtyClass}`} value={asText(r.currentValueVariance)}
                          onChange={(e) =>
                            updateRow(r.id, { currentValueVariance: e.target.value === "" ? null : Number(e.target.value) })
                          } />
                      </td>
                    )}

                    {visible.found && (
                      <td className="p-1">
                        <button
                          type="button"
                          className="px-2 py-1 rounded border bg-white"
                          onClick={() => toggleFound(r.id)}
                          title="Click to cycle: Blank → Found → Missing → Blank"
                        >
                          {foundLabel || "—"}
                        </button>
                        {r.foundBin ? <div className="text-xs text-gray-500 mt-1">bin: {r.foundBin}</div> : null}
                      </td>
                    )}

                    {visible.review && (
                      <td className="p-1">
                        <button
                          type="button"
                          className="px-2 py-1 rounded border bg-white"
                          onClick={() => toggleReview(r.id)}
                          title="Click to toggle Needs Review"
                        >
                          {r.reviewFlag ? "Needs review" : "—"}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div ref={bottomRef} className="mt-2 overflow-x-auto border rounded h-[16px]">
        <div ref={bottomInnerRef} className="h-[1px]" />
      </div>
    </div>
  );
}
