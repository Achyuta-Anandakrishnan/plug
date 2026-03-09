export function AnimeBackdrop() {
  return (
    <div aria-hidden="true" className="anime-layer">
      <div className="anime-card anime-card-a">
        <svg viewBox="0 0 220 120" className="anime-graph">
          <path d="M8 98 L52 80 L92 84 L132 58 L172 48 L212 22" />
          <path d="M8 110 L56 92 L100 94 L144 72 L188 66 L212 54" />
        </svg>
      </div>
      <div className="anime-card anime-card-b">
        <svg viewBox="0 0 220 120" className="anime-bars">
          <rect x="22" y="72" width="22" height="30" rx="6" />
          <rect x="58" y="56" width="22" height="46" rx="6" />
          <rect x="94" y="42" width="22" height="60" rx="6" />
          <rect x="130" y="22" width="22" height="80" rx="6" />
          <rect x="166" y="50" width="22" height="52" rx="6" />
        </svg>
      </div>
      <div className="anime-card anime-card-c" />
    </div>
  );
}
