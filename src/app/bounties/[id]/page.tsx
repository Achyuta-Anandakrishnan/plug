import type { Prisma } from "@prisma/client";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ListingCard } from "@/components/market/ListingCard";
import { MessageUserButton } from "@/components/profiles/MessageUserButton";
import {
  EmptyStateCard,
  PageContainer,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
} from "@/components/product/ProductUI";
import { bountyAmountLabel, bountyBudgetLabel } from "@/lib/bounties";
import { ensureBountySchema } from "@/lib/bounty-schema";
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

function detailValue(value: string | null | undefined, fallback = "Not specified") {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || fallback;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeAttributes(value: Prisma.JsonValue | null | undefined): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
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
  return [
    bounty.itemName,
    bounty.title,
    bounty.player,
    bounty.setName,
    bounty.year,
    bounty.certNumber,
    bounty.category,
  ]
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

function serializeAuctionListItem(
  listing: MatchingAuctionCandidate,
): AuctionListItem {
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
      ? {
          ...listing.item,
          attributes: normalizeAttributes(listing.item.attributes),
        }
      : null,
  };
}

function asTradeSearchBlob(trade: TradePostListItem) {
  return [
    trade.title,
    trade.category,
    trade.cardSet,
    trade.cardNumber,
    trade.gradeCompany,
    trade.gradeLabel,
    trade.condition,
    trade.lookingFor,
  ]
    .map((entry) => normalizeText(entry))
    .filter(Boolean)
    .join(" ");
}

export default async function BountyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensureBountySchema().catch(() => null);
  const { id } = await params;

  const bounty = await prisma.wantRequest.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          image: true,
        },
      },
      _count: {
        select: { saves: true },
      },
    },
  });

  if (!bounty) {
    notFound();
  }

  const collectorName = bounty.user.displayName ?? bounty.user.username ?? "Collector";
  const searchQuery = encodeURIComponent(bounty.itemName || bounty.title);
  const fulfillParams = new URLSearchParams({
    mode: "BUY_NOW",
    ...(bounty.certNumber ? { cert: bounty.certNumber } : {}),
    ...(bounty.gradeCompany ? { grader: bounty.gradeCompany } : {}),
    ...((bounty.priceMax ?? bounty.priceMin) ? { price: String(((bounty.priceMax ?? bounty.priceMin) ?? 0) / 100) } : {}),
  });
  const terms = searchTermsForBounty(bounty);

  const [candidateListings, candidateTrades] = await Promise.all([
    prisma.auction.findMany({
      where: {
        status: { in: ["SCHEDULED", "LIVE"] },
      },
      include: {
        category: { select: { name: true } },
        seller: {
          select: {
            user: {
              select: {
                id: true,
                displayName: true,
              },
            },
          },
        },
        streamSessions: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        item: {
          select: {
            attributes: true,
            images: {
              orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
              select: {
                url: true,
                isPrimary: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 48,
    }),
    prisma.tradePost.findMany({
      where: {
        status: { in: ["OPEN", "MATCHED", "PAUSED"] },
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
        images: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          select: {
            id: true,
            url: true,
            isPrimary: true,
          },
        },
        _count: {
          select: { offers: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 48,
    }),
  ]);

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

  return (
    <PageContainer className="bounty-detail-page app-page--bounty-detail">
      <section className="app-section">
        <PageHeader
          eyebrow="Bounty"
          title={bounty.title}
          subtitle={`Posted by ${collectorName}`}
          actions={
            <div className="bounty-detail-header-actions">
              <PrimaryButton href={`/sell?${fulfillParams.toString()}`}>Fulfill bounty</PrimaryButton>
              <SecondaryButton href={`/listings?q=${searchQuery}`}>Match listing</SecondaryButton>
              <MessageUserButton targetUserId={bounty.user.id} className="app-button app-button-secondary" />
            </div>
          }
        />

        <section className="bounty-detail-layout">
          <article className="product-card bounty-detail-media-card">
            <div className="bounty-detail-media">
              {bounty.imageUrl ? (
                <Image
                  src={bounty.imageUrl}
                  alt={bounty.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="bounty-detail-media-fallback">
                  <span className="listing-card-badge trade-status-chip is-open">Bounty</span>
                  <strong>{bounty.itemName}</strong>
                </div>
              )}
            </div>
          </article>

          <article className="product-card bounty-detail-summary">
            <div className="bounty-detail-summary-head">
              <span className="listing-card-badge trade-status-chip is-open">
                {bounty.status === "OPEN" ? "Bounty" : bounty.status}
              </span>
              <span className="market-count">{bounty._count.saves} saves</span>
            </div>
            <h2>{bounty.itemName}</h2>

            <div className="bounty-detail-price-stack">
              <div>
                <span>Budget</span>
                <strong>{bountyBudgetLabel(bounty.priceMin, bounty.priceMax).replace(/^Budget\s*/, "")}</strong>
              </div>
              <div>
                <span>Bounty</span>
                <strong>{bountyAmountLabel(bounty.bountyAmount).replace(/^Bounty\s*/, "")}</strong>
              </div>
            </div>

            <div className="bounty-detail-meta-grid">
              <div>
                <span>Player</span>
                <strong>{detailValue(bounty.player)}</strong>
              </div>
              <div>
                <span>Set</span>
                <strong>{detailValue(bounty.setName)}</strong>
              </div>
              <div>
                <span>Year</span>
                <strong>{detailValue(bounty.year)}</strong>
              </div>
              <div>
                <span>Grade</span>
                <strong>{detailValue([bounty.gradeCompany, bounty.gradeTarget || bounty.grade].filter(Boolean).join(" "))}</strong>
              </div>
              <div>
                <span>Condition</span>
                <strong>{detailValue(bounty.condition)}</strong>
              </div>
              <div>
                <span>Cert #</span>
                <strong>{detailValue(bounty.certNumber)}</strong>
              </div>
              <div>
                <span>Category</span>
                <strong>{detailValue(bounty.category)}</strong>
              </div>
            </div>

            <div className="bounty-detail-notes">
              <SectionHeader title="Notes" />
              <p>{bounty.notes?.trim() || "No extra notes attached to this bounty yet."}</p>
            </div>
          </article>
        </section>

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
          ) : (
            <EmptyStateCard
              title="No direct listing matches yet."
              description="Use the card details above to create a matching listing or watch for new inventory."
              action={<PrimaryButton href={`/sell?${fulfillParams.toString()}`}>Create listing</PrimaryButton>}
            />
          )}
        </section>

        <section className="listing-system-feed bounty-detail-matches">
          <SectionHeader
            title="Matching trades"
            subtitle="Related collector inventory that could be turned into a direct outreach or deal."
            action={<span className="market-count">{matchingTrades.length}</span>}
          />
          {matchingTrades.length > 0 ? (
            <div className={`market-v2-grid bounty-board-grid ${matchingTrades.length < 3 ? "is-sparse" : ""}`}>
              {matchingTrades.map((trade) => (
                <ListingCard key={trade.id} kind="trade" trade={trade} />
              ))}
            </div>
          ) : (
            <EmptyStateCard
              title="No trade inventory matches yet."
              description="Try the market or create a listing to respond directly to this bounty."
              action={<SecondaryButton href={`/trades?q=${searchQuery}`}>Browse trades</SecondaryButton>}
            />
          )}
        </section>
      </section>
    </PageContainer>
  );
}
