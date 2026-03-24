type SkeletonCardProps = {
  count?: number;
  aspectRatio?: "4/5" | "16/9";
};

function SingleSkeletonCard({ aspectRatio = "4/5" }: { aspectRatio?: "4/5" | "16/9" }) {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div
        className="skeleton-card-media skeleton-block"
        style={{ aspectRatio: aspectRatio === "4/5" ? "4/5" : "16/9" }}
      />
      <div className="skeleton-card-info">
        <div className="skeleton-block skeleton-title" />
        <div className="skeleton-block skeleton-meta" />
        <div className="skeleton-block skeleton-price" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6, aspectRatio = "4/5" }: SkeletonCardProps) {
  return (
    <div className="skeleton-grid" role="status" aria-label="Loading listings…">
      {Array.from({ length: count }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
        <SingleSkeletonCard key={i} aspectRatio={aspectRatio} />
      ))}
    </div>
  );
}

export function SkeletonRail({ count = 4, aspectRatio = "4/5" }: SkeletonCardProps) {
  return (
    <div className="skeleton-rail" role="status" aria-label="Loading…">
      {Array.from({ length: count }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
        <SingleSkeletonCard key={i} aspectRatio={aspectRatio} />
      ))}
    </div>
  );
}
