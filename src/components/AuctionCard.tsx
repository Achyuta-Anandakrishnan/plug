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
      className="group relative aspect-[4/5] w-full overflow-hidden rounded-[20px] border border-white/60 bg-slate-900 shadow-[0_18px_44px_rgba(15,23,42,0.16)] transition hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(15,23,42,0.22)] sm:aspect-[5/7] sm:rounded-[28px]"
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={title}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        >
          <source src="/streams/loop.mp4" type="video/mp4" />
        </video>
      )}

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(27,77,255,0.26),_transparent_55%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,_rgba(2,6,23,0.86),_rgba(2,6,23,0.24)_55%,_rgba(2,6,23,0.06))]" />

      <div className="absolute left-3 top-3 right-3 flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {badge ? (
            <span className="rounded-full bg-white/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-800">
              {badge}
            </span>
          ) : null}
          {category ? (
            <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/90">
              {category}
            </span>
          ) : null}
        </div>
        {listingType !== "AUCTION" && buyNowPrice ? (
          <span className="rounded-full bg-white/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-800">
            Buy now {formatCurrency(buyNowPrice, currency)}
          </span>
        ) : null}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="space-y-2">
          <div>
            <h3 className="font-display text-base leading-tight text-white sm:text-[18px]">
              {title}
            </h3>
            <p className="text-xs text-white/70">{sellerName}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-white">
            <div className="rounded-2xl bg-white/10 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
                Current
              </p>
              <p className="font-display text-base sm:text-lg">
                {formatCurrency(currentBid, currency)}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-2 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
                Time
              </p>
              <p className="font-display text-base text-[rgba(165,190,255,0.98)] sm:text-lg">
                {formatSeconds(timeLeft)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-white/70">
            <span>{watchers} watching</span>
            <span className="font-semibold text-white">Enter</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
