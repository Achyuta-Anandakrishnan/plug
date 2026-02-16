export default function StreamSchedulePage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
          Schedule
        </p>
        <h1 className="font-display text-3xl text-slate-900">
          Live schedule
        </h1>
      </div>

      <div className="surface-panel rounded-2xl p-4">
        <div className="grid gap-3">
          {["Today", "Tomorrow", "Friday"].map((day) => (
            <div
              key={day}
              className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm text-slate-600"
            >
              <div className="flex items-center justify-between">
                <p className="font-display text-base text-slate-900">{day}</p>
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  6 streams
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Prime Archive, Cobalt Labs, Meridian Watches
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
