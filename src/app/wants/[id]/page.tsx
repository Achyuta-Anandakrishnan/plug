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
import { prisma } from "@/lib/prisma";
import { wantPriceLabel } from "@/lib/wants";

function detailValue(value: string | null | undefined, fallback = "Not specified") {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || fallback;
}

export default async function WantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const want = await prisma.wantRequest.findUnique({
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

  if (!want) {
    notFound();
  }

  const sellerName = want.user.displayName ?? want.user.username ?? "Collector";

  return (
    <PageContainer className="want-detail-page app-page--want-detail">
      <section className="app-section">
        <PageHeader
          eyebrow="Want Board"
          title={want.title}
          subtitle={`Posted by ${sellerName}`}
          actions={
            <div className="want-detail-header-actions">
              <PrimaryButton href="/sell?mode=BUY_NOW">Sell to them</PrimaryButton>
              <SecondaryButton href="/listings">Match listing</SecondaryButton>
              <MessageUserButton targetUserId={want.user.id} className="app-button app-button-secondary" />
            </div>
          }
        />

        <section className="want-detail-layout">
          <article className="product-card want-detail-media-card">
            <div className="want-detail-media">
              {want.imageUrl ? (
                <Image
                  src={want.imageUrl}
                  alt={want.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="want-detail-media-fallback">
                  <span className="listing-card-badge trade-status-chip is-open">Want</span>
                  <strong>{want.itemName}</strong>
                </div>
              )}
            </div>
          </article>

          <article className="product-card want-detail-summary">
            <div className="want-detail-summary-head">
              <span className="listing-card-badge trade-status-chip is-open">
                {want.status === "OPEN" ? "Want" : want.status}
              </span>
              <span className="market-count">{want._count.saves} saves</span>
            </div>
            <h2>{want.itemName}</h2>
            <p className="want-detail-price">{wantPriceLabel(want.priceMin, want.priceMax)}</p>

            <div className="want-detail-meta-grid">
              <div>
                <span>Grade</span>
                <strong>{detailValue(want.grade)}</strong>
              </div>
              <div>
                <span>Condition</span>
                <strong>{detailValue(want.condition)}</strong>
              </div>
              <div>
                <span>Cert #</span>
                <strong>{detailValue(want.certNumber)}</strong>
              </div>
              <div>
                <span>Category</span>
                <strong>{detailValue(want.category)}</strong>
              </div>
            </div>

            <div className="want-detail-notes">
              <SectionHeader title="Notes" />
              <p>{want.notes?.trim() || "No extra notes attached to this want yet."}</p>
            </div>
          </article>
        </section>
      </section>
    </PageContainer>
  );
}
