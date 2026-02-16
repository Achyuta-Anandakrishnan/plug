import Link from "next/link";
import { AuctionCard } from "@/components/AuctionCard";
import { auctions } from "@/lib/mock";

export default function LivePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
            Live
          </p>
          <h1 className="font-display text-3xl text-slate-900">
            Live rooms
          </h1>
        </div>
        <Link
          href="/streams"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--royal)]"
        >
          View all
        </Link>
      </div>

      <section className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
        {auctions.map((stream) => (
          <AuctionCard key={stream.id} {...stream} />
        ))}
      </section>
    </div>
  );
}
