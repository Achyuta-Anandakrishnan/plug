import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { resolveDisplayMediaUrl } from "@/lib/media-placeholders";
import { EmptyStateCard, PageContainer, PageHeader, PrimaryButton } from "@/components/product/ProductUI";

function formatOrderDate(value: Date) {
  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function OrdersPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return (
      <PageContainer className="orders-page app-page--orders">
        <section className="app-section">
          <PageHeader
            title="Orders"
            subtitle="Track purchases, payment, and delivery in one place."
          />
          <EmptyStateCard
            title="Sign in to view your orders."
            description="Order history is attached to your collector account."
            action={<PrimaryButton href="/signin">Sign in</PrimaryButton>}
          />
        </section>
      </PageContainer>
    );
  }

  const orders = await prisma.order.findMany({
    where: { buyerId: sessionUser.id },
    orderBy: { createdAt: "desc" },
    include: {
      auction: {
        include: {
          item: {
            include: {
              images: {
                orderBy: { createdAt: "asc" },
                take: 1,
              },
            },
          },
        },
      },
      payment: true,
      shipment: true,
    },
    take: 50,
  });

  return (
    <PageContainer className="orders-page app-page--orders">
      <section className="app-section">
        <PageHeader
          title="Orders"
          subtitle="Track purchases, payment, and delivery in one place."
        />

        {orders.length === 0 ? (
          <EmptyStateCard
            title="No orders yet."
            description="Winning bids and buy-now checkouts will appear here."
            action={<PrimaryButton href="/market">Explore marketplace</PrimaryButton>}
          />
        ) : (
          <div className="orders-list">
            {orders.map((order) => {
              const imageUrl = resolveDisplayMediaUrl(order.auction.item?.images[0]?.url ?? null, "/placeholders/pokemon-generic.svg");
              return (
                <article key={order.id} className="product-card order-row">
                  <div className="order-row-media">
                    <Image
                      src={imageUrl}
                      alt={order.auction.title}
                      fill
                      sizes="88px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="order-row-copy">
                    <div className="order-row-head">
                      <p className="order-row-status">{order.status.replace(/_/g, " ")}</p>
                      <p className="order-row-date">{formatOrderDate(order.createdAt)}</p>
                    </div>
                    <h2>{order.auction.title}</h2>
                    <div className="order-row-meta">
                      <span>{formatCurrency(order.amount, order.currency.toUpperCase())}</span>
                      <span>{order.shipment?.status?.replace(/_/g, " ") ?? "Shipment pending"}</span>
                      <span>{order.payment?.status?.replace(/_/g, " ") ?? "Payment pending"}</span>
                    </div>
                  </div>
                  <div className="order-row-actions">
                    <Link href={`/streams/${order.auctionId}`}>View listing</Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
