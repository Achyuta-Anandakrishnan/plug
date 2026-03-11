import Link from "next/link";

export function FinalCTA() {
  return (
    <section className="home-v3-final-cta">
      <p>For collectors, by collectors</p>
      <h2>Ready to list, bid, and trade on a marketplace built for the hobby?</h2>
      <p>
        Discover live breaks, rare inventory, and active trade opportunities in one connected platform.
      </p>
      <div className="home-v3-final-actions">
        <Link href="/sell" className="home-v3-btn is-primary">
          Start selling
        </Link>
        <Link href="/listings" className="home-v3-btn is-secondary">
          Browse the market
        </Link>
        <Link href="/live" className="home-v3-btn is-tertiary">
          Watch live
        </Link>
      </div>
    </section>
  );
}
