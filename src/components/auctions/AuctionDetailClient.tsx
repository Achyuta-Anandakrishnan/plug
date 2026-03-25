"use client";

import Image from "next/image";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";

type AuctionImage = {
  url: string;
  isPrimary?: boolean;
};

type AuctionDetailLike = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  listingType: string;
  currentBid: number;
  buyNowPrice?: number | null;
  startingBid: number;
  currency: string;
  endTime?: string | Date | null;
  extendedTime?: string | Date | null;
  seller?: {
    user?: { displayName?: string | null; id?: string | null } | null;
  } | null;
  category?: { name: string } | null;
  item?: {
    images?: AuctionImage[] | null;
    title?: string;
    description?: string | null;
    attributes?: unknown;
  } | null;
  streamSessions?: Array<{ status: string }> | null;
};

type Props = {
  auction: AuctionDetailLike;
  initialIsMobile?: boolean;
};

function statusLabel(status: string) {
  switch (status.toUpperCase()) {
    case "LIVE":
      return "Live";
    case "DRAFT":
      return "Draft";
    case "SCHEDULED":
      return "Scheduled";
    case "ENDED":
      return "Ended";
    case "CANCELED":
      return "Cancelled";
    default:
      return status;
  }
}

function statusClass(status: string) {
  switch (status.toUpperCase()) {
    case "LIVE":
      return "auction-detail-status is-live";
    case "DRAFT":
      return "auction-detail-status is-draft";
    case "SCHEDULED":
      return "auction-detail-status is-scheduled";
    case "ENDED":
    case "CANCELED":
      return "auction-detail-status is-ended";
    default:
      return "auction-detail-status";
  }
}

export function AuctionDetailClient({ auction }: Props) {
  const images = auction.item?.images ?? [];
  const primaryImage = images.find((img) => img.isPrimary) ?? images[0] ?? null;

  const currency = auction.currency?.toUpperCase() ?? "USD";
  const currentBid = auction.currentBid ?? 0;
  const startingBid = auction.startingBid ?? 0;
  const displayBid = currentBid > startingBid ? currentBid : startingBid;
  const hasBuyNow = typeof auction.buyNowPrice === "number" && auction.buyNowPrice > 0;
  const isAuction =
    auction.listingType === "AUCTION" || auction.listingType === "BOTH";

  const sellerName =
    auction.seller?.user?.displayName ?? "Seller";

  const description = auction.description ?? auction.item?.description ?? null;

  const endDate = auction.extendedTime ?? auction.endTime;

  return (
    <div className="auction-detail-page">
      <div className="auction-detail-layout">
        {/* Media */}
        <div className="auction-detail-media">
          {primaryImage ? (
            <div className="auction-detail-img-wrap">
              <Image
                src={primaryImage.url}
                alt={auction.title}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="auction-detail-img"
                style={{ objectFit: "contain" }}
              />
            </div>
          ) : (
            <div className="auction-detail-img-placeholder">
              <span>No image</span>
            </div>
          )}

          {/* Additional images */}
          {images.length > 1 && (
            <div className="auction-detail-thumbnails">
              {images.slice(0, 6).map((img, idx) => (
                <div key={idx} className="auction-detail-thumb-wrap">
                  <Image
                    src={img.url}
                    alt={`${auction.title} image ${idx + 1}`}
                    fill
                    sizes="80px"
                    className="auction-detail-thumb"
                    style={{ objectFit: "cover" }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info panel */}
        <div className="auction-detail-info">
          <span className={statusClass(auction.status)}>
            {statusLabel(auction.status)}
          </span>

          {auction.category ? (
            <p className="auction-detail-category">{auction.category.name}</p>
          ) : null}

          <h1 className="auction-detail-title">{auction.title}</h1>

          <p className="auction-detail-seller">
            Listed by <strong>{sellerName}</strong>
          </p>

          {/* Pricing */}
          <div className="auction-detail-price">
            {isAuction ? (
              <div className="auction-detail-price-row">
                <span className="auction-detail-price-label">Current bid</span>
                <span className="auction-detail-price-value">
                  {formatCurrency(displayBid, currency)}
                </span>
              </div>
            ) : null}

            {hasBuyNow ? (
              <div className="auction-detail-price-row">
                <span className="auction-detail-price-label">Buy now</span>
                <span className="auction-detail-price-value">
                  {formatCurrency(auction.buyNowPrice!, currency)}
                </span>
              </div>
            ) : null}
          </div>

          {endDate ? (
            <p className="auction-detail-endtime">
              Ends {new Date(endDate).toLocaleString()}
            </p>
          ) : null}

          {/* CTAs */}
          <div className="auction-detail-cta">
            {isAuction && auction.status === "LIVE" ? (
              <Link
                href={`/streams/${auction.id}`}
                className="app-button app-button-primary"
              >
                Join auction room
              </Link>
            ) : null}

            {hasBuyNow && auction.status === "LIVE" ? (
              <Link
                href={`/streams/${auction.id}`}
                className="app-button app-button-secondary"
              >
                Buy now — {formatCurrency(auction.buyNowPrice!, currency)}
              </Link>
            ) : null}

            {auction.status !== "LIVE" ? (
              <Link
                href={`/streams/${auction.id}`}
                className="app-button app-button-secondary"
              >
                View listing room
              </Link>
            ) : null}
          </div>

          {/* Description */}
          {description ? (
            <div className="auction-detail-description">
              <h2 className="auction-detail-description-heading">Description</h2>
              <p>{description}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
