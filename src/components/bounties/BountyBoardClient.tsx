"use client";

import { useEffect, useState } from "react";
import { CheckersLoader } from "@/components/CheckersLoader";
import {
  DiscoveryBar,
  EmptyStateCard,
  PageContainer,
  PageHeader,
  PrimaryButton,
  SearchIcon,
} from "@/components/product/ProductUI";
import { useMobileUi } from "@/hooks/useMobileUi";
import { useSavedListings } from "@/hooks/useSavedListings";
import { type BountyRequestListItem } from "@/lib/bounties";
import { formatCurrency } from "@/lib/format";

type SortMode = "newest" | "highest-bounty" | "highest-budget" | "most-specific" | "recently-active";

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "highest-bounty", label: "Highest bounty" },
  { value: "highest-budget", label: "Highest budget" },
  { value: "most-specific", label: "Most specific" },
  { value: "recently-active", label: "Recently active" },
];

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  MATCHED: "Matched",
  FULFILLED: "Fulfilled",
  EXPIRED: "Expired",
  PAUSED: "Paused",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function BountyCard({
  bounty,
  saved,
  onToggleSave,
}: {
  bounty: BountyRequestListItem;
  saved: boolean;
  onToggleSave: (id: string) => void;
}) {
  const budgetParts: string[] = [];
  if (bounty.priceMin != null && bounty.priceMax != null) {
    budgetParts.push(`${formatCurrency(bounty.priceMin)} – ${formatCurrency(bounty.priceMax)}`);
  } else if (bounty.priceMax != null) {
    budgetParts.push(`Up to ${formatCurrency(bounty.priceMax)}`);
  } else if (bounty.priceMin != null) {
    budgetParts.push(`From ${formatCurrency(bounty.priceMin)}`);
  }

  const specs: string[] = [];
  if (bounty.player) specs.push(bounty.player);
  if (bounty.setName) specs.push(bounty.setName);
  if (bounty.year) specs.push(bounty.year);
  if (bounty.gradeCompany && bounty.grade) specs.push(`${bounty.gradeCompany} ${bounty.grade}`);
  else if (bounty.grade) specs.push(`Grade ${bounty.grade}`);
  if (bounty.certNumber) specs.push(`#${bounty.certNumber}`);

  const poster = bounty.user.displayName || bounty.user.username || "Anonymous";

  return (
    <article className={`bounty-text-card status-${bounty.status.toLowerCase()}`}>
      <div className="bounty-text-card-top">
        <div className="bounty-text-card-title-row">
          <h3 className="bounty-text-card-title">{bounty.itemName || bounty.title}</h3>
          <span className={`bounty-text-card-status bounty-status-${bounty.status.toLowerCase()}`}>
            {STATUS_LABELS[bounty.status] ?? bounty.status}
          </span>
        </div>
        {specs.length > 0 && (
          <p className="bounty-text-card-specs">{specs.join(" · ")}</p>
        )}
      </div>

      <div className="bounty-text-card-pricing">
        {budgetParts.length > 0 && (
          <div className="bounty-text-card-price-item">
            <span className="bounty-text-card-price-label">Budget</span>
            <strong className="bounty-text-card-price-value">{budgetParts[0]}</strong>
          </div>
        )}
        {bounty.bountyAmount != null && (
          <div className="bounty-text-card-price-item bounty-text-card-bounty">
            <span className="bounty-text-card-price-label">Finder&rsquo;s fee</span>
            <strong className="bounty-text-card-price-value">{formatCurrency(bounty.bountyAmount)}</strong>
          </div>
        )}
      </div>

      {bounty.notes && (
        <p className="bounty-text-card-notes">{bounty.notes}</p>
      )}

      <div className="bounty-text-card-foot">
        <span className="bounty-text-card-poster">@{poster}</span>
        <span className="bounty-text-card-time">{timeAgo(bounty.createdAt)}</span>
        <button
          className={`bounty-text-card-save ${saved ? "is-saved" : ""}`}
          onClick={() => onToggleSave(bounty.id)}
          aria-label={saved ? "Remove from saved" : "Save bounty"}
          type="button"
        >
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </article>
  );
}

type BountyBoardClientProps = {
  initialIsMobile?: boolean;
};

export function BountyBoardClient({ initialIsMobile }: BountyBoardClientProps) {
  const isMobileUi = useMobileUi(initialIsMobile);
  const { bountyRequestIds, toggleBountySave } = useSavedListings();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bounties, setBounties] = useState<BountyRequestListItem[]>([]);

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
  }, [query, sort]);

  const renderCards = (items: BountyRequestListItem[]) =>
    items.map((bounty) => (
      <BountyCard
        key={bounty.id}
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
            <section className="mobile-feed-section bounty-mobile-feed-section">
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
                <div className="bounty-text-list">
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

        {!loading && bounties.length === 0 ? (
          <EmptyStateCard
            title="No bounties match these filters."
            description="Try a broader search or another category."
          />
        ) : null}

        {!loading && bounties.length > 0 ? (
          <div className="bounty-text-list">
            {renderCards(bounties)}
          </div>
        ) : null}
      </section>
    </PageContainer>
  );
}
