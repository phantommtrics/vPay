export function formatCatalogEnum(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const catalogInputClass =
  'w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-accent)] disabled:cursor-default disabled:border-transparent disabled:bg-[var(--color-canvas-subtle)] disabled:px-0 disabled:text-[var(--color-heading)]';

export const catalogLabelClass = 'mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]';

export function formsEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function toDateInput(value: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

export function formatDisplayDate(value: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
