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
  bountyBudgetValue,
  bountySpecificityScore,
  type BountyRequestListItem,
} from "@/lib/bounties";

type GradeFilter = "all" | "raw" | "psa" | "bgs" | "cgc" | "high-grade";
type BudgetFilter = "all" | "under-500" | "500-2500" | "2500-10000" | "10000-plus";
type SortMode = "newest" | "highest-bounty" | "highest-budget" | "most-specific" | "recently-active";
type StatusFilter = "OPEN" | "MATCHED" | "FULFILLED" | "PAUSED";

const GRADE_OPTIONS: Array<{ value: GradeFilter; label: string }> = [
  { value: "all", label: "Any grade" },
  { value: "raw", label: "Raw / ungraded" },
  { value: "psa", label: "PSA" },
  { value: "bgs", label: "BGS / BVG" },
  { value: "cgc", label: "CGC / CSG" },
  { value: "high-grade", label: "High grade" },
];

const BUDGET_OPTIONS: Array<{ value: BudgetFilter; label: string }> = [
  { value: "all", label: "Any budget" },
  { value: "under-500", label: "Under $500" },
  { value: "500-2500", label: "$500-$2.5k" },
  { value: "2500-10000", label: "$2.5k-$10k" },
  { value: "10000-plus", label: "$10k+" },
];

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "highest-bounty", label: "Highest bounty" },
  { value: "highest-budget", label: "Highest budget" },
  { value: "most-specific", label: "Most specific" },
  { value: "recently-active", label: "Recently active" },
];

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "OPEN", label: "Open" },
  { value: "MATCHED", label: "Matched" },
  { value: "FULFILLED", label: "Fulfilled" },
  { value: "PAUSED", label: "Paused" },
];

type BountyBoardClientProps = {
  initialIsMobile?: boolean;
};

export function BountyBoardClient({ initialIsMobile }: BountyBoardClientProps) {
  const isMobileUi = useMobileUi(initialIsMobile);
  const { data: categories } = useCategories();
  const { bountyRequestIds, toggleBountySave, isSignedIn } = useSavedListings();

  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [grade, setGrade] = useState<GradeFilter>("all");
  const [budget, setBudget] = useState<BudgetFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [status, setStatus] = useState<StatusFilter>("OPEN");
  const [mineOnly, setMineOnly] = useState(false);
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
      if (mineOnly && !isSignedIn) {
        setBounties([]);
        setError("");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        params.set("limit", "120");
        params.set("sort", sort);
        params.set("status", status);
        if (query.trim()) params.set("q", query.trim());
        if (selectedCategory) params.set("category", selectedCategory);
        if (grade !== "all") params.set("grade", grade);
        if (budget !== "all") params.set("budget", budget);
        if (mineOnly) params.set("mine", "1");
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
  }, [budget, grade, isSignedIn, mineOnly, query, selectedCategory, sort, status]);

  const featuredBounties = useMemo(
    () =>
      [...bounties]
        .sort((a, b) => {
          const specificityDelta = bountySpecificityScore(b) - bountySpecificityScore(a);
          if (specificityDelta !== 0) return specificityDelta;
          const bountyDelta = (b.bountyAmount ?? 0) - (a.bountyAmount ?? 0);
          if (bountyDelta !== 0) return bountyDelta;
          return bountyBudgetValue(b) - bountyBudgetValue(a);
        })
        .slice(0, 6),
    [bounties],
  );

  const featuredIds = useMemo(() => new Set(featuredBounties.map((entry) => entry.id)), [featuredBounties]);

  const highBounties = useMemo(
    () => [...bounties]
      .filter((entry) => (entry.bountyAmount ?? 0) > 0 && !featuredIds.has(entry.id))
      .sort((a, b) => (b.bountyAmount ?? 0) - (a.bountyAmount ?? 0))
      .slice(0, 6),
    [bounties, featuredIds],
  );

  const highBountyIds = useMemo(() => new Set(highBounties.map((entry) => entry.id)), [highBounties]);

  const recentBounties = useMemo(
    () => [...bounties]
      .filter((entry) => !featuredIds.has(entry.id) && !highBountyIds.has(entry.id))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6),
    [bounties, featuredIds, highBountyIds],
  );

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
              {STATUS_OPTIONS.map((option) => (
                <FilterChip
                  key={option.value}
                  label={option.label}
                  active={status === option.value}
                  onClick={() => setStatus(option.value)}
                />
              ))}
              <FilterChip
                label="Mine"
                active={mineOnly}
                onClick={() => setMineOnly((prev) => !prev)}
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
                <span>Grade</span>
                <select value={grade} onChange={(event) => setGrade(event.target.value as GradeFilter)} className="app-select">
                  {GRADE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="app-select-wrap app-select-inline">
                <span>Budget</span>
                <select value={budget} onChange={(event) => setBudget(event.target.value as BudgetFilter)} className="app-select">
                  {BUDGET_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
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
          {loading ? <CheckersLoader title="Loading bounties..." compact className="ios-empty" /> : null}

          {!loading && featuredBounties.length > 0 ? (
            <section className="mobile-feed-section bounty-mobile-featured-section">
              <div className="mobile-feed-section-head">
                <h2>Featured bounties</h2>
                <span>{featuredBounties.length}</span>
              </div>
              <div className="market-rail-grid bounty-rail-grid">
                {renderCards(featuredBounties)}
              </div>
            </section>
          ) : null}

          {!loading && highBounties.length > 0 ? (
            <section className="mobile-feed-section bounty-mobile-featured-section">
              <div className="mobile-feed-section-head">
                <h2>High bounty</h2>
                <span>{highBounties.length}</span>
              </div>
              <div className="market-rail-grid bounty-rail-grid">
                {renderCards(highBounties)}
              </div>
            </section>
          ) : null}

          {!loading ? (
            <section className="mobile-feed-section bounty-mobile-feed-section">
              <div className="mobile-feed-section-head">
                <h2>Open bounties</h2>
                <span>{bounties.length}</span>
              </div>
              {bounties.length === 0 ? (
                <EmptyStateCard
                  title={mineOnly && !isSignedIn ? "Sign in to view your bounties." : "No bounties match these filters."}
                  description={mineOnly && !isSignedIn
                    ? "Authentication is required to load your bounty activity."
                    : "Try a wider budget, another category, or post the first bounty."}
                  action={<PrimaryButton href="/bounties/new">Post bounty</PrimaryButton>}
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
            {STATUS_OPTIONS.map((option) => (
              <FilterChip
                key={option.value}
                label={option.label}
                active={status === option.value}
                onClick={() => setStatus(option.value)}
              />
            ))}
            <FilterChip label="Mine" active={mineOnly} onClick={() => setMineOnly((prev) => !prev)} />
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
              <span>Grade</span>
              <select value={grade} onChange={(event) => setGrade(event.target.value as GradeFilter)} className="app-select">
                {GRADE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="app-select-wrap app-select-inline">
              <span>Budget</span>
              <select value={budget} onChange={(event) => setBudget(event.target.value as BudgetFilter)} className="app-select">
                {BUDGET_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
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
        {loading ? <CheckersLoader title="Loading bounties..." compact className="ios-empty" /> : null}

        {!loading && featuredBounties.length > 0 ? (
          <section className="listing-system-feed bounty-featured-section">
            <SectionHeader
              title="Featured bounties"
              subtitle="High-signal requests collectors are actively chasing."
              action={<span className="market-count">{featuredBounties.length} posted</span>}
            />
            <div className="market-rail-grid bounty-rail-grid">
              {renderCards(featuredBounties)}
            </div>
          </section>
        ) : null}

        {!loading && highBounties.length > 0 ? (
          <section className="listing-system-feed bounty-featured-section">
            <SectionHeader
              title="High bounty"
              subtitle="Requests with the strongest finder incentive."
              action={<span className="market-count">{highBounties.length} active</span>}
            />
            <div className="market-rail-grid bounty-rail-grid">
              {renderCards(highBounties)}
            </div>
          </section>
        ) : null}

        {!loading && recentBounties.length > 0 ? (
          <section className="listing-system-feed bounty-featured-section">
            <SectionHeader
              title="Recently posted"
              subtitle="New buyer demand hitting the board."
              action={<span className="market-count">{recentBounties.length} recent</span>}
            />
            <div className="market-rail-grid bounty-rail-grid">
              {renderCards(recentBounties)}
            </div>
          </section>
        ) : null}

        <section className="listing-system-feed bounty-feed-section">
          <SectionHeader
            title="Main bounty feed"
            subtitle="Open demand ready for sellers, finders, and matching inventory."
            action={<span className="market-count">{bounties.length} open</span>}
          />
          {!loading && bounties.length === 0 ? (
            <EmptyStateCard
              title={mineOnly && !isSignedIn ? "Sign in to view your bounties." : "No bounties match these filters."}
              description={mineOnly && !isSignedIn
                ? "Authentication is required to load your bounty activity."
                : "Try a wider budget, another category, or post the first bounty."}
              action={<PrimaryButton href="/bounties/new">Post bounty</PrimaryButton>}
            />
          ) : null}
          <div className={`market-v2-grid bounty-board-grid ${bounties.length > 0 && bounties.length < 3 ? "is-sparse" : ""}`}>
            {renderCards(bounties)}
          </div>
        </section>

        <div className="bounty-board-cta">
          <PrimaryButton href="/bounties/new">Post bounty</PrimaryButton>
        </div>
      </section>
    </PageContainer>
  );
}
