"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { CardSpecSheet } from "@/components/product/CardSpecSheet";
import { formatCurrency } from "@/lib/format";
import type { PsaCertificateSnapshot } from "@/lib/psa-cert";

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
  stripeEnabled?: boolean;
  certSnapshot?: PsaCertificateSnapshot | null;
};

function statusLabel(status: string) {
  switch (status.toUpperCase()) {
    case "LIVE": return "Live";
    case "DRAFT": return "Draft";
    case "SCHEDULED": return "Scheduled";
    case "ENDED": return "Ended";
    case "CANCELED": return "Cancelled";
    default: return status;
  }
}

function statusClass(status: string) {
  switch (status.toUpperCase()) {
    case "LIVE": return "auction-detail-status is-live";
    case "DRAFT": return "auction-detail-status is-draft";
    case "SCHEDULED": return "auction-detail-status is-scheduled";
    case "ENDED":
    case "CANCELED": return "auction-detail-status is-ended";
    default: return "auction-detail-status";
  }
}

function SlabImage({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="auction-slab-face">
      {!failed ? (
        <Image
          src={url}
          alt={alt}
          fill
          sizes="(max-width: 768px) 45vw, 280px"
          className="auction-slab-img"
          style={{ objectFit: "contain" }}
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="auction-slab-empty"><span>No image</span></div>
      )}
    </div>
  );
}

export function AuctionDetailClient({ auction, stripeEnabled = true, certSnapshot = null }: Props) {
  const { data: session } = useSession();
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState("");

  const images = auction.item?.images ?? [];
  const front = images.find((img) => img.isPrimary) ?? images[0] ?? null;
  const back = images.find((img) => !img.isPrimary && img !== front) ?? images[1] ?? null;

  const currency = auction.currency?.toUpperCase() ?? "USD";
  const currentBid = auction.currentBid ?? 0;
  const startingBid = auction.startingBid ?? 0;
  const displayBid = currentBid > startingBid ? currentBid : startingBid;
  const hasBuyNow = typeof auction.buyNowPrice === "number" && auction.buyNowPrice > 0;
  const isAuction = auction.listingType === "AUCTION" || auction.listingType === "BOTH";
  const isLive = auction.status === "LIVE";
  const sellerName = auction.seller?.user?.displayName ?? "Seller";
  const description = auction.description ?? auction.item?.description ?? null;
  const endDate = auction.extendedTime ?? auction.endTime;
  const specSections = certSnapshot?.found
    ? [
        {
          title: "Grading Info",
          rows: [
            { label: "Grading Company", value: [certSnapshot.grader, certSnapshot.grade].filter(Boolean).join(" ") || "PSA" },
            { label: "Cert No.", value: certSnapshot.certNumber },
            { label: "PSA Population", value: certSnapshot.population != null ? certSnapshot.population.toLocaleString("en-US") : null },
            { label: "Pop Higher", value: certSnapshot.popHigher != null ? certSnapshot.popHigher.toLocaleString("en-US") : null },
          ],
        },
        {
          title: "Details",
          rows: [
            { label: "Year", value: certSnapshot.year },
            { label: "Language", value: certSnapshot.language },
            { label: "Player", value: certSnapshot.player },
            { label: "Category", value: certSnapshot.category },
            { label: "Series", value: certSnapshot.setName ?? certSnapshot.brand },
            { label: "Rarity", value: certSnapshot.rarity },
            { label: "Card Number", value: certSnapshot.cardNumber ? `#${certSnapshot.cardNumber}` : null },
            { label: "Attributes", value: certSnapshot.attributes ?? certSnapshot.variety },
          ],
        },
        {
          title: "Item Description",
          rows: [
            { label: "Notes", value: certSnapshot.itemDescription },
          ],
        },
      ]
    : [];

  const handleBuyNow = async () => {
    setBuyError("");
    if (!session?.user?.id) {
      await signIn();
      return;
    }
    setBuying(true);
    try {
      const response = await fetch(`/api/auctions/${auction.id}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await response.json() as { error?: string; checkoutUrl?: string | null };
      if (!response.ok) {
        setBuyError(payload.error ?? "Unable to start checkout.");
        return;
      }
      if (payload.checkoutUrl && /^https?:\/\//i.test(payload.checkoutUrl)) {
        window.location.assign(payload.checkoutUrl);
        return;
      }
      setBuyError("Checkout unavailable right now.");
    } catch {
      setBuyError("Something went wrong. Try again.");
    } finally {
      setBuying(false);
    }
  };

  return (
    <div className="auction-detail-page">
      <div className="auction-detail-layout">
        {/* PSA slab front + back */}
        <div className="auction-slab-display">
          {front ? <SlabImage url={front.url} alt={`${auction.title} — front`} /> : null}
          {back ? <SlabImage url={back.url} alt={`${auction.title} — back`} /> : null}
          {!front && !back ? (
            <div className="auction-slab-face auction-slab-empty">
              <span>No image</span>
            </div>
          ) : null}
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

          <div className="auction-detail-cta">
            {isAuction && isLive ? (
              <Link href={`/streams/${auction.id}`} className="app-button app-button-primary">
                Join auction room
              </Link>
            ) : null}

            {hasBuyNow && isLive && stripeEnabled ? (
              <button
                type="button"
                className="app-button app-button-primary auction-buy-now-btn"
                onClick={() => void handleBuyNow()}
                disabled={buying}
              >
                {buying ? "Starting checkout…" : `Buy now — ${formatCurrency(auction.buyNowPrice!, currency)}`}
              </button>
            ) : null}

            {hasBuyNow && isLive && !stripeEnabled ? (
              <p className="auction-detail-note">Payments are unavailable right now.</p>
            ) : null}

            {buyError ? (
              <p className="auction-detail-note is-error">{buyError}</p>
            ) : null}

            {!isLive ? (
              <Link href={`/streams/${auction.id}`} className="app-button app-button-secondary">
                View listing room
              </Link>
            ) : null}
          </div>

          {description && isAuction ? (
            <div className="auction-detail-description">
              <h2 className="auction-detail-description-heading">Description</h2>
              <p>{description}</p>
            </div>
          ) : null}

          {specSections.length > 0 ? (
            <div className="auction-detail-spec-sheet">
              <CardSpecSheet sections={specSections} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
