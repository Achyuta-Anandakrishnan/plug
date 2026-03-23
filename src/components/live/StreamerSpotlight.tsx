import Link from "next/link";
import type { SpotlightHost } from "@/components/live/types";
import { EmptyStateCard, SectionHeader } from "@/components/product/ProductUI";

type StreamerSpotlightProps = {
  hosts: SpotlightHost[];
  followedIds?: Set<string>;
  followerCounts?: Record<string, number>;
  onToggleFollow?: (hostId: string) => void | Promise<boolean>;
  compact?: boolean;
};

export function StreamerSpotlight({
  hosts,
  followedIds,
  followerCounts,
  onToggleFollow,
  compact = false,
}: StreamerSpotlightProps) {
  const visibleHosts = hosts.slice(0, 6);

  return (
    <section className={`live-v3-spotlight ${compact ? "is-mobile" : ""}`}>
      {compact ? (
        <div className="mobile-feed-section-head">
          <h2>Hosts to watch</h2>
          <span>{visibleHosts.length}</span>
        </div>
      ) : (
        <SectionHeader
          title="Hosts to watch"
          action={<span className="market-count">{visibleHosts.length} hosts</span>}
        />
      )}

      {visibleHosts.length === 0 ? (
        <EmptyStateCard
          title={compact ? "No host activity yet." : "No host highlights yet."}
          description={compact ? "Host activity will appear here as rooms go live." : "Once host activity picks up, featured collectors will appear here."}
        />
      ) : (
        <div className="live-v3-spotlight-grid">
          {visibleHosts.map((host) => (
            <article key={host.id} className="live-v3-host-card">
              <div className="live-v3-host-avatar" aria-hidden="true">
                {host.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="live-v3-host-copy">
                <h3>{host.name}</h3>
                <p>{host.specialty}</p>
                <div>
                  <span>{(followerCounts?.[host.id] ?? host.followers).toLocaleString()} followers</span>
                  <span>{host.isLive ? "Live now" : host.nextStreamAt ?? "Schedule pending"}</span>
                </div>
              </div>
              <div className="live-v3-host-actions">
                <Link href={host.streamHref}>Watch</Link>
                {host.followable ? (
                  <button
                    type="button"
                    onClick={() => void onToggleFollow?.(host.id)}
                  >
                    {followedIds?.has(host.id) ? "Following" : "Follow"}
                  </button>
                ) : null}
                <Link href={host.profileHref}>Profile</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
