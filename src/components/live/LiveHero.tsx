import Link from "next/link";

type LiveHeroProps = {
  liveCount: number;
  upcomingCount: number;
  activeCategories: number;
};

export function LiveHero({ liveCount, upcomingCount, activeCategories }: LiveHeroProps) {
  return (
    <section className="live-v3-header">
      <div className="live-v3-header-main">
        <p className="live-v3-eyebrow">Live</p>
        <h1>Discover live streams</h1>
        <p className="live-v3-hero-subcopy">Join live breaks, seller shows, and real-time auctions.</p>
      </div>

      <div className="live-v3-header-utils">
        <div className="live-v3-header-stats">
          <article>
            <p>Live now</p>
            <h3>{liveCount}</h3>
          </article>
          <article>
            <p>Upcoming</p>
            <h3>{upcomingCount}</h3>
          </article>
          <article>
            <p>Categories</p>
            <h3>{activeCategories}</h3>
          </article>
        </div>
        <div className="live-v3-header-actions">
          <Link href="#live-now" className="live-v3-btn is-primary">
            Browse live now
          </Link>
          <Link href="#upcoming" className="live-v3-btn is-secondary">
            View schedule
          </Link>
        </div>
      </div>
    </section>
  );
}
