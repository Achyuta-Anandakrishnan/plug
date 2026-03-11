const REASONS = [
  {
    title: "Built around hobby workflows",
    description: "Live sessions, timed auctions, and trade negotiations are native flows, not stitched-on features.",
  },
  {
    title: "Live selling and discovery",
    description: "Collectors discover inventory in motion and sellers can close deals while momentum is high.",
  },
  {
    title: "Trade-first community features",
    description: "Structured offers and counter flows make collector-to-collector deals practical at scale.",
  },
  {
    title: "Auction-native behavior",
    description: "Clear bidding, watch activity, and ending-soon visibility match how serious buyers operate.",
  },
  {
    title: "Collector identity and trust",
    description: "Persistent seller identity and transparent activity make repeat transactions more reliable.",
  },
  {
    title: "Structured collectible listings",
    description: "Cleaner metadata and grading context reduce ambiguity and make browsing faster for buyers.",
  },
];

export function WhyDalow() {
  return (
    <section className="home-v3-why">
      <div className="home-v3-section-heading">
        <p>Why dalow</p>
        <h2>More than listings. A real collector platform.</h2>
      </div>
      <div className="home-v3-why-grid">
        {REASONS.map((reason) => (
          <article key={reason.title} className="home-v3-why-card">
            <h3>{reason.title}</h3>
            <p>{reason.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
