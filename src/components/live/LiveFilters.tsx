import type { LiveSortMode, LiveTimingFilter } from "@/components/live/types";
import { AppPageBar, SearchIcon, SegmentedControl } from "@/components/product/ProductUI";
import { useMobileUi } from "@/hooks/useMobileUi";

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
        <SegmentedControl options={TIMING_OPTIONS} value={timing} onChange={onTimingChange} className="live-mobile-timing" />
      </section>
    );
  }

  return (
    <AppPageBar title={title} aria-label="Live stream discovery filters">
      <div className="app-search">
        <SearchIcon />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search streams, hosts, categories"
        />
      </div>
      <SegmentedControl options={TIMING_OPTIONS} value={timing} onChange={onTimingChange} />
      <div className="app-toolbar-spacer" aria-hidden="true" />
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
    </AppPageBar>
  );
}
