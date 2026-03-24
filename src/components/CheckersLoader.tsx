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
  if (compact) {
    return (
      <div className={`dalow-loader dalow-loader-compact${className ? ` ${className}` : ""}`} role="status" aria-label={title}>
        <div className="dalow-loader-dots" aria-hidden="true">
          <span /><span /><span />
        </div>
        <p className="dalow-loader-label">{title}</p>
      </div>
    );
  }

  return (
    <div className={`dalow-loader dalow-loader-full${className ? ` ${className}` : ""}`} role="status" aria-label={title}>
      <div className="dalow-loader-ring" aria-hidden="true">
        <span />
      </div>
      <p className="dalow-loader-label">{title}</p>
    </div>
  );
}
