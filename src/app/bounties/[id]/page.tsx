import Image from "next/image";
import { notFound } from "next/navigation";
import { MessageUserButton } from "@/components/profiles/MessageUserButton";
import {
  PageContainer,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
} from "@/components/product/ProductUI";
import { bountyAmountLabel, bountyBudgetLabel } from "@/lib/bounties";
import { prisma } from "@/lib/prisma";

function detailValue(value: string | null | undefined, fallback = "Not specified") {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || fallback;
}

export default async function BountyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  return (
    <PageContainer className="bounty-detail-page app-page--bounty-detail">
      <section className="app-section">
        <PageHeader
          eyebrow="Bounty"
          title={bounty.title}
          subtitle={`Posted by ${collectorName}`}
          actions={
            <div className="bounty-detail-header-actions">
              <PrimaryButton href={`/sell?mode=BUY_NOW&bountyId=${encodeURIComponent(bounty.id)}`}>Fulfill bounty</PrimaryButton>
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
      </section>
    </PageContainer>
  );
}
