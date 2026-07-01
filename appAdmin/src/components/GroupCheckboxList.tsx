import { Check } from 'lucide-react';

export type GroupCheckboxOption = {
  id: string;
  name: string;
  roleName: string;
  description?: string | null;
  memberCount?: number;
};

type GroupCheckboxListProps = {
  groups: GroupCheckboxOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  emptyMessage?: string;
};

export function GroupCheckboxList({
  groups,
  selectedIds,
  onChange,
  disabled,
  emptyMessage = 'No user groups available. Create one in System config → User groups.',
}: GroupCheckboxListProps) {
  function toggle(id: string) {
    if (disabled) return;
    onChange(
      selectedIds.includes(id) ? selectedIds.filter((groupId) => groupId !== id) : [...selectedIds, id],
    );
  }

  if (groups.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">{emptyMessage}</p>;
  }

  return (
    <div className="max-h-56 space-y-2 overflow-auto pr-1">
      {groups.map((group) => {
        const checked = selectedIds.includes(group.id);
        return (
          <button
            key={group.id}
            type="button"
            disabled={disabled}
            onClick={() => toggle(group.id)}
            className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
              checked
                ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] shadow-sm'
                : 'border-[var(--color-border)] bg-white hover:border-[var(--color-border-strong)] hover:bg-[var(--color-canvas-subtle)]'
            }`}
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                checked
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                  : 'border-[#d1d5db] bg-white'
              }`}
              aria-hidden="true"
            >
              {checked ? <Check size={13} strokeWidth={3} /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[var(--color-heading)]">{group.name}</span>
              <span className="mt-0.5 block text-xs text-[var(--color-text-muted)]">
                Role: {group.roleName}
                {typeof group.memberCount === 'number' ? ` · ${group.memberCount} member(s)` : ''}
              </span>
              {group.description ? (
                <span className="mt-1 block text-xs leading-relaxed text-[var(--color-text-muted)]">
                  {group.description}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
