import Image from "next/image";
import Link from "next/link";
import type { HomeAuctionPreview, HomeLiveStreamPreview, HomeTradePreview } from "@/components/home/types";

type LandingHeroProps = {
  stream: HomeLiveStreamPreview;
  auction: HomeAuctionPreview;
  trade: HomeTradePreview;
};

export function LandingHero({ stream, auction, trade }: LandingHeroProps) {
  return (
    <section className="home-v3-hero">
      <div className="home-v3-hero-copy">
        <p className="home-v3-eyebrow">For collectors, by collectors</p>
        <h1 className="home-v3-headline">Live. Auctions. Trades.</h1>
        <p className="home-v3-subheadline">A modern marketplace built around how the hobby actually works.</p>
        <p className="home-v3-body">
          Buy and sell through live shows, timed auctions, and direct collector trades - all in one platform.
        </p>
        <div className="home-v3-hero-actions">
          <Link href="/listings" className="home-v3-btn is-primary">
            Explore marketplace
          </Link>
          <Link href="/live" className="home-v3-btn is-secondary">
            Watch live
          </Link>
        </div>
      </div>

      <div className="home-v3-hero-visual" aria-label="dalow marketplace preview">
        <article className="home-v3-hero-card is-live">
          <div className="home-v3-hero-media">
            <Image
              src={stream.imageUrl}
              alt="Live stream preview"
              fill
              sizes="(max-width: 1024px) 100vw, 420px"
              className="object-cover"
              unoptimized
            />
            <span className="home-v3-badge is-live">Live</span>
          </div>
          <div className="home-v3-hero-card-body">
            <h3>{stream.title}</h3>
            <p>{stream.host}</p>
            <div>
              <span>{stream.category}</span>
              <span>{stream.watchers} watching</span>
              <span>{stream.priceLabel}</span>
            </div>
          </div>
        </article>

        <div className="home-v3-hero-stack">
          <article className="home-v3-hero-card is-auction">
            <div className="home-v3-hero-media">
              <Image
                src={auction.imageUrl}
                alt="Auction preview"
                fill
                sizes="(max-width: 1024px) 100vw, 320px"
                className="object-cover"
                unoptimized
              />
              <span className="home-v3-badge">Auction</span>
            </div>
            <div className="home-v3-hero-card-body">
              <h3>{auction.title}</h3>
              <p>{auction.seller}</p>
              <div>
                <span>{auction.currentBidLabel}</span>
                <span>{auction.timeLeftLabel}</span>
              </div>
            </div>
          </article>

          <article className="home-v3-hero-card is-trade">
            <div className="home-v3-hero-media">
              <Image
                src={trade.imageUrl}
                alt="Trade preview"
                fill
                sizes="(max-width: 1024px) 100vw, 320px"
                className="object-cover"
                unoptimized
              />
              <span className="home-v3-badge">Trade</span>
            </div>
            <div className="home-v3-hero-card-body">
              <h3>{trade.title}</h3>
              <p>{trade.owner}</p>
              <div>
                <span>{trade.valueLabel}</span>
                <span>{trade.offersCount} offers</span>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
