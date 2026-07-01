import type { ReactNode } from 'react';

type MetricCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  href?: string;
  onClick?: () => void;
};

export function MetricCard({ label, value, hint, href, onClick }: MetricCardProps) {
  const inner = (
    <>
      <p className="metric-label">{label}</p>
      <p className="metric-value mt-1">{value}</p>
      {hint ? <p className="mt-2 text-xs text-[var(--color-text-muted)]">{hint}</p> : null}
    </>
  );

  const className =
    'panel block p-5 transition hover:border-[var(--color-border-strong)] hover:shadow-sm';

  if (href) {
    return (
      <a href={href} className={className}>
        {inner}
      </a>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${className} w-full text-left`}>
        {inner}
      </button>
    );
  }

  return <div className={className}>{inner}</div>;
}
