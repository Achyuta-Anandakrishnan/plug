"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  PageContainer,
  PageHeader,
  EmptyStateCard,
  PrimaryButton,
} from "@/components/product/ProductUI";
import { CheckersLoader } from "@/components/CheckersLoader";
import { fetchClientApi } from "@/lib/client-api";
import { formatCurrency } from "@/lib/format";

type Tab = "listings" | "trades" | "bounties" | "bids";

// Auction / listing shape
type AuctionItem = {
  id: string;
  title: string;
  status: string;
  listingType: string;
  currentBid: number;
  buyNowPrice: number | null;
  startingBid: number;
  currency: string;
  createdAt: string;
  endTime: string | null;
};

// Trade shape
type TradeItem = {
  id: string;
  title?: string | null;
  status: string;
  createdAt: string;
  item?: { title?: string | null } | null;
};

// Bounty / WantRequest shape
type BountyItem = {
  id: string;
  title: string;
  itemName: string;
  status: string;
  priceMin: number | null;
  priceMax: number | null;
  bountyAmount: number | null;
  createdAt: string;
};

// Order / bid shape
type OrderItem = {
  id: string;
  auctionId: string;
  status: string;
  amount: number;
  currency: string;
  createdAt: string;
  auction?: { title?: string | null } | null;
};

function statusClass(status: string) {
  const s = status.toLowerCase();
  if (s === "live") return "my-listings-item-status is-live";
  if (s === "draft") return "my-listings-item-status is-draft";
  if (s === "open") return "my-listings-item-status is-open";
  if (s === "scheduled") return "my-listings-item-status is-scheduled";
  if (s === "ended" || s === "expired" || s === "canceled") return "my-listings-item-status is-closed";
  if (s === "matched" || s === "fulfilled") return "my-listings-item-status is-matched";
  if (s === "paused") return "my-listings-item-status is-draft";
  return "my-listings-item-status";
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString();
}

// --- Listings tab ---

function ListingsTab() {
  const [items, setItems] = useState<AuctionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [liveRes, draftRes, scheduledRes] = await Promise.all([
          fetchClientApi("/api/auctions?mine=1&status=LIVE&limit=50"),
          fetchClientApi("/api/auctions?mine=1&status=DRAFT&limit=50"),
          fetchClientApi("/api/auctions?mine=1&status=SCHEDULED&limit=50"),
        ]);
        const [liveData, draftData, scheduledData] = await Promise.all([
          liveRes.json(),
          draftRes.json(),
          scheduledRes.json(),
        ]);
        const combined: AuctionItem[] = [
          ...(Array.isArray(liveData) ? liveData : liveData.data ?? []),
          ...(Array.isArray(draftData) ? draftData : draftData.data ?? []),
          ...(Array.isArray(scheduledData) ? scheduledData : scheduledData.data ?? []),
        ];
        combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setItems(combined);
      } catch {
        setError("Failed to load listings.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Cancel this listing? This cannot be undone.")) return;
    setDeleteErrors((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetchClientApi(`/api/auctions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDeleteErrors((prev) => ({
          ...prev,
          [id]: (body as { error?: string }).error ?? "Failed to delete listing.",
        }));
        return;
      }
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch {
      setDeleteErrors((prev) => ({ ...prev, [id]: "Failed to delete listing." }));
    }
  }

  if (loading) return <CheckersLoader />;
  if (error) return <p className="my-listings-error">{error}</p>;
  if (items.length === 0) {
    return (
      <EmptyStateCard
        title="No listings yet"
        description="Your auction and marketplace listings will appear here."
        action={<PrimaryButton href="/sell">+ Create listing</PrimaryButton>}
      />
    );
  }

  return (
    <ul className="my-listings-list">
      {items.map((item) => {
        const price = item.currentBid > 0
          ? formatCurrency(item.currentBid, item.currency?.toUpperCase() ?? "USD")
          : item.buyNowPrice
          ? formatCurrency(item.buyNowPrice, item.currency?.toUpperCase() ?? "USD")
          : formatCurrency(item.startingBid, item.currency?.toUpperCase() ?? "USD");

        return (
          <li key={item.id} className="my-listings-item">
            <div className="my-listings-item-info">
              <Link href={`/auctions/${item.id}`} className="my-listings-item-title">
                {item.title}
              </Link>
              <div className="my-listings-item-meta">
                <span className={statusClass(item.status)}>{item.status}</span>
                <span>{price}</span>
                <span>{formatDate(item.createdAt)}</span>
              </div>
              {deleteErrors[item.id] ? (
                <p className="my-listings-delete-error">{deleteErrors[item.id]}</p>
              ) : null}
            </div>
            <div className="my-listings-item-actions">
              <Link href={`/auctions/${item.id}`} className="app-button app-button-secondary">
                Manage
              </Link>
              <button
                type="button"
                className="my-listings-delete-btn"
                onClick={() => void handleDelete(item.id)}
              >
                Delete
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// --- Trades tab ---

function TradesTab() {
  const [items, setItems] = useState<TradeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchClientApi("/api/trades?mine=1&limit=50");
        const data = await res.json();
        const list: TradeItem[] = Array.isArray(data) ? data : (data.data ?? []);
        setItems(list);
      } catch {
        setError("Failed to load trades.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this trade post? This cannot be undone.")) return;
    setDeleteErrors((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetchClientApi(`/api/trades/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDeleteErrors((prev) => ({
          ...prev,
          [id]: (body as { error?: string }).error ?? "Failed to delete trade.",
        }));
        return;
      }
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch {
      setDeleteErrors((prev) => ({ ...prev, [id]: "Failed to delete trade." }));
    }
  }

  if (loading) return <CheckersLoader />;
  if (error) return <p className="my-listings-error">{error}</p>;
  if (items.length === 0) {
    return (
      <EmptyStateCard
        title="No trades yet"
        description="Trade posts you create will appear here."
        action={<PrimaryButton href="/trades/new">+ New trade</PrimaryButton>}
      />
    );
  }

  return (
    <ul className="my-listings-list">
      {items.map((item) => {
        const label = item.title ?? item.item?.title ?? "Trade post";
        return (
          <li key={item.id} className="my-listings-item">
            <div className="my-listings-item-info">
              <Link href={`/trades/${item.id}`} className="my-listings-item-title">
                {label}
              </Link>
              <div className="my-listings-item-meta">
                <span className={statusClass(item.status)}>{item.status}</span>
                <span>{formatDate(item.createdAt)}</span>
              </div>
              {deleteErrors[item.id] ? (
                <p className="my-listings-delete-error">{deleteErrors[item.id]}</p>
              ) : null}
            </div>
            <div className="my-listings-item-actions">
              <Link href={`/trades/${item.id}`} className="app-button app-button-secondary">
                Manage
              </Link>
              <button
                type="button"
                className="my-listings-delete-btn"
                onClick={() => void handleDelete(item.id)}
              >
                Delete
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// --- Bounties tab ---

function BountiesTab() {
  const [items, setItems] = useState<BountyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [openRes, pausedRes] = await Promise.all([
          fetchClientApi("/api/bounties?mine=1&status=OPEN&limit=50"),
          fetchClientApi("/api/bounties?mine=1&status=PAUSED&limit=50"),
        ]);
        const [openData, pausedData] = await Promise.all([
          openRes.json(),
          pausedRes.json(),
        ]);
        const combined: BountyItem[] = [
          ...(Array.isArray(openData) ? openData : openData.data ?? []),
          ...(Array.isArray(pausedData) ? pausedData : pausedData.data ?? []),
        ];
        combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setItems(combined);
      } catch {
        setError("Failed to load bounties.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Close this bounty? This cannot be undone.")) return;
    setDeleteErrors((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetchClientApi(`/api/bounties/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDeleteErrors((prev) => ({
          ...prev,
          [id]: (body as { error?: string }).error ?? "Failed to delete bounty.",
        }));
        return;
      }
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch {
      setDeleteErrors((prev) => ({ ...prev, [id]: "Failed to delete bounty." }));
    }
  }

  if (loading) return <CheckersLoader />;
  if (error) return <p className="my-listings-error">{error}</p>;
  if (items.length === 0) {
    return (
      <EmptyStateCard
        title="No bounties yet"
        description="Bounty requests you post will appear here."
        action={<PrimaryButton href="/bounties/new">+ Post bounty</PrimaryButton>}
      />
    );
  }

  return (
    <ul className="my-listings-list">
      {items.map((item) => {
        const budget = item.priceMax
          ? formatCurrency(item.priceMax, "USD")
          : item.priceMin
          ? formatCurrency(item.priceMin, "USD")
          : null;

        return (
          <li key={item.id} className="my-listings-item">
            <div className="my-listings-item-info">
              <Link href={`/bounties/${item.id}`} className="my-listings-item-title">
                {item.title || item.itemName}
              </Link>
              <div className="my-listings-item-meta">
                <span className={statusClass(item.status)}>{item.status}</span>
                {budget ? <span>{budget}</span> : null}
                <span>{formatDate(item.createdAt)}</span>
              </div>
              {deleteErrors[item.id] ? (
                <p className="my-listings-delete-error">{deleteErrors[item.id]}</p>
              ) : null}
            </div>
            <div className="my-listings-item-actions">
              <Link href={`/bounties/${item.id}`} className="app-button app-button-secondary">
                Manage
              </Link>
              <button
                type="button"
                className="my-listings-delete-btn"
                onClick={() => void handleDelete(item.id)}
              >
                Close
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// --- Bids / Orders tab ---

function BidsTab() {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchClientApi("/api/orders?limit=50");
        const data = await res.json();
        const list: OrderItem[] = Array.isArray(data) ? data : (data.data ?? []);
        setItems(list);
      } catch {
        setError("Failed to load orders.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) return <CheckersLoader />;
  if (error) return <p className="my-listings-error">{error}</p>;
  if (items.length === 0) {
    return (
      <EmptyStateCard
        title="No bids yet"
        description="Your bids and purchases will appear here."
      />
    );
  }

  return (
    <ul className="my-listings-list">
      {items.map((item) => {
        const title = item.auction?.title ?? `Order #${item.id.slice(0, 8)}`;
        const price = formatCurrency(item.amount, item.currency?.toUpperCase() ?? "USD");
        return (
          <li key={item.id} className="my-listings-item">
            <div className="my-listings-item-info">
              <Link href={`/auctions/${item.auctionId}`} className="my-listings-item-title">
                {title}
              </Link>
              <div className="my-listings-item-meta">
                <span className={statusClass(item.status)}>{item.status}</span>
                <span>{price}</span>
                <span>{formatDate(item.createdAt)}</span>
              </div>
            </div>
            <div className="my-listings-item-actions">
              <Link href={`/auctions/${item.auctionId}`} className="app-button app-button-secondary">
                View
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// --- Main component ---

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "listings", label: "Listings" },
  { key: "trades", label: "Trades" },
  { key: "bounties", label: "Bounties" },
  { key: "bids", label: "Bids" },
];

export function MyListingsClient() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("listings");

  if (status === "loading") {
    return (
      <PageContainer>
        <CheckersLoader />
      </PageContainer>
    );
  }

  if (!session?.user?.id) {
    return (
      <PageContainer>
        <PageHeader title="My listings" subtitle="Manage your posts and activity" />
        <EmptyStateCard
          title="Sign in to view your listings"
          description="You need to be signed in to manage your listings, trades, and bounties."
          action={<PrimaryButton href="/signin">Sign in</PrimaryButton>}
        />
      </PageContainer>
    );
  }

  return (
    <article className="my-listings-page">
      <PageContainer>
        <PageHeader title="My listings" subtitle="Manage your posts and activity" />

        <div className="my-listings-tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`my-listings-tab${activeTab === tab.key ? " is-active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="my-listings-section">
          {activeTab === "listings" && <ListingsTab />}
          {activeTab === "trades" && <TradesTab />}
          {activeTab === "bounties" && <BountiesTab />}
          {activeTab === "bids" && <BidsTab />}
        </div>
      </PageContainer>
    </article>
  );
}
