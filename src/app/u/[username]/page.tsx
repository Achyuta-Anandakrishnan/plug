import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageUserButton } from "@/components/profiles/MessageUserButton";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";

async function getProfileByUsername(username: string) {
  return prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      displayName: true,
      name: true,
      bio: true,
      image: true,
      createdAt: true,
      role: true,
      sellerProfile: {
        select: {
          status: true,
          trustTier: true,
          auctions: {
            where: { status: { in: ["LIVE", "SCHEDULED"] } },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              title: true,
              status: true,
              listingType: true,
              currentBid: true,
              buyNowPrice: true,
              currency: true,
              category: { select: { name: true } },
              item: {
                select: {
                  images: {
                    orderBy: { createdAt: "asc" },
                    take: 1,
                    select: { url: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

export default async function UsernameProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getProfileByUsername(username.toLowerCase());
  if (!profile) notFound();

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
              <Image
                src={profile.image}
                alt={profile.displayName ?? "User"}
                fill
                sizes="56px"
                className="object-cover"
                unoptimized
              />
            ) : null}
          </div>
          <div className="profile-card-identity">
            <h1 className="profile-display-name">
              {profile.displayName ?? profile.name ?? "User"}
            </h1>
            <p className="profile-username">@{profile.username}</p>
            <p className="profile-since">
              Member since {new Date(profile.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="profile-bio-block">
          <p className="app-eyebrow">Bio</p>
          <p className="profile-bio-text">{profile.bio ?? "No bio added yet."}</p>
        </div>

        <div className="profile-meta-grid">
          <div className="profile-meta-item">
            <span className="profile-meta-label">Role</span>
            <span className="profile-meta-value">{profile.role}</span>
          </div>
          <div className="profile-meta-item">
            <span className="profile-meta-label">Seller status</span>
            <span className="profile-meta-value">{profile.sellerProfile?.status ?? "N/A"}</span>
          </div>
          <div className="profile-meta-item">
            <span className="profile-meta-label">Trust tier</span>
            <span className="profile-meta-value">{profile.sellerProfile?.trustTier ?? "–"}</span>
          </div>
        </div>
      </section>

      <section className="profile-card">
        <div className="profile-section-head">
          <h2 className="app-section-title">Live / Scheduled listings</h2>
          <span className="market-count">{profile.sellerProfile?.auctions.length ?? 0} active</span>
        </div>

        <div className="profile-listings-grid">
          {(profile.sellerProfile?.auctions ?? []).map((listing) => (
            <Link key={listing.id} href={`/streams/${listing.id}`} className="profile-listing-item">
              <p className="profile-listing-title">{listing.title}</p>
              <p className="profile-listing-meta">
                {listing.category?.name ?? "Collectible"} · {listing.status}
              </p>
              <p className="profile-listing-price">
                {formatCurrency(listing.currentBid, listing.currency?.toUpperCase() ?? "USD")}
              </p>
            </Link>
          ))}
          {(profile.sellerProfile?.auctions?.length ?? 0) === 0 ? (
            <p className="app-status-note">No active listings.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
