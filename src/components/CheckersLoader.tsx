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
    <div className="dalow-loader-board" aria-hidden="true">
      {Array.from({ length: 16 }).map((_, index) => (
        <span key={index} className={index % 2 === 0 ? "is-dark" : "is-light"} />
      ))}
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
      <p className="dalow-loader-label">{title}</p>
    </div>
  );
}
