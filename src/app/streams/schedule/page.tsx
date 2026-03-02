export default function StreamSchedulePage() {
  return (
    <div className="ios-screen">
      <section className="ios-hero space-y-3">
        <p className="ios-kicker">
          Schedule
        </p>
        <h1 className="ios-title">
          Live schedule
        </h1>
        <p className="ios-subtitle">
          Keep upcoming rooms readable at a glance, without hunting through clutter.
        </p>
      </section>

      <div className="ios-panel p-4">
        <div className="grid gap-3">
          {["Today", "Tomorrow", "Friday"].map((day) => (
            <div
              key={day}
              className="ios-panel-muted rounded-[24px] px-4 py-4 text-sm text-slate-600"
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
