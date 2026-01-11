"use client";

export default function DeleteAuditButton({
  auditId,
  auditName,
}: {
  auditId: string;
  auditName: string;
}) {
  async function handleDelete() {
    const ok = confirm(
      `Delete audit "${auditName}"?\n\nThis will permanently delete:\n• All items\n• All serials\n• All scan history`
    );
    if (!ok) return;

    await fetch(`/api/audits?id=${auditId}`, { method: "DELETE" });
    window.location.reload();
  }

  return (
    <button
      type="button"
      className="px-3 py-1 rounded border text-red-600 hover:bg-red-50"
      onClick={handleDelete}
    >
      Delete
    </button>
  );
}
