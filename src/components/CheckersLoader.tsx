type CheckersLoaderProps = {
  title?: string;
  compact?: boolean;
  className?: string;
};

function Board({ compact }: { compact?: boolean }) {
  return (
    <div className={`checkers-board ${compact ? "checkers-board-compact" : "checkers-board-full"}`}>
      <div className="checkers-grid" aria-hidden="true">
        {Array.from({ length: 64 }).map((_, index) => {
          const row = Math.floor(index / 8);
          const col = index % 8;
          const dark = (row + col) % 2 === 1;
          return <span key={index} className={dark ? "checkers-cell-dark" : "checkers-cell-light"} />;
        })}
      </div>
      <span className="checkers-piece checkers-piece-light checkers-piece-a" aria-hidden="true" />
      <span className="checkers-piece checkers-piece-dark checkers-piece-b" aria-hidden="true" />
    </div>
  );
}

export function CheckersLoader({
  title = "Loading",
  compact = false,
  className,
}: CheckersLoaderProps) {
  if (compact) {
    return (
      <div className={`checkers-loader checkers-loader-compact ${className ?? ""}`.trim()}>
        <Board compact />
        <p className="text-sm text-slate-600">{title}</p>
      </div>
    );
  }

  return (
    <div className={`checkers-loader ${className ?? ""}`.trim()}>
      <Board />
      <p className="font-display text-2xl text-slate-900">{title}</p>
    </div>
  );
}
