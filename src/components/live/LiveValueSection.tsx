const LIVE_VALUE_POINTS = [
  {
    title: "Real-time bidding and discovery",
    detail: "Inventory moves in the moment, not hours later.",
  },
  {
    title: "Faster collectible sales",
    detail: "Live energy compresses time-to-sale for high-demand cards.",
  },
  {
    title: "Direct buyer-seller interaction",
    detail: "Hosts answer in real time and close with less friction.",
  },
];

export function LiveValueSection() {
  return (
    <section className="live-v3-value">
      <div className="live-v3-section-head">
        <div>
          <p>Why collect live on dalow</p>
          <h2>Purpose-built for hobby momentum</h2>
        </div>
      </div>
      <div className="live-v3-value-grid">
        {LIVE_VALUE_POINTS.map((point) => (
          <article key={point.title}>
            <h3>{point.title}</h3>
            <p>{point.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
