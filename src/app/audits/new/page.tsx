export default function NewAuditPage() {
  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold">Create New Audit</h1>

      <form className="mt-6 space-y-4" action="/api/audits" method="post">
        <div>
          <label className="block text-sm font-medium">Audit name</label>
          <input
            name="name"
            required
            className="mt-1 w-full border rounded p-2"
            placeholder="e.g. Warehouse A - January"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Notes</label>
          <textarea
            name="notes"
            className="mt-1 w-full border rounded p-2"
            rows={4}
            placeholder="Optional notes..."
          />
        </div>

        <button className="px-4 py-2 rounded bg-black text-white">
          Create Audit
        </button>
      </form>
    </main>
  );
}
