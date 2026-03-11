"use client";

type MarketplaceSearchProps = {
  value: string;
  onChange: (value: string) => void;
};

export function MarketplaceSearch({ value, onChange }: MarketplaceSearchProps) {
  return (
    <label className="market-v2-search" aria-label="Search marketplace">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="market-v2-search-icon">
        <path
          d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14m0-2a9 9 0 1 0 5.65 16l4.68 4.67 1.42-1.41-4.67-4.68A9 9 0 0 0 11 2"
          fill="currentColor"
        />
      </svg>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search cards, sets, players, certs"
        className="market-v2-search-input"
      />
    </label>
  );
}
