import Link from "next/link";
import type { LiveStreamItem } from "@/components/live/types";
import { LiveStreamCard } from "@/components/live/LiveStreamCard";

type LiveHeroProps = {
  featured: LiveStreamItem | null;
  liveCount: number;
  upcomingCount: number;
  activeCategories: number;
};

export function LiveHero({ featured, liveCount, upcomingCount, activeCategories }: LiveHeroProps) {
  return (
    <section className="live-v3-hero">
      <div className="live-v3-hero-copy">
        <p className="live-v3-eyebrow">Live on dalow</p>
        <h1>Watch, bid, and buy in real time.</h1>
        <p className="live-v3-hero-subcopy">
          Join live breaks, seller streams, and high-energy collectible shows happening right now.
        </p>
        <div className="live-v3-hero-actions">
          <Link href="#live-now" className="live-v3-btn is-primary">
            Browse live now
          </Link>
          <Link href="#upcoming" className="live-v3-btn is-secondary">
            View schedule
          </Link>
        </div>
      </div>

      <div className="live-v3-hero-preview">
        <div className="live-v3-hero-stats">
          <article>
            <p>Live now</p>
            <h3>{liveCount}</h3>
          </article>
          <article>
            <p>Upcoming</p>
            <h3>{upcomingCount}</h3>
          </article>
          <article>
            <p>Active categories</p>
            <h3>{activeCategories}</h3>
          </article>
        </div>
        {featured ? (
          <LiveStreamCard stream={featured} layout="rail" />
        ) : (
          <div className="live-v3-empty">No featured stream right now.</div>
        )}
      </div>
    </section>
  );
}
