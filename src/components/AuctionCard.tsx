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
      className="group relative aspect-[3/4] w-full overflow-hidden rounded-[22px] border border-white/45 bg-slate-900 shadow-[0_20px_40px_rgba(0,0,0,0.34)] transition hover:-translate-y-1 hover:shadow-[0_28px_60px_rgba(0,0,0,0.48)]"
    >
      <Image
        src={displayImageUrl}
        alt={title}
        fill
        sizes="(max-width: 768px) 50vw, 22vw"
        className="object-cover transition duration-500 group-hover:scale-[1.03]"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.14),_transparent_55%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,_rgba(2,6,23,0.84),_rgba(2,6,23,0.2)_52%,_rgba(2,6,23,0.06))]" />

      <div className="absolute left-3 top-3 right-3 flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {badge ? (
            <span className="rounded-full bg-white/88 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-800">
              {badge}
            </span>
          ) : null}
          {category ? (
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/90">
              {category}
            </span>
          ) : null}
        </div>
        {listingType !== "AUCTION" && buyNowPrice ? (
          <span className="rounded-full bg-white/88 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-800">
            {formatCurrency(buyNowPrice, currency)}
          </span>
        ) : null}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3">
        <div className="space-y-2.5">
          <div className="space-y-1">
            <h3 className="line-clamp-2 font-display text-base font-semibold leading-tight text-white">
              {title}
            </h3>
            <p className="text-[11px] text-white/72">{sellerName}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-white">
            <div className="rounded-[16px] bg-white/10 px-2.5 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/65">
                Bid
              </p>
              <p className="font-display text-[15px]">
                {formatCurrency(currentBid, currency)}
              </p>
            </div>
            <div className="rounded-[16px] bg-white/10 px-2.5 py-2 text-right">
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/65">
                Time
              </p>
              <p className="font-display text-[15px] text-white">
                {formatSeconds(timeLeft)}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-white/68">
            {watchers} watching{gradeLabel ? ` · ${gradeLabel}` : ""}
          </p>
        </div>
      </div>
    </Link>
  );
}
