import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MessageUserButton } from "@/components/profiles/MessageUserButton";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const auctionSelect = {
  id: true,
  title: true,
  status: true,
  listingType: true,
  currentBid: true,
  buyNowPrice: true,
  currency: true,
  endTime: true,
  category: { select: { name: true } },
  item: {
    select: {
      images: {
        orderBy: { createdAt: "asc" as const },
        take: 1,
        select: { url: true },
      },
    },
  },
};

async function getProfile(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      displayName: true,
      name: true,
      bio: true,
      image: true,
      createdAt: true,
      sellerProfile: {
        select: {
          status: true,
          trustTier: true,
          auctions: {
            where: { status: { in: ["LIVE", "SCHEDULED", "ENDED"] } },
            orderBy: { updatedAt: "desc" },
            take: 24,
            select: auctionSelect,
          },
        },
      },
    },
  });
}

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();
  if (profile.username) {
    redirect(`/u/${profile.username}`);
  }

  const allAuctions = profile.sellerProfile?.auctions ?? [];
  const activeListings = allAuctions.filter((a) => a.status !== "ENDED");
  const saleHistory = allAuctions.filter((a) => a.status === "ENDED");

  return (
    <div className="profile-page-screen">
      <div className="profile-page-top-row">
        <Link href="/explore" className="app-button app-button-secondary profile-back-btn">
          Back
        </Link>
        <MessageUserButton targetUserId={profile.id} />
      </div>

      <section className="profile-card">
        <div className="profile-card-header">
          <div className="profile-avatar">
            {profile.image ? (
              <Image src={profile.image} alt={profile.displayName ?? "User"} fill sizes="72px" className="object-cover" unoptimized />
            ) : null}
          </div>
          <div className="profile-card-identity">
            <h1 className="profile-display-name">{profile.displayName ?? profile.name ?? "User"}</h1>
            <p className="profile-since">Since {new Date(profile.createdAt).getFullYear()}</p>
          </div>
        </div>

        {profile.bio ? <p className="profile-bio-text">{profile.bio}</p> : null}

        <div className="profile-meta-grid">
          <div className="profile-meta-item">
            <span className="profile-meta-label">Sales</span>
            <span className="profile-meta-value">{saleHistory.length}</span>
          </div>
          {profile.sellerProfile?.trustTier ? (
            <div className="profile-meta-item">
              <span className="profile-meta-label">Trust tier</span>
              <span className="profile-meta-value">{profile.sellerProfile.trustTier}</span>
            </div>
          ) : null}
          {profile.sellerProfile?.status ? (
            <div className="profile-meta-item">
              <span className="profile-meta-label">Seller</span>
              <span className="profile-meta-value">{profile.sellerProfile.status}</span>
            </div>
          ) : null}
        </div>
      </section>

      {activeListings.length > 0 ? (
        <section className="profile-card">
          <div className="profile-section-head">
            <h2 className="app-section-title">Active listings</h2>
            <span className="market-count">{activeListings.length}</span>
          </div>
          <div className="profile-listings-grid">
            {activeListings.map((listing) => (
              <Link key={listing.id} href={`/streams/${listing.id}`} className="profile-listing-item">
                {listing.item?.images?.[0]?.url ? (
                  <div className="profile-listing-thumb">
                    <Image src={listing.item.images[0].url} alt={listing.title} fill sizes="80px" className="object-cover" unoptimized />
                  </div>
                ) : null}
                <div className="profile-listing-copy">
                  <p className="profile-listing-title">{listing.title}</p>
                  <p className="profile-listing-meta">{listing.category?.name ?? "Collectible"}</p>
                  <p className="profile-listing-price">{formatCurrency(listing.currentBid, listing.currency?.toUpperCase() ?? "USD")}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {saleHistory.length > 0 ? (
        <section className="profile-card">
          <div className="profile-section-head">
            <h2 className="app-section-title">Sale history</h2>
            <span className="market-count">{saleHistory.length}</span>
          </div>
          <div className="profile-listings-grid">
            {saleHistory.map((listing) => (
              <Link key={listing.id} href={`/streams/${listing.id}`} className="profile-listing-item">
                {listing.item?.images?.[0]?.url ? (
                  <div className="profile-listing-thumb">
                    <Image src={listing.item.images[0].url} alt={listing.title} fill sizes="80px" className="object-cover" unoptimized />
                  </div>
                ) : null}
                <div className="profile-listing-copy">
                  <p className="profile-listing-title">{listing.title}</p>
                  <p className="profile-listing-meta">{listing.category?.name ?? "Collectible"}</p>
                  <p className="profile-listing-price">{formatCurrency(listing.currentBid, listing.currency?.toUpperCase() ?? "USD")}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {activeListings.length === 0 && saleHistory.length === 0 ? (
        <section className="profile-card">
          <p className="app-status-note">No listings yet.</p>
        </section>
      ) : null}
    </div>
  );
}
