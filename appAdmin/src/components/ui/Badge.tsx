const variants: Record<string, string> = {
  pending: 'bg-[#fef6e8] text-[#9a6700] border-[#f5e6c4]',
  approved: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[#a7f3d0]',
  active: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[#a7f3d0]',
  paid: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[#a7f3d0]',
  completed: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[#a7f3d0]',
  balanced: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[#a7f3d0]',
  rejected: 'bg-[#fff5f7] text-[#df1b41] border-[#fcd5df]',
  failed: 'bg-[#fff5f7] text-[#df1b41] border-[#fcd5df]',
  blocked: 'bg-[#fff5f7] text-[#df1b41] border-[#fcd5df]',
  unbalanced: 'bg-[#fff5f7] text-[#df1b41] border-[#fcd5df]',
  cancelled: 'bg-[#f6f9fc] text-[var(--color-text-muted)] border-[var(--color-border)]',
  terminated: 'bg-[#f6f9fc] text-[var(--color-text-muted)] border-[var(--color-border)]',
  incomplete: 'bg-[#f6f9fc] text-[var(--color-text-muted)] border-[var(--color-border)]',
  none: 'bg-[#f6f9fc] text-[var(--color-text-muted)] border-[var(--color-border)]',
  inactive: 'bg-[#f6f9fc] text-[var(--color-text-muted)] border-[var(--color-border)]',
  deposit: 'bg-[#e8f4fd] text-[#0055bc] border-[#b8d9f5]',
  card_fund: 'bg-[#f3e8ff] text-[#6b21a8] border-[#e9d5ff]',
  card_issuance: 'bg-[#fef6e8] text-[#9a6700] border-[#f5e6c4]',
  adjustment: 'bg-[#f6f9fc] text-[var(--color-text-muted)] border-[var(--color-border)]',
  sent: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[#a7f3d0]',
  skipped: 'bg-[#f6f9fc] text-[var(--color-text-muted)] border-[var(--color-border)]',
};

type BadgeProps = {
  status: string;
  dot?: boolean;
};

export function Badge({ status, dot }: BadgeProps) {
  const key = status.toLowerCase().replace(/\s+/g, '_');
  const style = variants[key] ?? variants.none;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${style}`}>
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" /> : null}
      {key.replace(/_/g, ' ')}
    </span>
  );
}
