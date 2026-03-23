import type { LiveCategoryFilter, LiveSortMode, LiveStreamTypeFilter, LiveTimingFilter } from "@/components/live/types";
import { DiscoveryBar, FilterChip, SearchIcon, SegmentedControl } from "@/components/product/ProductUI";
import { useMobileUi } from "@/hooks/useMobileUi";

const CATEGORY_OPTIONS: Array<{ value: LiveCategoryFilter; label: string }> = [
  { value: "pokemon", label: "Pokemon" },
  { value: "sports", label: "Sports" },
  { value: "anime", label: "Anime" },
  { value: "funko", label: "Funko" },
];

const STREAM_TYPE_OPTIONS: Array<{ value: LiveStreamTypeFilter; label: string }> = [
  { value: "all", label: "All rooms" },
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
  mobile?: boolean;
  title?: string;
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
  mobile = false,
  title = "Live",
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
  const responsiveMobile = useMobileUi();
  const isMobileUi = mobile || responsiveMobile;

  if (isMobileUi) {
    return (
      <section className="mobile-page-toolbar live-mobile-toolbar" aria-label="Live stream discovery filters">
        <div className="mobile-page-toolbar-top">
          <div className="app-control-title">{title}</div>
          <label className="app-select-wrap app-select-inline live-mobile-sort">
            <span>Sort</span>
            <select value={sort} onChange={(event) => onSortChange(event.target.value as LiveSortMode)} className="app-select">
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="app-search">
          <SearchIcon />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search streams and hosts"
          />
        </div>
        <div className="app-chip-row mobile-page-toolbar-scroll">
          {CATEGORY_OPTIONS.map((option) => (
            <FilterChip
              key={option.value}
              label={option.label}
              active={category === option.value}
              onClick={() => onCategoryChange(category === option.value ? "all" : option.value)}
            />
          ))}
        </div>
        <div className="app-chip-row mobile-page-toolbar-scroll live-mobile-types">
          {STREAM_TYPE_OPTIONS.map((option) => (
            <FilterChip
              key={option.value}
              label={option.label}
              active={streamType === option.value}
              onClick={() => onStreamTypeChange(option.value)}
            />
          ))}
        </div>
        <SegmentedControl options={TIMING_OPTIONS} value={timing} onChange={onTimingChange} className="live-mobile-timing" />
      </section>
    );
  }

  return (
    <DiscoveryBar className="app-control-bar listing-system-toolbar live-toolbar" aria-label="Live stream discovery filters">
      <div className="app-control-title">{title}</div>
      <div className="listing-system-toolbar-main live-toolbar-main">
        <div className="app-search">
          <SearchIcon />
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
        <div className="app-chip-row live-toolbar-types">
          {STREAM_TYPE_OPTIONS.map((option) => (
            <FilterChip
              key={option.value}
              label={option.label}
              active={streamType === option.value}
              onClick={() => onStreamTypeChange(option.value)}
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
