import type { LiveCategoryFilter, LiveSortMode, LiveStreamTypeFilter, LiveTimingFilter } from "@/components/live/types";

const CATEGORY_OPTIONS: Array<{ value: LiveCategoryFilter; label: string }> = [
  { value: "pokemon", label: "Pokemon" },
  { value: "sports", label: "Sports" },
  { value: "anime", label: "Anime" },
  { value: "funko", label: "Funko" },
];

const TYPE_OPTIONS: Array<{ value: LiveStreamTypeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "live-breaks", label: "Live Breaks" },
  { value: "auctions", label: "Auctions" },
  { value: "seller-shows", label: "Seller Shows" },
];

const SORT_OPTIONS: Array<{ value: LiveSortMode; label: string }> = [
  { value: "viewers", label: "Most viewers" },
  { value: "ending", label: "Ending soon" },
  { value: "newest", label: "Newest live" },
  { value: "trending", label: "Trending" },
];

type LiveFiltersProps = {
  query: string;
  onQueryChange: (value: string) => void;
  category: LiveCategoryFilter;
  onCategoryChange: (value: LiveCategoryFilter) => void;
  streamType: LiveStreamTypeFilter;
  onStreamTypeChange: (value: LiveStreamTypeFilter) => void;
  sort: LiveSortMode;
  onSortChange: (value: LiveSortMode) => void;
  timing: LiveTimingFilter;
  onTimingChange: (value: LiveTimingFilter) => void;
};

export function LiveFilters({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  streamType,
  onStreamTypeChange,
  sort,
  onSortChange,
  timing,
  onTimingChange,
}: LiveFiltersProps) {
  return (
    <section className="live-v3-filters" aria-label="Live stream discovery filters">
      <div className="live-v3-search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14m0-2a9 9 0 1 0 5.65 16l4.68 4.67 1.42-1.41-4.67-4.68A9 9 0 0 0 11 2" fill="currentColor" />
        </svg>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search streams, hosts, categories"
        />
      </div>

      <div className="live-v3-chip-row live-v3-category-row">
        {CATEGORY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onCategoryChange(category === option.value ? "all" : option.value)}
            className={`live-v3-chip ${category === option.value ? "is-active" : ""}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="live-v3-browse-row">
        <div className="live-v3-segment" role="group" aria-label="Live stream type">
          {TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onStreamTypeChange(option.value)}
              className={streamType === option.value ? "is-active" : ""}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="live-v3-filter-tools">
          <label>
            <span>Sort</span>
            <select value={sort} onChange={(event) => onSortChange(event.target.value as LiveSortMode)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="live-v3-timing-toggle">
            <button
              type="button"
              className={timing === "live" ? "is-active" : ""}
              onClick={() => onTimingChange("live")}
            >
              Live now
            </button>
            <button
              type="button"
              className={timing === "upcoming" ? "is-active" : ""}
              onClick={() => onTimingChange("upcoming")}
            >
              Upcoming
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
