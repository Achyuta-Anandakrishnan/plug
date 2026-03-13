import type { LiveCategoryFilter, LiveSortMode, LiveStreamTypeFilter, LiveTimingFilter } from "@/components/live/types";
import { DiscoveryBar, FilterChip, SegmentedControl } from "@/components/product/ProductUI";

const CATEGORY_OPTIONS: Array<{ value: LiveCategoryFilter; label: string }> = [
  { value: "pokemon", label: "Pokemon" },
  { value: "sports", label: "Sports" },
  { value: "anime", label: "Anime" },
  { value: "funko", label: "Funko" },
];

const TYPE_OPTIONS: Array<{ value: LiveStreamTypeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "live-breaks", label: "Live breaks" },
  { value: "auctions", label: "Auctions" },
  { value: "seller-shows", label: "Seller shows" },
];

const SORT_OPTIONS: Array<{ value: LiveSortMode; label: string }> = [
  { value: "viewers", label: "Most viewers" },
  { value: "ending", label: "Ending soon" },
  { value: "newest", label: "Newest live" },
  { value: "trending", label: "Trending" },
];

const TIMING_OPTIONS: Array<{ value: LiveTimingFilter; label: string }> = [
  { value: "live", label: "Live now" },
  { value: "upcoming", label: "Upcoming" },
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
    <DiscoveryBar className="app-control-bar live-toolbar" aria-label="Live stream discovery filters">
      <div className="app-search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14m0-2a9 9 0 1 0 5.65 16l4.68 4.67 1.42-1.41-4.67-4.68A9 9 0 0 0 11 2" fill="currentColor" />
        </svg>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search streams, hosts, categories"
        />
      </div>

      <div className="app-chip-row">
        {CATEGORY_OPTIONS.map((option) => (
          <FilterChip
            key={option.value}
            label={option.label}
            active={category === option.value}
            onClick={() => onCategoryChange(category === option.value ? "all" : option.value)}
          />
        ))}
      </div>
      <SegmentedControl options={TYPE_OPTIONS} value={streamType} onChange={onStreamTypeChange} />
      <label className="app-select-wrap app-select-inline">
        <span>Sort</span>
        <select value={sort} onChange={(event) => onSortChange(event.target.value as LiveSortMode)} className="app-select">
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <SegmentedControl options={TIMING_OPTIONS} value={timing} onChange={onTimingChange} />
    </DiscoveryBar>
  );
}
