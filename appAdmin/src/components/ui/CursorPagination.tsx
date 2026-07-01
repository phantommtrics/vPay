import { ChevronLeft, ChevronRight } from 'lucide-react';

type CursorPaginationProps = {
  canGoBack: boolean;
  canGoForward: boolean;
  onPrev: () => void;
  onNext: () => void;
  limit: number;
  onLimitChange: (limit: number) => void;
  itemCount: number;
  loading?: boolean;
};

const PAGE_SIZES = [25, 50, 100] as const;

export function CursorPagination({
  canGoBack,
  canGoForward,
  onPrev,
  onNext,
  limit,
  onLimitChange,
  itemCount,
  loading = false,
}: CursorPaginationProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-canvas-subtle)] px-4 py-3">
      <p className="text-sm text-[var(--color-text-muted)]">
        {loading ? 'Loading…' : `${itemCount} row${itemCount === 1 ? '' : 's'} on this page`}
      </p>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          Rows
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm outline-none focus:border-[var(--color-accent)]"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-medium text-[var(--color-heading)] transition hover:bg-[var(--color-canvas-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canGoBack || loading}
            onClick={onPrev}
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-medium text-[var(--color-heading)] transition hover:bg-[var(--color-canvas-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canGoForward || loading}
            onClick={onNext}
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
