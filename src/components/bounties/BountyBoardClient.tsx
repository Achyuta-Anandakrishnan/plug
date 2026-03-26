"use client";

import Image from "next/image";
import Link from "next/link";
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

function validImage(url: string | null | undefined): string {
  if (!url) return "/placeholders/pokemon-generic.svg";
  if (url.startsWith("/")) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return "/placeholders/pokemon-generic.svg";
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
  const href = `/bounties/${bounty.id}`;
  const imageUrl = validImage(bounty.imageUrl);

  const budgetLabel = bounty.priceMin != null && bounty.priceMax != null
    ? bounty.priceMin === bounty.priceMax
      ? formatCurrency(bounty.priceMin)
      : `${formatCurrency(bounty.priceMin)} – ${formatCurrency(bounty.priceMax)}`
    : bounty.priceMax != null
    ? `Up to ${formatCurrency(bounty.priceMax)}`
    : bounty.priceMin != null
    ? `From ${formatCurrency(bounty.priceMin)}`
    : null;

  const specs: string[] = [];
  if (bounty.category) specs.push(bounty.category);
  if (bounty.player) specs.push(bounty.player);
  if (bounty.setName) specs.push(bounty.setName);
  if (bounty.year) specs.push(bounty.year);
  if (bounty.gradeCompany && bounty.grade) specs.push(`${bounty.gradeCompany} ${bounty.grade}`);
  else if (bounty.grade) specs.push(`Grade ${bounty.grade}`);
  if (bounty.certNumber) specs.push(`#${bounty.certNumber}`);

  const poster = bounty.user.displayName || bounty.user.username || "Anonymous";

  return (
    <article className={`bounty-row-card status-${bounty.status.toLowerCase()}`}>
      {/* Full-card link overlay — sits behind interactive elements */}
      <Link href={href} className="bounty-row-card-overlay" tabIndex={-1} aria-hidden="true" />

      <div className="bounty-row-image">
        <Image
          src={imageUrl}
          alt={bounty.itemName || bounty.title}
          fill
          sizes="80px"
          className="object-cover"
          unoptimized
        />
      </div>

      <div className="bounty-row-body">
        <div className="bounty-row-header">
          <h3 className="bounty-row-title">
            <Link href={href} className="bounty-row-title-link">
              {bounty.itemName || bounty.title}
            </Link>
          </h3>
          <span className={`bounty-row-status-badge bounty-status-${bounty.status.toLowerCase()}`}>
            {STATUS_LABELS[bounty.status] ?? bounty.status}
          </span>
        </div>

        {specs.length > 0 && (
          <p className="bounty-row-meta">{specs.join(" · ")}</p>
        )}

        {bounty.notes && (
          <p className="bounty-row-notes">{bounty.notes}</p>
        )}

        <div className="bounty-row-foot">
          <div className="bounty-row-byline">
            <span className="bounty-row-poster">@{poster}</span>
            <span className="bounty-row-time">{timeAgo(bounty.createdAt)}</span>
          </div>
          <div className="bounty-row-actions">
            <Link
              href={href}
              className="bounty-row-fulfill-btn"
            >
              Fulfill bounty
            </Link>
            <button
              className={`bounty-row-save-btn ${saved ? "is-saved" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSave(bounty.id);
              }}
              type="button"
              aria-label={saved ? "Remove from saved" : "Save bounty"}
            >
              {saved ? "Saved" : "Save"}
            </button>
          </div>
        </div>
      </div>

      <div className="bounty-row-pricing">
        {budgetLabel && (
          <div className="bounty-row-price-block">
            <span className="bounty-row-price-label">Budget</span>
            <strong className="bounty-row-price-value">{budgetLabel}</strong>
          </div>
        )}
        {bounty.bountyAmount != null && bounty.bountyAmount > 0 && (
          <div className="bounty-row-price-block">
            <span className="bounty-row-price-label">Finder&rsquo;s fee</span>
            <strong className="bounty-row-price-value is-fee">{formatCurrency(bounty.bountyAmount)}</strong>
          </div>
        )}
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
                <div className="bounty-row-list">
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
            description="Try a broader search."
          />
        ) : null}

        {!loading && bounties.length > 0 ? (
          <div className="bounty-row-list">
            {renderCards(bounties)}
          </div>
        ) : null}
      </section>
    </PageContainer>
  );
}
