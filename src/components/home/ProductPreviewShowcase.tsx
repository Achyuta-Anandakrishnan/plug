import Image from "next/image";
import Link from "next/link";
import type { HomeAuctionPreview, HomeLiveStreamPreview, HomeTradePreview } from "@/components/home/types";

type ProductPreviewShowcaseProps = {
  streams: HomeLiveStreamPreview[];
  auctions: HomeAuctionPreview[];
  trades: HomeTradePreview[];
};

export function ProductPreviewShowcase({ streams, auctions, trades }: ProductPreviewShowcaseProps) {
  return (
    <section className="home-v3-showcase">
      <div className="home-v3-section-heading">
        <p>Product preview</p>
        <h2>One connected marketplace experience</h2>
      </div>

      <div className="home-v3-showcase-shell">
        <div className="home-v3-showcase-toolbar">
          <div className="home-v3-showcase-search">Search cards, sets, players, certs</div>
          <div className="home-v3-showcase-filters">
            <span>All</span>
            <span>Pokemon</span>
            <span>Sports</span>
            <span>Funko</span>
          </div>
        </div>

        <div className="home-v3-rail-head">
          <h3>Live now</h3>
          <Link href="/live">See all</Link>
        </div>
        <div className="home-v3-live-rail">
          {streams.slice(0, 5).map((stream) => (
            <Link key={stream.id} href={stream.href} className="home-v3-live-tile">
              <div className="home-v3-live-media">
                <Image
                  src={stream.imageUrl}
                  alt="Live stream tile"
                  fill
                  sizes="(max-width: 1024px) 80vw, 280px"
                  className="object-cover"
                  unoptimized
                />
                <span>Live</span>
              </div>
              <div className="home-v3-live-body">
                <h4>{stream.title}</h4>
                <p>{stream.host}</p>
                <div>
                  <span>{stream.watchers} watching</span>
                  <span>{stream.priceLabel}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="home-v3-showcase-grid">
          <div className="home-v3-auction-panel">
            <div className="home-v3-panel-head">
              <h3>Featured auctions</h3>
              <Link href="/listings?mode=auctions">Browse</Link>
            </div>
            <div className="home-v3-auction-grid">
              {auctions.slice(0, 4).map((auction) => (
                <Link key={auction.id} href={auction.href} className="home-v3-auction-card">
                  <div className="home-v3-auction-media">
                    <Image
                      src={auction.imageUrl}
                      alt="Auction card"
                      fill
                      sizes="(max-width: 1024px) 45vw, 260px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="home-v3-auction-body">
                    <h4>{auction.title}</h4>
                    <p>{auction.seller}</p>
                    <div>
                      <span>{auction.currentBidLabel}</span>
                      <span>{auction.timeLeftLabel}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="home-v3-trade-panel">
            <div className="home-v3-panel-head">
              <h3>Trade board</h3>
              <Link href="/trades">Open board</Link>
            </div>
            <div className="home-v3-trade-list">
              {trades.slice(0, 5).map((trade) => (
                <Link key={trade.id} href={trade.href} className="home-v3-trade-row">
                  <div className="home-v3-trade-thumb">
                    <Image
                      src={trade.imageUrl}
                      alt="Trade item"
                      fill
                      sizes="80px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="home-v3-trade-copy">
                    <h4>{trade.title}</h4>
                    <p>{trade.owner}</p>
                    <span>{trade.lookingFor}</span>
                  </div>
                  <div className="home-v3-trade-meta">
                    <p>{trade.valueLabel}</p>
                    <span>{trade.offersCount} offers</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
