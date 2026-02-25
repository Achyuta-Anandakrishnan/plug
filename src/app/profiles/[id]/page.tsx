import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MessageUserButton } from "@/components/profiles/MessageUserButton";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { ensureProfileSchema } from "@/lib/profile-schema";

async function getProfile(id: string) {
  await ensureProfileSchema().catch(() => null);

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

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();
  if (profile.username) {
    redirect(`/u/${profile.username}`);
  }

  return (
    <div className="space-y-6">
      <div className="mt-2 flex items-center justify-between gap-3">
        <Link
          href="/explore"
          className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700"
        >
          Back
        </Link>
        <MessageUserButton targetUserId={profile.id} />
      </div>

      <section className="surface-panel rounded-[28px] p-5">
        <div className="flex items-center gap-4">
          <div className="relative h-14 w-14 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
            {profile.image ? (
              <Image src={profile.image} alt={profile.displayName ?? "User"} fill sizes="56px" className="object-cover" unoptimized />
            ) : null}
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900">{profile.displayName ?? profile.name ?? "User"}</h1>
            <p className="text-xs text-slate-500">Member since {new Date(profile.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/70 bg-white/70 px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Bio
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {profile.bio ?? "No bio added yet."}
          </p>
        </div>

        <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/70 bg-white/70 px-3 py-2">
            Role: <span className="font-semibold text-slate-900">{profile.role}</span>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/70 px-3 py-2">
            Seller status: <span className="font-semibold text-slate-900">{profile.sellerProfile?.status ?? "N/A"}</span>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/70 px-3 py-2">
            Trust tier: <span className="font-semibold text-slate-900">{profile.sellerProfile?.trustTier ?? "-"}</span>
          </div>
        </div>
      </section>

      <section className="surface-panel rounded-[28px] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg text-slate-900">Live / Scheduled listings</h2>
          <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{profile.sellerProfile?.auctions.length ?? 0} active</span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(profile.sellerProfile?.auctions ?? []).map((listing) => (
            <Link key={listing.id} href={`/streams/${listing.id}`} className="rounded-2xl border border-white/70 bg-white/70 p-3">
              <p className="text-base font-semibold text-slate-900">{listing.title}</p>
              <p className="mt-1 text-xs text-slate-500">{listing.category?.name ?? "Collectible"} · {listing.status}</p>
              <p className="mt-2 text-sm text-slate-700">Current {formatCurrency(listing.currentBid, listing.currency?.toUpperCase() ?? "USD")}</p>
            </Link>
          ))}
          {(profile.sellerProfile?.auctions?.length ?? 0) === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-6 text-sm text-slate-500">
              No active listings.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
