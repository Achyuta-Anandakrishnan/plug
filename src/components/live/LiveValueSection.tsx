const LIVE_VALUE_POINTS = [
  {
    title: "Real-time bidding and discovery",
    detail: "Collectors see inventory move in the moment, not hours later.",
  },
  {
    title: "Faster collectible sales",
    detail: "Live energy compresses time-to-sale for high-demand items.",
  },
  {
    title: "Direct buyer-seller interaction",
    detail: "Hosts answer questions instantly and convert without friction.",
  },
  {
    title: "Community momentum",
    detail: "Chat, bids, and stream presence make the hobby feel alive.",
  },
  {
    title: "Collector-native format",
    detail: "Built around live breaks, auctions, and trusted stream hosts.",
  },
];

export function LiveValueSection() {
  return (
    <section className="live-v3-value">
      <div className="live-v3-section-head">
        <div>
          <p>Why live works on dalow</p>
          <h2>Built for high-energy hobby commerce.</h2>
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
