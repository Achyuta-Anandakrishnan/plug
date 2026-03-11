const TRUST_POINTS = [
  {
    title: "Structured listings and grading context",
    detail: "Collectors need clarity before they bid, trade, or buy. dalow keeps listing data cleaner and easier to evaluate.",
  },
  {
    title: "Trust through identity and activity",
    detail: "Seller identity, stream behavior, and transaction history create stronger confidence than anonymous marketplaces.",
  },
  {
    title: "Built by hobby operators",
    detail: "The platform is designed around real collector behavior, not a generic cart-and-checkout template.",
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
