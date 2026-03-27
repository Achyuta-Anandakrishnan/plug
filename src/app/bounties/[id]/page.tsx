import type { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BountyCommentsClient } from "@/components/bounties/BountyCommentsClient";
import { ListingCard } from "@/components/market/ListingCard";
import { MessageUserButton } from "@/components/profiles/MessageUserButton";
import {
  EmptyStateCard,
  PageContainer,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
} from "@/components/product/ProductUI";
import { bountyAmountLabel, bountyBudgetLabel } from "@/lib/bounties";
import { ensureBountySchema, isBountySchemaMissing } from "@/lib/bounty-schema";
import type { AuctionListItem } from "@/hooks/useAuctions";
import { prisma } from "@/lib/prisma";
import type { TradePostListItem } from "@/lib/trade-client";

type MatchingAuctionCandidate = Prisma.AuctionGetPayload<{
  include: {
    category: { select: { name: true } };
    seller: {
      select: {
        user: {
          select: {
            id: true;
            displayName: true;
          };
        };
      };
    };
    streamSessions: {
      select: {
        id: true;
        status: true;
        createdAt: true;
        updatedAt: true;
      };
    };
    item: {
      select: {
        attributes: true;
        images: {
          select: {
            url: true;
            isPrimary: true;
          };
        };
      };
    };
  };
}>;

type BountyDetailRecord = Prisma.WantRequestGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        username: true;
        displayName: true;
        image: true;
      };
    };
    _count: {
      select: {
        saves: true;
      };
    };
  };
}>;

type BountyCommentRecord = Prisma.WantRequestCommentGetPayload<{
  include: {
    author: {
      select: {
        id: true;
        username: true;
        displayName: true;
        image: true;
      };
    };
  };
}>;

function detailValue(value: string | null | undefined, fallback = "—") {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || fallback;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeAttributes(value: Prisma.JsonValue | null | undefined): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function searchTermsForBounty(bounty: {
  title: string;
  itemName: string;
  player: string | null;
  setName: string | null;
  year: string | null;
  certNumber: string | null;
  category: string | null;
}) {
  return [bounty.itemName, bounty.title, bounty.player, bounty.setName, bounty.year, bounty.certNumber, bounty.category]
    .map((entry) => normalizeText(entry))
    .filter(Boolean)
    .filter((entry, index, entries) => entries.indexOf(entry) === index);
}

function asAuctionSearchBlob(listing: AuctionListItem) {
  const attributes = (listing.item?.attributes ?? {}) as Record<string, unknown>;
  return [
    listing.title,
    listing.item?.images?.[0]?.url,
    listing.category?.name,
    typeof attributes.player === "string" ? attributes.player : "",
    typeof attributes.subject === "string" ? attributes.subject : "",
    typeof attributes.set === "string" ? attributes.set : "",
    typeof attributes.brand === "string" ? attributes.brand : "",
    typeof attributes.year === "string" ? attributes.year : "",
    typeof attributes.certNumber === "string" ? attributes.certNumber : "",
    typeof attributes.grade === "string" ? attributes.grade : "",
    typeof attributes.gradingLabel === "string" ? attributes.gradingLabel : "",
  ]
    .map((entry) => normalizeText(entry))
    .filter(Boolean)
    .join(" ");
}

function serializeAuctionListItem(listing: MatchingAuctionCandidate): AuctionListItem {
  return {
    ...listing,
    createdAt: listing.createdAt.toISOString(),
    startTime: listing.startTime?.toISOString() ?? null,
    endTime: listing.endTime?.toISOString() ?? null,
    extendedTime: listing.extendedTime?.toISOString() ?? null,
    streamSessions: listing.streamSessions.map((session) => ({
      ...session,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    })),
    item: listing.item
      ? { ...listing.item, attributes: normalizeAttributes(listing.item.attributes) }
      : null,
  };
}

function asTradeSearchBlob(trade: TradePostListItem) {
  return [trade.title, trade.category, trade.cardSet, trade.cardNumber, trade.gradeCompany, trade.gradeLabel, trade.condition, trade.lookingFor]
    .map((entry) => normalizeText(entry))
    .filter(Boolean)
    .join(" ");
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bounty-status-open",
  MATCHED: "bounty-status-matched",
  FULFILLED: "bounty-status-fulfilled",
  EXPIRED: "bounty-status-expired",
  PAUSED: "bounty-status-paused",
};

export default async function BountyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensureBountySchema().catch(() => null);
  const { id } = await params;

  let bounty: BountyDetailRecord | null = null;
  let bountyLoadError: string | null = null;

  try {
    bounty = await prisma.wantRequest.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, displayName: true, image: true } },
        _count: { select: { saves: true } },
      },
    });
  } catch (error) {
    if (isBountySchemaMissing(error)) {
      await ensureBountySchema().catch(() => null);
      bountyLoadError = "Bounties are still initializing. Retry in a few seconds.";
    } else {
      console.error("Bounty detail load failed", { id, error });
      bountyLoadError = "Unable to load this bounty right now.";
    }
  }

  if (!bounty) {
    if (bountyLoadError) {
      return (
        <PageContainer className="app-page--bounty-detail">
          <section className="app-section">
            <EmptyStateCard
              title="This bounty could not be loaded."
              description={bountyLoadError}
              action={<PrimaryButton href="/bounties">Browse bounties</PrimaryButton>}
            />
          </section>
        </PageContainer>
      );
    }
    notFound();
  }

  const collectorName = bounty.user.displayName ?? bounty.user.username ?? "Collector";
  const collectorHandle = bounty.user.username ? `@${bounty.user.username}` : collectorName;
  const searchQuery = encodeURIComponent(bounty.itemName || bounty.title);
  const fulfillParams = new URLSearchParams({
    mode: "BUY_NOW",
    ...(bounty.certNumber ? { cert: bounty.certNumber } : {}),
    ...(bounty.gradeCompany ? { grader: bounty.gradeCompany } : {}),
    ...((bounty.priceMax ?? bounty.priceMin)
      ? { price: String(((bounty.priceMax ?? bounty.priceMin) ?? 0) / 100) }
      : {}),
  });
  const terms = searchTermsForBounty(bounty);

  const budgetDisplay = bountyBudgetLabel(bounty.priceMin, bounty.priceMax).replace(/^Budget\s*/i, "") || "Open";
  const feeDisplay = bountyAmountLabel(bounty.bountyAmount).replace(/^Bounty\s*/i, "");
  const hasFee = bounty.bountyAmount != null && bounty.bountyAmount > 0;

  const [candidateListingsResult, candidateTradesResult, commentsResult] = await Promise.allSettled([
    prisma.auction.findMany({
      where: { status: { in: ["SCHEDULED", "LIVE"] } },
      include: {
        category: { select: { name: true } },
        seller: { select: { user: { select: { id: true, displayName: true } } } },
        streamSessions: { select: { id: true, status: true, createdAt: true, updatedAt: true } },
        item: {
          select: {
            attributes: true,
            images: {
              orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
              select: { url: true, isPrimary: true },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 48,
    }),
    prisma.tradePost.findMany({
      where: { status: { in: ["OPEN", "MATCHED", "PAUSED"] } },
      include: {
        owner: { select: { id: true, username: true, displayName: true } },
        images: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          select: { id: true, url: true, isPrimary: true },
        },
        _count: { select: { offers: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 48,
    }),
    prisma.wantRequestComment.findMany({
      where: { wantRequestId: id },
      include: { author: { select: { id: true, username: true, displayName: true, image: true } } },
      orderBy: { createdAt: "asc" },
      take: 80,
    }),
  ]);

  const candidateListings = candidateListingsResult.status === "fulfilled" ? candidateListingsResult.value : [];
  const candidateTrades = candidateTradesResult.status === "fulfilled" ? candidateTradesResult.value : [];
  const comments = commentsResult.status === "fulfilled"
    ? commentsResult.value.map((c: BountyCommentRecord) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt.toISOString(),
        author: c.author,
      }))
    : [];

  const listingMatchesUnavailable = candidateListingsResult.status === "rejected";
  const tradeMatchesUnavailable = candidateTradesResult.status === "rejected";

  const matchingListings: AuctionListItem[] = candidateListings
    .filter((listing) => {
      const haystack = asAuctionSearchBlob(serializeAuctionListItem(listing));
      return terms.some((term) => haystack.includes(term));
    })
    .slice(0, 6)
    .map((listing) => serializeAuctionListItem(listing));

  const matchingTrades: TradePostListItem[] = candidateTrades
    .filter((trade) => {
      const haystack = asTradeSearchBlob({
        ...trade,
        createdAt: trade.createdAt.toISOString(),
        updatedAt: trade.updatedAt.toISOString(),
      });
      return terms.some((term) => haystack.includes(term));
    })
    .slice(0, 6)
    .map((trade) => ({
      ...trade,
      createdAt: trade.createdAt.toISOString(),
      updatedAt: trade.updatedAt.toISOString(),
    }));

  const specFields: Array<{ label: string; value: string | null }> = [
    { label: "Player / Subject", value: bounty.player },
    { label: "Set", value: bounty.setName },
    { label: "Year", value: bounty.year },
    { label: "Grade", value: [bounty.gradeCompany, bounty.gradeTarget || bounty.grade].filter(Boolean).join(" ") || null },
    { label: "Condition", value: bounty.condition },
    { label: "Cert #", value: bounty.certNumber },
    { label: "Category", value: bounty.category },
  ].filter((f) => f.value && f.value.trim());

  return (
    <PageContainer className="app-page--bounty-detail bounty-detail-v2-page">
      <section className="app-section bounty-detail-v2-section">

        {/* ── Back nav ── */}
        <nav className="bounty-detail-v2-nav">
          <Link href="/bounties" className="bounty-detail-v2-back">← Bounty board</Link>
          <span className={`bounty-row-status-badge bounty-status-${bounty.status.toLowerCase()}`}>
            {bounty.status}
          </span>
        </nav>

        {/* ── Main layout ── */}
        <div className="bounty-detail-v2-layout">

          {/* ── Left: item info ── */}
          <div className="bounty-detail-v2-main">

            {/* Title card */}
            <div className="bounty-detail-v2-card bounty-detail-v2-title-card">
              <p className="bounty-detail-v2-eyebrow">Looking for</p>
              <h1 className="bounty-detail-v2-title">{bounty.itemName || bounty.title}</h1>
              {bounty.title && bounty.itemName && bounty.title !== bounty.itemName && (
                <p className="bounty-detail-v2-subtitle">{bounty.title}</p>
              )}
              <div className="bounty-detail-v2-byline">
                <span>Posted by</span>
                <strong>{collectorHandle}</strong>
              </div>
            </div>

            {/* Specs grid */}
            {specFields.length > 0 && (
              <div className="bounty-detail-v2-card">
                <p className="bounty-detail-v2-card-label">Specifications</p>
                <dl className="bounty-detail-v2-specs">
                  {specFields.map((field) => (
                    <div key={field.label} className="bounty-detail-v2-spec-row">
                      <dt>{field.label}</dt>
                      <dd>{field.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Notes */}
            {bounty.notes?.trim() && (
              <div className="bounty-detail-v2-card">
                <p className="bounty-detail-v2-card-label">Notes from buyer</p>
                <p className="bounty-detail-v2-notes">{bounty.notes.trim()}</p>
              </div>
            )}

          </div>

          {/* ── Right: pricing + actions ── */}
          <aside className="bounty-detail-v2-aside">

            {/* Price card */}
            <div className="bounty-detail-v2-card bounty-detail-v2-price-card">
              <div className="bounty-detail-v2-price-block">
                <span className="bounty-detail-v2-price-label">Budget</span>
                <strong className="bounty-detail-v2-price-value">{budgetDisplay}</strong>
              </div>
              {hasFee && (
                <div className="bounty-detail-v2-price-block">
                  <span className="bounty-detail-v2-price-label">Finder&rsquo;s fee</span>
                  <strong className="bounty-detail-v2-price-value is-fee">{feeDisplay}</strong>
                </div>
              )}
              <div className="bounty-detail-v2-saves">
                <span>{bounty._count.saves} {bounty._count.saves === 1 ? "save" : "saves"}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="bounty-detail-v2-card bounty-detail-v2-actions-card">
              <PrimaryButton href={`/sell?${fulfillParams.toString()}`} className="bounty-detail-v2-cta">
                Fulfill bounty
              </PrimaryButton>
              <SecondaryButton href={`/listings?q=${searchQuery}`} className="bounty-detail-v2-secondary-action">
                Browse matching listings
              </SecondaryButton>
              <MessageUserButton
                targetUserId={bounty.user.id}
                className="app-button app-button-secondary bounty-detail-v2-secondary-action"
              />
            </div>

          </aside>
        </div>

        {/* ── Comments ── */}
        <BountyCommentsClient bountyId={bounty.id} initialComments={comments} />

        {/* ── Matching listings ── */}
        <section className="listing-system-feed bounty-detail-matches">
          <SectionHeader
            title="Matching listings"
            subtitle="Inventory already on the platform that may satisfy this bounty."
            action={<span className="market-count">{matchingListings.length}</span>}
          />
          {matchingListings.length > 0 ? (
            <div className={`market-v2-grid bounty-board-grid ${matchingListings.length < 3 ? "is-sparse" : ""}`}>
              {matchingListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : listingMatchesUnavailable ? (
            <EmptyStateCard
              title="Matching listings are temporarily unavailable."
              description="The bounty loaded, but the related listing search failed."
              action={<SecondaryButton href={`/bounties/${encodeURIComponent(id)}`}>Refresh</SecondaryButton>}
            />
          ) : (
            <EmptyStateCard
              title="No direct listing matches yet."
              description="Create a listing to respond to this bounty, or check back as inventory moves."
              action={<PrimaryButton href={`/sell?${fulfillParams.toString()}`}>Create listing</PrimaryButton>}
            />
          )}
        </section>

        {/* ── Matching trades ── */}
        <section className="listing-system-feed bounty-detail-matches">
          <SectionHeader
            title="Matching trades"
            subtitle="Related collector inventory that could turn into a direct deal."
            action={<span className="market-count">{matchingTrades.length}</span>}
          />
          {matchingTrades.length > 0 ? (
            <div className={`market-v2-grid bounty-board-grid ${matchingTrades.length < 3 ? "is-sparse" : ""}`}>
              {matchingTrades.map((trade) => (
                <ListingCard key={trade.id} kind="trade" trade={trade} />
              ))}
            </div>
          ) : tradeMatchesUnavailable ? (
            <EmptyStateCard
              title="Matching trades are temporarily unavailable."
              action={<SecondaryButton href={`/bounties/${encodeURIComponent(id)}`}>Refresh</SecondaryButton>}
            />
          ) : (
            <EmptyStateCard
              title="No trade inventory matches yet."
              action={<SecondaryButton href={`/trades?q=${searchQuery}`}>Browse trades</SecondaryButton>}
            />
          )}
        </section>

      </section>
    </PageContainer>
  );
}
