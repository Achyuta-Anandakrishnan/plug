type Pillar = {
  id: "live" | "auctions" | "trades";
  title: string;
  description: string;
};

const PILLARS: Pillar[] = [
  {
    id: "live",
    title: "Live",
    description: "Run real-time shows and move inventory fast.",
  },
  {
    id: "auctions",
    title: "Auctions",
    description: "Timed bidding that drives real price discovery.",
  },
  {
    id: "trades",
    title: "Trades",
    description: "Collector-to-collector negotiation.",
  },
];

function PillarIcon({ id }: { id: Pillar["id"] }) {
  if (id === "live") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8.3 3.8a1 1 0 1 1-1.4-1.4 13.5 13.5 0 0 1 0-12.8 1 1 0 0 1 1.8.9 11.5 11.5 0 0 0 0 11Zm16.6 0a11.5 11.5 0 0 0 0-11 1 1 0 1 1 1.8-1 13.5 13.5 0 0 1 0 13 1 1 0 0 1-1.8-1Z" fill="currentColor" />
      </svg>
    );
  }
  if (id === "auctions") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20h16v2H4v-2Zm8-18 7 7-4 4-7-7 4-4Zm-2.6 6L5 12.4V16h3.6L13 11.6 9.4 8Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.5 6A3.5 3.5 0 1 0 11 9.5 3.5 3.5 0 0 0 7.5 6Zm9 8A3.5 3.5 0 1 0 20 17.5 3.5 3.5 0 0 0 16.5 14ZM3 18l5.1-5.1 1.4 1.4L4.4 19.4 3 18Zm9.6-9.6 5.1-5.1 1.4 1.4-5.1 5.1-1.4-1.4Z" fill="currentColor" />
    </svg>
  );
}

export function ValuePillars() {
  return (
    <section className="home-v3-pillars">
      <div className="home-v3-section-heading">
        <p>Core actions</p>
        <h2>Three ways collectors move inventory</h2>
      </div>
      <div className="home-v3-pillar-grid">
        {PILLARS.map((pillar) => (
          <article key={pillar.id} className="home-v3-pillar-card">
            <div className="home-v3-pillar-icon">
              <PillarIcon id={pillar.id} />
            </div>
            <h3>{pillar.title}</h3>
            <p>{pillar.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
