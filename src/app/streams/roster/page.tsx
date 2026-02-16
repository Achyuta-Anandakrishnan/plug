export default function StreamRosterPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
          Roster
        </p>
        <h1 className="font-display text-3xl text-slate-900">
          Verified sellers
        </h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {["Cobalt Labs", "Lumen Cards", "Meridian Watches", "Studio 7"].map(
          (seller) => (
            <div
              key={seller}
              className="surface-panel rounded-2xl p-4 text-sm text-slate-600"
            >
              <p className="font-display text-lg text-slate-900">{seller}</p>
              <p className="text-xs text-slate-500">Verified inventory / escrow</p>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
