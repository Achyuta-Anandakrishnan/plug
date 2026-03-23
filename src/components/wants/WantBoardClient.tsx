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
import { wantBudgetValue, type WantRequestListItem } from "@/lib/wants";

type GradeFilter = "all" | "raw" | "psa" | "bgs" | "cgc" | "high-grade";
type BudgetFilter = "all" | "under-500" | "500-2500" | "2500-10000" | "10000-plus";
type SortMode = "newest" | "highest-budget" | "most-specific" | "recently-active";

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
  { value: "highest-budget", label: "Highest budget" },
  { value: "most-specific", label: "Most specific" },
  { value: "recently-active", label: "Recently active" },
];

export function WantBoardClient() {
  const isMobileUi = useMobileUi();
  const { data: categories } = useCategories();
  const { wantRequestIds, toggleWantSave } = useSavedListings();

  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [grade, setGrade] = useState<GradeFilter>("all");
  const [budget, setBudget] = useState<BudgetFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [wants, setWants] = useState<WantRequestListItem[]>([]);

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
        if (grade !== "all") params.set("grade", grade);
        if (budget !== "all") params.set("budget", budget);
        const response = await fetch(`/api/wants?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as WantRequestListItem[] & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Unable to load want board.");
        }
        if (!cancelled) {
          setWants(payload);
          setLoading(false);
        }
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load want board.");
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
  }, [budget, grade, query, selectedCategory, sort]);

  const featuredWants = useMemo(
    () => [...wants].sort((a, b) => wantBudgetValue(b) - wantBudgetValue(a)).slice(0, 6),
    [wants],
  );

  return (
    <PageContainer className="want-page listing-system-page app-page--wants">
      <section className="app-section want-board-page">
        {isMobileUi ? (
          <section className="mobile-page-toolbar want-mobile-toolbar" aria-label="Want board controls">
            <div className="mobile-page-toolbar-top">
              <div>
                <div className="app-control-title">Want Board</div>
                <p className="want-toolbar-note">Collectors posting what they want to buy right now.</p>
              </div>
              <PrimaryButton href="/wants/new" className="want-mobile-create">Post Want</PrimaryButton>
            </div>
            <div className="app-search">
              <SearchIcon />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search items, grades, certs"
              />
            </div>
            <div className="app-chip-row mobile-page-toolbar-scroll">
              {categoryFilters.map((category) => (
                <FilterChip
                  key={category.id}
                  label={category.label}
                  active={selectedCategory === category.slug}
                  onClick={() => setSelectedCategory(selectedCategory === category.slug ? "" : category.slug)}
                />
              ))}
            </div>
            <div className="want-mobile-selects">
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
        ) : (
          <>
            <PageHeader
              title="Want Board"
              subtitle="Collectors posting what they want to buy right now."
              actions={<PrimaryButton href="/wants/new">Post Want</PrimaryButton>}
            />
            <DiscoveryBar className="app-control-bar listing-system-toolbar want-toolbar">
              <div className="app-search want-toolbar-search">
                <SearchIcon />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search items, grades, cert numbers"
                />
              </div>
              <div className="app-chip-row want-toolbar-categories">
                {categoryFilters.map((category) => (
                  <FilterChip
                    key={category.id}
                    label={category.label}
                    active={selectedCategory === category.slug}
                    onClick={() => setSelectedCategory(selectedCategory === category.slug ? "" : category.slug)}
                  />
                ))}
              </div>
              <div className="listing-system-toolbar-meta want-toolbar-meta">
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
          </>
        )}

        {error ? <EmptyStateCard title="Want Board unavailable" description={error} /> : null}
        {loading ? <CheckersLoader title="Loading wants..." compact className="ios-empty" /> : null}

        {!loading && featuredWants.length > 0 ? (
          <section className="listing-system-feed want-featured-section">
            <SectionHeader
              title="High budget wants"
              subtitle="Collectors signaling serious demand."
              action={isMobileUi ? null : <span className="market-count">{featuredWants.length} wants</span>}
            />
            <div className="market-rail-grid want-rail-grid">
              {featuredWants.map((want) => (
                <ListingCard
                  key={want.id}
                  kind="want"
                  want={want}
                  saved={wantRequestIds.has(want.id)}
                  onToggleSave={toggleWantSave}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section className="listing-system-feed want-feed-section">
          <SectionHeader
            title="Active wants"
            subtitle="Demand-side inventory from collectors ready to buy."
            action={isMobileUi ? null : <span className="market-count">{wants.length} wants</span>}
          />
          {!loading && wants.length === 0 ? (
            <EmptyStateCard
              title="No wants match these filters."
              description="Try another category, widen the budget, or post the first request."
              action={<PrimaryButton href="/wants/new">Post Want</PrimaryButton>}
            />
          ) : null}

          <div className={`market-v2-grid want-board-grid ${wants.length > 0 && wants.length < 3 ? "is-sparse" : ""}`}>
            {wants.map((want) => (
              <ListingCard
                key={want.id}
                kind="want"
                want={want}
                saved={wantRequestIds.has(want.id)}
                onToggleSave={toggleWantSave}
              />
            ))}
          </div>
        </section>

        <div className="want-board-cta">
          <PrimaryButton href="/wants/new">Post Want</PrimaryButton>
        </div>
      </section>
    </PageContainer>
  );
}
