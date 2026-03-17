import Link from "next/link";
import type { SpotlightHost } from "@/components/live/types";
import { EmptyStateCard, SectionHeader } from "@/components/product/ProductUI";

type StreamerSpotlightProps = {
  hosts: SpotlightHost[];
};

export function StreamerSpotlight({ hosts }: StreamerSpotlightProps) {
  const visibleHosts = hosts.slice(0, 6);

  return (
    <section className="live-v3-spotlight">
      <SectionHeader
        title="Hosts to watch"
        subtitle="Follow reliable rooms and repeat sellers."
        action={<span className="market-count">{visibleHosts.length} hosts</span>}
      />

      {visibleHosts.length === 0 ? (
        <EmptyStateCard title="No host highlights yet." description="Once host activity picks up, featured collectors will appear here." />
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
                  <span>{host.followers.toLocaleString()} followers</span>
                  <span>{host.isLive ? "Live now" : host.nextStreamAt ?? "Schedule pending"}</span>
                </div>
              </div>
              <div className="live-v3-host-actions">
                <Link href={host.streamHref}>Watch</Link>
                <Link href={host.profileHref}>Profile</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
