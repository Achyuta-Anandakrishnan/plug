"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckersLoader } from "@/components/CheckersLoader";
import { ListingCard } from "@/components/market/ListingCard";
import {
  DiscoveryBar,
  EmptyStateCard,
  FilterChip,
  PageContainer,
  PageHeader,
  PrimaryButton,
  SearchIcon,
  SectionHeader,
} from "@/components/product/ProductUI";
import { useCategories } from "@/hooks/useCategories";
import { useMobileUi } from "@/hooks/useMobileUi";
import { useSavedListings } from "@/hooks/useSavedListings";
import {
  type BountyRequestListItem,
} from "@/lib/bounties";

type SortMode = "newest" | "highest-bounty" | "highest-budget" | "most-specific" | "recently-active";

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "highest-bounty", label: "Highest bounty" },
  { value: "highest-budget", label: "Highest budget" },
  { value: "most-specific", label: "Most specific" },
  { value: "recently-active", label: "Recently active" },
];

type BountyBoardClientProps = {
  initialIsMobile?: boolean;
};

export function BountyBoardClient({ initialIsMobile }: BountyBoardClientProps) {
  const isMobileUi = useMobileUi(initialIsMobile);
  const { data: categories } = useCategories();
  const { bountyRequestIds, toggleBountySave } = useSavedListings();

  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bounties, setBounties] = useState<BountyRequestListItem[]>([]);

  const categoryFilters = useMemo(() => {
    const base = [
      { id: "all", label: "All", slug: "" },
      { id: "pokemon", label: "Pokemon", slug: "Pokemon" },
      { id: "sports", label: "Sports", slug: "Sports" },
      { id: "anime", label: "Anime", slug: "Anime" },
      { id: "vintage", label: "Vintage", slug: "Vintage" },
    ];
    const seen = new Set(base.map((entry) => entry.slug.toLowerCase()).filter(Boolean));
    const extras = categories
      .filter((category) => {
        const slug = category.name.toLowerCase();
        if (seen.has(slug)) return false;
        seen.add(slug);
        return true;
      })
      .slice(0, 4)
      .map((category) => ({ id: category.id, label: category.name, slug: category.name }));

    return [...base, ...extras];
  }, [categories]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        params.set("limit", "120");
        params.set("sort", sort);
        if (query.trim()) params.set("q", query.trim());
        if (selectedCategory) params.set("category", selectedCategory);
        const response = await fetch(`/api/bounties?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as BountyRequestListItem[] & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Unable to load bounties.");
        }
        if (!cancelled) {
          setBounties(payload);
          setLoading(false);
        }
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load bounties.");
        setLoading(false);
      }
    };

    const timeout = window.setTimeout(() => {
      void load();
    }, query.trim() ? 180 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [query, selectedCategory, sort]);

  const renderCards = (items: BountyRequestListItem[]) => items.map((bounty) => (
    <ListingCard
      key={bounty.id}
      kind="bounty"
      bounty={bounty}
      saved={bountyRequestIds.has(bounty.id)}
      onToggleSave={toggleBountySave}
    />
  ));

  if (isMobileUi) {
    return (
      <PageContainer className="bounty-page listing-system-page app-page--bounties bounty-mobile-page">
        <section className="app-section bounty-mobile-screen">
          <section className="bounty-mobile-subheader">
            <div className="mobile-page-toolbar-top">
              <div>
                <div className="app-control-title">Bounty</div>
                <p className="bounty-toolbar-note">Post what you want. Put money on it.</p>
              </div>
              <PrimaryButton href="/bounties/new" className="bounty-mobile-create">Post bounty</PrimaryButton>
            </div>
            <div className="app-search">
              <SearchIcon />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search cards, players, sets, certs"
              />
            </div>
            <div className="mobile-page-toolbar-scroll bounty-mobile-chiprail">
              {categoryFilters.map((category) => (
                <FilterChip
                  key={category.id}
                  label={category.label}
                  active={selectedCategory === category.slug}
                  onClick={() => setSelectedCategory(selectedCategory === category.slug ? "" : category.slug)}
                />
              ))}
            </div>
            <div className="bounty-mobile-selects">
              <label className="app-select-wrap app-select-inline">
                <span>Sort</span>
                <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="app-select">
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {error ? <EmptyStateCard title="Bounty unavailable" description={error} /> : null}
          {loading ? <CheckersLoader title="Loading bounties..." compact /> : null}

          {!loading ? (
            <section className="mobile-feed-section bounty-mobile-feed-section" >
              <div className="mobile-feed-section-head">
                <h2>Bounty feed</h2>
                <span>{bounties.length}</span>
              </div>
              {bounties.length === 0 ? (
                <EmptyStateCard
                  title="No bounties match this search."
                  description="Try another card or a broader category."
                />
              ) : (
                <div className={`market-v2-grid bounty-board-grid ${bounties.length > 0 && bounties.length < 3 ? "is-sparse" : ""}`}>
                  {renderCards(bounties)}
                </div>
              )}
            </section>
          ) : null}
        </section>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="bounty-page listing-system-page app-page--bounties">
      <section className="app-section bounty-board-page">
        <PageHeader
          title="Bounty"
          subtitle="Post what you want. Put money on it."
          actions={<PrimaryButton href="/bounties/new">Post bounty</PrimaryButton>}
        />

        <DiscoveryBar className="app-control-bar listing-system-toolbar bounty-toolbar">
          <div className="app-search bounty-toolbar-search">
            <SearchIcon />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search cards, players, sets, cert numbers"
            />
          </div>
          <div className="app-chip-row bounty-toolbar-categories">
            {categoryFilters.map((category) => (
              <FilterChip
                key={category.id}
                label={category.label}
                active={selectedCategory === category.slug}
                onClick={() => setSelectedCategory(selectedCategory === category.slug ? "" : category.slug)}
              />
            ))}
          </div>
          <div className="listing-system-toolbar-meta bounty-toolbar-meta">
            <label className="app-select-wrap app-select-inline">
              <span>Sort</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="app-select">
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
        </DiscoveryBar>

        {error ? <EmptyStateCard title="Bounty unavailable" description={error} /> : null}
        {loading ? <CheckersLoader title="Loading bounties..." compact /> : null}

        <section className="listing-system-feed bounty-feed-section">
          <SectionHeader
            title="Bounty"
            subtitle="Live buyer demand ready for sellers, finders, and matching inventory."
            action={<span className="market-count">{bounties.length} open</span>}
          />
          {!loading && bounties.length === 0 ? (
            <EmptyStateCard
              title="No bounties match these filters."
              description="Try a broader search or another category."
            />
          ) : null}
          <div className={`market-v2-grid bounty-board-grid ${bounties.length > 0 && bounties.length < 3 ? "is-sparse" : ""}`}>
            {renderCards(bounties)}
          </div>
        </section>
      </section>
    </PageContainer>
  );
}
