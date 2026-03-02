export default function StreamRosterPage() {
  return (
    <div className="ios-screen">
      <section className="ios-hero space-y-3">
        <p className="ios-kicker">
          Roster
        </p>
        <h1 className="ios-title">
          Verified sellers
        </h1>
        <p className="ios-subtitle">
          A cleaner roster of approved sellers and repeat operators.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {["Cobalt Labs", "Lumen Cards", "Meridian Watches", "Studio 7"].map(
          (seller) => (
            <div
              key={seller}
              className="ios-panel p-4 text-sm text-slate-600"
            >
              <p className="font-display text-2xl text-slate-900">{seller}</p>
              <p className="text-xs text-slate-500">Verified inventory / escrow</p>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
