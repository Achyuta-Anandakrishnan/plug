import Image from "next/image";
import Link from "next/link";
import { formatCurrency, formatSeconds } from "@/lib/format";
import { resolveDisplayMediaUrl } from "@/lib/media-placeholders";

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
  gradeLabel?: string;
  preservePlaceholderMedia?: boolean;
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
  gradeLabel,
  preservePlaceholderMedia = false,
}: AuctionCardProps) {
  const displayImageUrl = preservePlaceholderMedia
    ? (imageUrl ?? "/placeholders/pokemon-generic.svg")
    : resolveDisplayMediaUrl(imageUrl);

  return (
    <Link
      href={`/streams/${id}`}
      className="group relative aspect-[0.7] w-full overflow-hidden rounded-[22px] border border-white/45 bg-slate-900 shadow-[0_20px_40px_rgba(0,0,0,0.34)] transition hover:-translate-y-1 hover:shadow-[0_28px_60px_rgba(0,0,0,0.48)] sm:aspect-[3/4] sm:rounded-[24px]"
    >
      <Image
        src={displayImageUrl}
        alt={title}
        fill
        sizes="(max-width: 768px) 50vw, 25vw"
        className="object-cover transition duration-500 group-hover:scale-[1.03]"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_55%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,_rgba(2,6,23,0.86),_rgba(2,6,23,0.24)_55%,_rgba(2,6,23,0.06))]" />

      <div className="absolute left-3 top-3 right-3 flex items-start justify-between gap-2 sm:left-4 sm:right-4 sm:top-4">
        <div className="flex flex-wrap gap-2">
          {badge ? (
            <span className="rounded-full bg-white/85 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-800">
              {badge}
            </span>
          ) : null}
          {category ? (
            <span className="rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/90">
              {category}
            </span>
          ) : null}
        </div>
        {listingType !== "AUCTION" && buyNowPrice ? (
          <span className="rounded-full bg-white/85 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-800">
            Buy now {formatCurrency(buyNowPrice, currency)}
          </span>
        ) : null}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
        <div className="space-y-2">
          <div>
            <h3 className="font-display text-base font-semibold leading-tight text-white sm:text-lg">
              {title}
            </h3>
            <p className="mt-1 text-xs text-white/72 sm:text-[13px]">{sellerName}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-white">
            <div className="rounded-[20px] bg-white/10 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
                Current
              </p>
              <p className="font-display text-base sm:text-lg">
                {formatCurrency(currentBid, currency)}
              </p>
            </div>
            <div className="rounded-[20px] bg-white/10 px-3 py-2.5 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
                Time
              </p>
              <p className="font-display text-base text-white sm:text-lg">
                {formatSeconds(timeLeft)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-white/72 sm:text-[13px]">
            <span>{watchers} watching</span>
            <span className="font-semibold text-white">{gradeLabel ?? "Enter"}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
