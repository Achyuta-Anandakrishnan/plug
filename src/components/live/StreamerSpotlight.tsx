import Link from "next/link";
import type { SpotlightHost } from "@/components/live/types";

type StreamerSpotlightProps = {
  hosts: SpotlightHost[];
};

export function StreamerSpotlight({ hosts }: StreamerSpotlightProps) {
  return (
    <section className="live-v3-spotlight">
      <div className="live-v3-section-head">
        <div>
          <p>Hosts to watch</p>
          <h2>Trending streamers</h2>
        </div>
      </div>

      {hosts.length === 0 ? (
        <div className="live-v3-empty">No host highlights yet.</div>
      ) : (
        <div className="live-v3-spotlight-grid">
          {hosts.map((host) => (
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
