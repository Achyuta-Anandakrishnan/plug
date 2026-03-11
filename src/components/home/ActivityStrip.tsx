type ActivityStripProps = {
  liveNow: number;
  activeAuctions: number;
  collectorsOnline: number;
};

const STATS: Array<{ key: keyof ActivityStripProps; label: string }> = [
  { key: "liveNow", label: "Live now" },
  { key: "activeAuctions", label: "Active auctions" },
  { key: "collectorsOnline", label: "Collectors online" },
];

export function ActivityStrip({ liveNow, activeAuctions, collectorsOnline }: ActivityStripProps) {
  const values: ActivityStripProps = { liveNow, activeAuctions, collectorsOnline };

  return (
    <section className="home-v3-activity" aria-label="Marketplace activity">
      <div className="home-v3-section-heading">
        <p>Marketplace activity</p>
        <h2>Real-time collector momentum</h2>
      </div>
      <div className="home-v3-activity-grid">
        {STATS.map((entry) => (
          <article key={entry.key} className="home-v3-activity-card">
            <p>{entry.label}</p>
            <h3>{values[entry.key].toLocaleString()}</h3>
          </article>
        ))}
      </div>
    </section>
  );
}
