const TRUST_POINTS = [
  {
    title: "Structured listings",
    detail: "Clear cert and grading context keeps decisions fast.",
  },
  {
    title: "Verified identity",
    detail: "Persistent seller and collector profiles reduce deal risk.",
  },
  {
    title: "Collector-native flows",
    detail: "Live, auctions, and trades are first-class workflows.",
  },
];

export function TrustSection() {
  return (
    <section className="home-v3-trust">
      <div className="home-v3-section-heading">
        <p>Collector-first trust</p>
        <h2>Built for the way collectors actually buy, sell, and trade.</h2>
      </div>
      <div className="home-v3-trust-grid">
        {TRUST_POINTS.map((point) => (
          <article key={point.title} className="home-v3-trust-card">
            <h3>{point.title}</h3>
            <p>{point.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
