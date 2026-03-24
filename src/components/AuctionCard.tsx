import Image from "next/image";
import Link from "next/link";
import { formatCurrency, formatSeconds } from "@/lib/format";
import { resolveDisplayMediaUrl } from "@/lib/media-placeholders";

type AuctionCardProps = {
  id: string;
  title: string;
  sellerName: string;
  category?: string;
  currentBid: number;
  timeLeft: number;
  watchers: number;
  badge?: string;
  imageUrl?: string | null;
  currency?: string;
  listingType?: "AUCTION" | "BUY_NOW" | "BOTH";
  buyNowPrice?: number | null;
  gradeLabel?: string;
  preservePlaceholderMedia?: boolean;
};

export function AuctionCard({
  id,
  title,
  sellerName,
  category,
  currentBid,
  timeLeft,
  watchers,
  badge,
  imageUrl,
  currency = "USD",
  listingType = "AUCTION",
  buyNowPrice,
  gradeLabel,
  preservePlaceholderMedia = false,
}: AuctionCardProps) {
  const displayImageUrl = preservePlaceholderMedia
    ? (imageUrl ?? "/placeholders/pokemon-generic.svg")
    : resolveDisplayMediaUrl(imageUrl);

  return (
    <Link href={`/streams/${id}`} className="auction-card">
      <Image
        src={displayImageUrl}
        alt={title}
        fill
        sizes="(max-width: 768px) 50vw, 22vw"
        className="auction-card-img"
      />
      <div className="auction-card-gradient-top" aria-hidden="true" />
      <div className="auction-card-gradient" aria-hidden="true" />

      <div className="auction-card-badges">
        <div className="auction-card-badges-left">
          {badge ? (
            <span className="auction-card-badge is-primary">{badge}</span>
          ) : null}
          {category ? (
            <span className="auction-card-badge is-ghost">{category}</span>
          ) : null}
        </div>
        {listingType !== "AUCTION" && buyNowPrice ? (
          <span className="auction-card-badge is-primary">
            {formatCurrency(buyNowPrice, currency)}
          </span>
        ) : null}
      </div>

      <div className="auction-card-body">
        <div className="auction-card-copy">
          <h3 className="auction-card-title">{title}</h3>
          <p className="auction-card-seller">{sellerName}</p>
        </div>

        <div className="auction-card-stats">
          <div className="auction-card-stat">
            <p className="auction-card-stat-label">Bid</p>
            <p className="auction-card-stat-value">{formatCurrency(currentBid, currency)}</p>
          </div>
          <div className="auction-card-stat is-right">
            <p className="auction-card-stat-label">Time</p>
            <p className="auction-card-stat-value">{formatSeconds(timeLeft)}</p>
          </div>
        </div>

        <div className="auction-card-foot">
          <p className="auction-card-watchers">{watchers > 0 ? `${watchers} live` : ""}</p>
          <span className="sr-only">{gradeLabel ?? ""}</span>
        </div>
      </div>
    </Link>
  );
}
