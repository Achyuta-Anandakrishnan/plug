import Link from "next/link";
import { StreamRoomResponsive } from "@/components/streams/StreamRoomResponsive";
import type { AuctionDetail } from "@/hooks/useAuction";

export default async function StreamRoom({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let initialData: AuctionDetail | null = null;
  const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY);

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/auctions/${id}`,
      { cache: "no-store" },
    );
    if (response.ok) {
      initialData = (await response.json()) as AuctionDetail;
    }
  } catch {
    initialData = null;
  }

  return (
    <div className="ios-screen">
      <section className="ios-hero flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/live" className="mt-2 inline-block text-sm text-slate-500">
            Back to live
          </Link>
          <h1 className="mt-3 font-display text-4xl text-slate-900">
            Live stream
          </h1>
        </div>
        <div className="hidden sm:flex flex-wrap gap-3">
          <span className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-600">
            Escrow protected
          </span>
          <span className="rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold text-[var(--royal)]">
            Manual verification
          </span>
        </div>
      </section>

      <StreamRoomResponsive
        auctionId={id}
        initialData={initialData}
        stripeEnabled={stripeReady}
      />
    </div>
  );
}
