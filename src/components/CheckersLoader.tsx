import type { CSSProperties } from "react";

type CheckersLoaderProps = {
  title?: string;
  compact?: boolean;
  className?: string;
};

export function CheckersLoader({
  title = "Loading",
  compact = false,
  className,
}: CheckersLoaderProps) {
  const checker = (
    <div className="dalow-loader-board-shell" aria-hidden="true">
      <div className="dalow-loader-board">
        {Array.from({ length: 16 }).map((_, index) => {
          const row = Math.floor(index / 4);
          const column = index % 4;
          const isDark = (row + column) % 2 === 0;
          return (
            <span
              key={index}
              className={isDark ? "is-dark" : "is-light"}
              style={{ "--loader-delay": `${(row + column) * 0.08}s` } as CSSProperties}
            />
          );
        })}
      </div>
    </div>
  );

  if (compact) {
    return (
      <div className={`dalow-loader dalow-loader-compact${className ? ` ${className}` : ""}`} role="status" aria-label={title}>
        {checker}
        <p className="dalow-loader-label">{title}</p>
      </div>
    );
  }

  return (
    <div className={`dalow-loader dalow-loader-full${className ? ` ${className}` : ""}`} role="status" aria-label={title}>
      {checker}
    </div>
  );
}
