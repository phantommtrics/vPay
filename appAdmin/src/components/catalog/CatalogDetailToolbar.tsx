import { Pencil, Trash2, X } from 'lucide-react';

type CatalogDetailToolbarProps = {
  title: string;
  subtitle?: string;
  isEditing: boolean;
  isDirty: boolean;
  saving: boolean;
  canSave: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete?: () => void;
  deleteDisabled?: boolean;
};

export function CatalogDetailToolbar({
  title,
  subtitle,
  isEditing,
  isDirty,
  saving,
  canSave,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  deleteDisabled,
}: CatalogDetailToolbarProps) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] pb-4">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-[var(--color-heading)]">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{subtitle}</p> : null}
        {isEditing && isDirty ? (
          <p className="mt-1 text-xs text-amber-700">Unsaved changes</p>
        ) : !isEditing ? (
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">View only — click Edit to change fields</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!isEditing ? (
          <>
            <button type="button" className="btn-secondary" disabled={saving} onClick={onEdit}>
              <Pencil size={14} className="mr-1 inline" />
              Edit
            </button>
            {onDelete ? (
              <button
                type="button"
                disabled={saving || deleteDisabled}
                className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-sm text-[#df1b41] hover:bg-red-50 disabled:opacity-40"
                onClick={onDelete}>
                <Trash2 size={14} />
                Delete
              </button>
            ) : null}
          </>
        ) : (
          <>
            <button type="button" className="btn-secondary" disabled={saving} onClick={onCancel}>
              <X size={14} className="mr-1 inline" />
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={saving || !isDirty || !canSave}
              onClick={onSave}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {onDelete ? (
              <button
                type="button"
                disabled={saving || deleteDisabled}
                className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-sm text-[#df1b41] hover:bg-red-50 disabled:opacity-40"
                onClick={onDelete}>
                <Trash2 size={14} />
                Delete
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
