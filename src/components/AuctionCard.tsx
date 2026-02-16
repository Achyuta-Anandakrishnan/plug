import Image from "next/image";
import Link from "next/link";
import { formatCurrency, formatSeconds } from "@/lib/format";

type AuctionCardProps = {
  id: string;
  title: string;
  sellerName: string;
  category?: string;
  currentBid: number;
  timeLeft: number;
  watchers: number;
  badge?: string;
  imageUrl?: string | null;
  currency?: string;
  listingType?: "AUCTION" | "BUY_NOW" | "BOTH";
  buyNowPrice?: number | null;
};

export function AuctionCard({
  id,
  title,
  sellerName,
  category,
  currentBid,
  timeLeft,
  watchers,
  badge,
  imageUrl,
  currency = "USD",
  listingType = "AUCTION",
  buyNowPrice,
}: AuctionCardProps) {
  return (
    <Link
      href={`/streams/${id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/60 bg-white/80 shadow-[0_14px_32px_rgba(15,23,42,0.12)] transition hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(15,23,42,0.16)]"
    >
      <div className="relative h-32 overflow-hidden bg-gradient-to-br from-blue-50 via-blue-100 to-white sm:h-28">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
          />
        ) : (
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          >
            <source src="/streams/loop.mp4" type="video/mp4" />
          </video>
        )}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(27,77,255,0.25),_transparent_60%)]" />
        {badge && (
          <div className="absolute left-2.5 top-2.5 rounded-full bg-white/85 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-700 sm:left-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-[10px]">
            {badge}
          </div>
        )}
        {category && (
          <div className="absolute bottom-1.5 left-2.5 text-[9px] uppercase tracking-[0.24em] text-white/80 sm:bottom-2 sm:left-3 sm:text-[10px] sm:tracking-[0.28em]">
            {category}
          </div>
        )}
        {listingType !== "AUCTION" && buyNowPrice ? (
          <div className="absolute right-2.5 bottom-2.5 rounded-full bg-white/85 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-700 sm:right-3 sm:bottom-3 sm:px-2.5 sm:py-1 sm:text-[10px]">
            Buy now {formatCurrency(buyNowPrice, currency)}
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-3.5">
        <div>
          <h3 className="font-display text-base text-slate-900 sm:text-lg">
            {title}
          </h3>
          <p className="text-xs text-slate-500">{sellerName}</p>
        </div>
        <div className="mt-auto flex items-center justify-between text-sm text-slate-600">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              Live price
            </p>
            <p className="font-display text-lg text-slate-900 sm:text-xl">
              {formatCurrency(currentBid, currency)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              Time left
            </p>
            <p className="font-display text-lg text-[var(--royal)] sm:text-xl">
              {formatSeconds(timeLeft)}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{watchers} watching</span>
          <span className="font-semibold text-[var(--royal)]">Enter live</span>
        </div>
      </div>
    </Link>
  );
}
