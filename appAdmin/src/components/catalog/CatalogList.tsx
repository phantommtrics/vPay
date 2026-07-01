import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { StatusBadge } from '../StatusBadge';
import { EmptyState } from '../ui/EmptyState';

export type CatalogListItem = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  meta?: string;
};

type CatalogListProps = {
  items: CatalogListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchPlaceholder?: string;
  emptyTitle: string;
  emptyDescription: string;
  countLabel?: string;
};

export function CatalogList({
  items,
  selectedId,
  onSelect,
  searchPlaceholder = 'Search…',
  emptyTitle,
  emptyDescription,
  countLabel = 'item',
}: CatalogListProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.meta?.toLowerCase().includes(q),
    );
  }, [items, query]);

  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="flex h-full min-h-[320px] flex-col">
      <div className="border-b border-[var(--color-border)] p-3">
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-[var(--color-border)] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          {filtered.length} of {items.length} {countLabel}
          {filtered.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-[var(--color-text-muted)]">No matches.</p>
        ) : (
          <ul className="space-y-1.5">
            {filtered.map((item) => {
              const selected = item.id === selectedId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                      selected
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] shadow-sm'
                        : 'border-transparent bg-white hover:border-[var(--color-border)] hover:bg-[var(--color-canvas-subtle)]'
                    }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-[var(--color-heading)]">{item.title}</p>
                        <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">{item.subtitle}</p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                    {item.meta ? (
                      <p className="mt-2 inline-flex rounded-md bg-[var(--color-canvas-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-muted)]">
                        {item.meta}
                      </p>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
