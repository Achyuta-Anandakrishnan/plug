import Link from "next/link";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
};

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  eyebrow?: string;
  className?: string;
};

type DiscoveryBarProps = {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLElement>;

type FilterChipProps = {
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
};

type SegmentedControlProps<T extends string> = {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

type ProductButtonProps = {
  children: ReactNode;
  href?: string;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

type EmptyStateCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

type StatPillProps = {
  label: string;
  value: ReactNode;
  className?: string;
};

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function ProductButton({
  children,
  href,
  className,
  type = "button",
  variant,
  ...buttonProps
}: ProductButtonProps & { variant: "primary" | "secondary" }) {
  const classes = classNames(
    "app-button",
    variant === "primary" ? "app-button-primary" : "app-button-secondary",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} {...buttonProps}>
      {children}
    </button>
  );
}

export function PageContainer({ children, className }: PageContainerProps) {
  return <div className={classNames("site-shell", "app-page", className)}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <section className={classNames("app-page-header", className)}>
      <div className="app-page-header-copy">
        {eyebrow ? <p className="app-eyebrow">{eyebrow}</p> : null}
        <h1 className="app-page-title">{title}</h1>
        {subtitle ? <p className="app-page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="app-page-header-actions">{actions}</div> : null}
    </section>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
  eyebrow,
  className,
}: SectionHeaderProps) {
  return (
    <div className={classNames("app-section-header", className)}>
      <div className="app-section-header-copy">
        {eyebrow ? <p className="app-eyebrow">{eyebrow}</p> : null}
        <h2 className="app-section-title">{title}</h2>
        {subtitle ? <p className="app-section-subtitle">{subtitle}</p> : null}
      </div>
      {action ? <div className="app-section-header-action">{action}</div> : null}
    </div>
  );
}

export function DiscoveryBar({ children, className, ...props }: DiscoveryBarProps) {
  return <section className={classNames("app-discovery-bar", className)} {...props}>{children}</section>;
}

export function FilterChip({ label, active = false, onClick, className }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames("app-chip", active && "is-active", className)}
    >
      {label}
    </button>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={classNames("app-segment", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={classNames(value === option.value && "is-active")}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function PrimaryButton(props: ProductButtonProps) {
  return <ProductButton variant="primary" {...props} />;
}

export function SecondaryButton(props: ProductButtonProps) {
  return <ProductButton variant="secondary" {...props} />;
}

export function EmptyStateCard({
  title,
  description,
  action,
  className,
}: EmptyStateCardProps) {
  return (
    <div className={classNames("app-empty-state", className)}>
      <div className="app-empty-state-copy">
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="app-empty-state-action">{action}</div> : null}
    </div>
  );
}

export function StatPill({ label, value, className }: StatPillProps) {
  return (
    <article className={classNames("app-stat-pill", className)}>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}
