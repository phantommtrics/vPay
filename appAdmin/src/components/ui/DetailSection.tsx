type DetailRowProps = {
  label: string;
  value: React.ReactNode;
};

export function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm border-b border-[var(--color-border)] last:border-0">
      <dt className="text-[var(--color-text-muted)] shrink-0">{label}</dt>
      <dd className="text-right font-medium text-[var(--color-heading)]">{value}</dd>
    </div>
  );
}

export function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3 className="text-sm font-semibold text-[var(--color-heading)]">{title}</h3>
      </div>
      <dl className="panel-body divide-y divide-[var(--color-border)]">{children}</dl>
    </section>
  );
}
