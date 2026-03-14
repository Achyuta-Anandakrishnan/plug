"use client";

import type { SortMode } from "@/components/market/types";

export const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "ending", label: "Ending Soon" },
  { value: "price-low", label: "Price Low to High" },
  { value: "price-high", label: "Price High to Low" },
  { value: "popular", label: "Most Watched" },
];

type MarketplaceFiltersProps = {
  categories: Array<{ id: string; label: string; slug: string }>;
  selectedCategory: string;
  onCategoryChange: (slug: string) => void;
  sort: SortMode;
  onSortChange: (value: SortMode) => void;
};

export function MarketplaceFilters({
  categories,
  selectedCategory,
  onCategoryChange,
  sort,
  onSortChange,
}: MarketplaceFiltersProps) {
  return (
    <div className="market-v2-filterbar">
      <div className="market-v2-category-row" aria-label="Category filters">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onCategoryChange(category.slug)}
            className={`market-v2-chip ${selectedCategory === category.slug ? "is-active" : ""}`}
          >
            {category.label}
          </button>
        ))}
      </div>

      <div className="market-v2-tools-row">
        <label className="market-v2-sort-wrap">
          <span className="market-v2-tool-label">Sort</span>
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as SortMode)}
            className="market-v2-select"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
