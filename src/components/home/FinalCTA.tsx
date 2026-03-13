import Link from "next/link";

export function FinalCTA() {
  return (
    <section className="home-v3-final-cta">
      <p>For collectors, by collectors</p>
      <h2>Ready to sell, bid, and trade?</h2>
      <p>
        One platform for live shows, auctions, and direct trades.
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
