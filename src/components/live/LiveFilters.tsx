import type { LiveCategoryFilter, LiveSortMode, LiveTimingFilter } from "@/components/live/types";
import { DiscoveryBar, FilterChip, SegmentedControl } from "@/components/product/ProductUI";

const CATEGORY_OPTIONS: Array<{ value: LiveCategoryFilter; label: string }> = [
  { value: "pokemon", label: "Pokemon" },
  { value: "sports", label: "Sports" },
  { value: "anime", label: "Anime" },
  { value: "funko", label: "Funko" },
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
  title?: string;
  query: string;
  onQueryChange: (value: string) => void;
  category: LiveCategoryFilter;
  onCategoryChange: (value: LiveCategoryFilter) => void;
  sort: LiveSortMode;
  onSortChange: (value: LiveSortMode) => void;
  timing: LiveTimingFilter;
  onTimingChange: (value: LiveTimingFilter) => void;
};

export function LiveFilters({
  title = "Live",
  query,
  onQueryChange,
  category,
  onCategoryChange,
  sort,
  onSortChange,
  timing,
  onTimingChange,
}: LiveFiltersProps) {
  return (
    <DiscoveryBar className="app-control-bar listing-system-toolbar live-toolbar" aria-label="Live stream discovery filters">
      <div className="app-control-title">{title}</div>
      <div className="listing-system-toolbar-main live-toolbar-main">
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
      </div>
      <div className="listing-system-toolbar-meta live-toolbar-meta">
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
      </div>
    </DiscoveryBar>
  );
}
