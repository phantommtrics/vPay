import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';

import { CatalogDetailToolbar } from '../../components/catalog/CatalogDetailToolbar';
import { CatalogList } from '../../components/catalog/CatalogList';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { useCatalogEditor } from '../../hooks/useCatalogEditor';
import {
  catalogInputClass,
  catalogLabelClass,
  formatCatalogEnum,
  formatDisplayDate,
  toDateInput,
} from '../../lib/catalog-form';
import {
  createUcp,
  deleteUcp,
  fetchUcps,
  updateUcp,
  type CatalogStatus,
  type UcpCalculationType,
  type UcpSlabInput,
  type UcpSlabValueType,
  type UcpSummary,
  type UcpType,
  type UcpUnit,
} from '../../lib/api';
import { getAdminToken } from '../../lib/auth-storage';

const UCP_UNITS: UcpUnit[] = ['FEES', 'REWARD', 'SETTLEMENT', 'TAX', 'OTHER'];
const UCP_TYPES: UcpType[] = ['FIXED', 'SLAB'];
const CALCULATION_TYPES: UcpCalculationType[] = ['INCLUSIVE', 'EXCLUSIVE'];
const SLAB_VALUE_TYPES: UcpSlabValueType[] = ['PERCENT', 'FIXED_AMOUNT'];
const CATALOG_STATUSES: CatalogStatus[] = ['ACTIVE', 'INACTIVE'];

type UcpForm = {
  code: string;
  name: string;
  description: string;
  unit: UcpUnit;
  ucpType: UcpType;
  calculationType: UcpCalculationType;
  allowDebitOnSuccessfulTransaction: boolean;
  startDate: string;
  expiryDate: string;
  minValue: string;
  maxValue: string;
  fixedValue: string;
  status: CatalogStatus;
  slabs: UcpSlabInput[];
};

function emptySlab(): UcpSlabInput {
  return { minAmount: 0, maxAmount: null, value: 0, valueType: 'PERCENT', sortOrder: 0 };
}

function emptyForm(): UcpForm {
  return {
    code: '',
    name: '',
    description: '',
    unit: 'FEES',
    ucpType: 'FIXED',
    calculationType: 'EXCLUSIVE',
    allowDebitOnSuccessfulTransaction: false,
    startDate: '',
    expiryDate: '',
    minValue: '',
    maxValue: '',
    fixedValue: '',
    status: 'ACTIVE',
    slabs: [emptySlab()],
  };
}

function ucpToForm(ucp: UcpSummary): UcpForm {
  return {
    code: ucp.code,
    name: ucp.name,
    description: ucp.description ?? '',
    unit: ucp.unit,
    ucpType: ucp.ucpType,
    calculationType: ucp.calculationType,
    allowDebitOnSuccessfulTransaction: ucp.allowDebitOnSuccessfulTransaction,
    startDate: toDateInput(ucp.startDate),
    expiryDate: toDateInput(ucp.expiryDate),
    minValue: ucp.minValue != null ? String(ucp.minValue) : '',
    maxValue: ucp.maxValue != null ? String(ucp.maxValue) : '',
    fixedValue: ucp.fixedValue != null ? String(ucp.fixedValue) : '',
    status: ucp.status,
    slabs:
      ucp.slabs.length > 0
        ? ucp.slabs.map((slab) => ({
            minAmount: slab.minAmount,
            maxAmount: slab.maxAmount,
            value: slab.value,
            valueType: slab.valueType,
            sortOrder: slab.sortOrder,
          }))
        : [emptySlab()],
  };
}

function parseOptionalNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPayload(form: UcpForm) {
  const base = {
    code: form.code.trim().toLowerCase(),
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    unit: form.unit,
    ucpType: form.ucpType,
    calculationType: form.calculationType,
    allowDebitOnSuccessfulTransaction: form.allowDebitOnSuccessfulTransaction,
    startDate: form.startDate ? `${form.startDate}T00:00:00.000Z` : null,
    expiryDate: form.expiryDate ? `${form.expiryDate}T23:59:59.999Z` : null,
    minValue: parseOptionalNumber(form.minValue),
    maxValue: parseOptionalNumber(form.maxValue),
    status: form.status,
  };

  if (form.ucpType === 'FIXED') {
    return { ...base, fixedValue: parseOptionalNumber(form.fixedValue) };
  }

  return {
    ...base,
    fixedValue: null,
    slabs: form.slabs.map((slab, index) => ({
      minAmount: slab.minAmount,
      maxAmount: slab.maxAmount ?? null,
      value: slab.value,
      valueType: slab.valueType,
      sortOrder: slab.sortOrder ?? index,
    })),
  };
}

function formatSlabRange(min: number, max: number | null) {
  if (max == null) return `${min}+`;
  return `${min} – ${max}`;
}

function SlabViewTable({ slabs }: { slabs: UcpSlabInput[] }) {
  if (slabs.length === 0) return <p className="text-sm text-[var(--color-text-muted)]">No tiers defined.</p>;

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-canvas-subtle)] text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
          <tr>
            <th className="px-3 py-2">Range</th>
            <th className="px-3 py-2">Value</th>
            <th className="px-3 py-2">Type</th>
          </tr>
        </thead>
        <tbody>
          {slabs.map((slab, index) => (
            <tr key={index} className="border-t border-[var(--color-border)]">
              <td className="px-3 py-2 text-[var(--color-heading)]">
                {formatSlabRange(slab.minAmount, slab.maxAmount ?? null)}
              </td>
              <td className="px-3 py-2 text-[var(--color-heading)]">{slab.value}</td>
              <td className="px-3 py-2 text-[var(--color-text-muted)]">{formatCatalogEnum(slab.valueType)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SlabEditor({
  slabs,
  disabled,
  onChange,
}: {
  slabs: UcpSlabInput[];
  disabled: boolean;
  onChange: (slabs: UcpSlabInput[]) => void;
}) {
  function updateSlab(index: number, patch: Partial<UcpSlabInput>) {
    onChange(slabs.map((slab, i) => (i === index ? { ...slab, ...patch } : slab)));
  }

  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="flex items-center justify-between">
        <label className={catalogLabelClass}>Slab tiers</label>
        {!disabled ? (
          <button
            type="button"
            className="text-sm font-medium text-[var(--color-accent)]"
            onClick={() => onChange([...slabs, emptySlab()])}>
            Add tier
          </button>
        ) : null}
      </div>
      {slabs.map((slab, index) => (
        <div key={index} className="grid gap-2 rounded-lg border border-[var(--color-border)] p-3 sm:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Min</label>
            <input
              type="number"
              min={0}
              value={slab.minAmount}
              disabled={disabled}
              onChange={(e) => updateSlab(index, { minAmount: Number(e.target.value) })}
              className={catalogInputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Max</label>
            <input
              type="number"
              min={0}
              value={slab.maxAmount ?? ''}
              disabled={disabled}
              placeholder="Open"
              onChange={(e) =>
                updateSlab(index, { maxAmount: e.target.value === '' ? null : Number(e.target.value) })
              }
              className={catalogInputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Value</label>
            <input
              type="number"
              value={slab.value}
              disabled={disabled}
              onChange={(e) => updateSlab(index, { value: Number(e.target.value) })}
              className={catalogInputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Type</label>
            <select
              value={slab.valueType}
              disabled={disabled}
              onChange={(e) => updateSlab(index, { valueType: e.target.value as UcpSlabValueType })}
              className={catalogInputClass}>
              {SLAB_VALUE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {formatCatalogEnum(type)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            {!disabled ? (
              <button
                type="button"
                className="text-sm text-[#df1b41] disabled:opacity-40"
                disabled={slabs.length <= 1}
                onClick={() => onChange(slabs.filter((_, i) => i !== index))}>
                Remove
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function UcpFormFields({
  form,
  disabled,
  onChange,
}: {
  form: UcpForm;
  disabled: boolean;
  onChange: (form: UcpForm) => void;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div>
        <label className={catalogLabelClass}>Code</label>
        <input
          type="text"
          value={form.code}
          disabled={disabled}
          onChange={(e) => onChange({ ...form, code: e.target.value.toLowerCase() })}
          className={catalogInputClass}
        />
      </div>
      <div>
        <label className={catalogLabelClass}>UCP name</label>
        <input
          type="text"
          value={form.name}
          disabled={disabled}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          className={catalogInputClass}
        />
      </div>
      <div className="sm:col-span-2">
        <label className={catalogLabelClass}>Description</label>
        <textarea
          value={form.description}
          disabled={disabled}
          rows={2}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
          className={catalogInputClass}
        />
      </div>
      <div>
        <label className={catalogLabelClass}>Unit</label>
        <select
          value={form.unit}
          disabled={disabled}
          onChange={(e) => onChange({ ...form, unit: e.target.value as UcpUnit })}
          className={catalogInputClass}>
          {UCP_UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {formatCatalogEnum(unit)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={catalogLabelClass}>UCP type</label>
        <select
          value={form.ucpType}
          disabled={disabled}
          onChange={(e) => onChange({ ...form, ucpType: e.target.value as UcpType })}
          className={catalogInputClass}>
          {UCP_TYPES.map((type) => (
            <option key={type} value={type}>
              {formatCatalogEnum(type)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={catalogLabelClass}>Calculation type</label>
        <select
          value={form.calculationType}
          disabled={disabled}
          onChange={(e) => onChange({ ...form, calculationType: e.target.value as UcpCalculationType })}
          className={catalogInputClass}>
          {CALCULATION_TYPES.map((type) => (
            <option key={type} value={type}>
              {formatCatalogEnum(type)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={catalogLabelClass}>Status</label>
        <select
          value={form.status}
          disabled={disabled}
          onChange={(e) => onChange({ ...form, status: e.target.value as CatalogStatus })}
          className={catalogInputClass}>
          {CATALOG_STATUSES.map((status) => (
            <option key={status} value={status}>
              {formatCatalogEnum(status)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={catalogLabelClass}>Start date</label>
        <input
          type="date"
          value={form.startDate}
          disabled={disabled}
          onChange={(e) => onChange({ ...form, startDate: e.target.value })}
          className={catalogInputClass}
        />
      </div>
      <div>
        <label className={catalogLabelClass}>Expiry date</label>
        <input
          type="date"
          value={form.expiryDate}
          disabled={disabled}
          onChange={(e) => onChange({ ...form, expiryDate: e.target.value })}
          className={catalogInputClass}
        />
      </div>
      <div>
        <label className={catalogLabelClass}>Min value</label>
        <input
          type="number"
          value={form.minValue}
          disabled={disabled}
          onChange={(e) => onChange({ ...form, minValue: e.target.value })}
          className={catalogInputClass}
        />
      </div>
      <div>
        <label className={catalogLabelClass}>Max value</label>
        <input
          type="number"
          value={form.maxValue}
          disabled={disabled}
          onChange={(e) => onChange({ ...form, maxValue: e.target.value })}
          className={catalogInputClass}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="flex items-center gap-2 text-sm text-[var(--color-heading)]">
          <input
            type="checkbox"
            checked={form.allowDebitOnSuccessfulTransaction}
            disabled={disabled}
            onChange={(e) => onChange({ ...form, allowDebitOnSuccessfulTransaction: e.target.checked })}
          />
          Allow debit on successful transaction
        </label>
      </div>
      {form.ucpType === 'FIXED' ? (
        <div>
          <label className={catalogLabelClass}>Fixed value</label>
          <input
            type="number"
            value={form.fixedValue}
            disabled={disabled}
            onChange={(e) => onChange({ ...form, fixedValue: e.target.value })}
            className={catalogInputClass}
          />
        </div>
      ) : (
        <SlabEditor slabs={form.slabs} disabled={disabled} onChange={(slabs) => onChange({ ...form, slabs })} />
      )}
    </div>
  );
}

function UcpViewDetails({ form }: { form: UcpForm }) {
  return (
    <div className="space-y-6">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className={catalogLabelClass}>Code</dt>
          <dd className="font-mono text-sm text-[var(--color-heading)]">{form.code}</dd>
        </div>
        <div>
          <dt className={catalogLabelClass}>UCP name</dt>
          <dd className="text-sm text-[var(--color-heading)]">{form.name}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className={catalogLabelClass}>Description</dt>
          <dd className="text-sm text-[var(--color-heading)]">{form.description || '—'}</dd>
        </div>
        <div>
          <dt className={catalogLabelClass}>Unit</dt>
          <dd className="text-sm text-[var(--color-heading)]">{formatCatalogEnum(form.unit)}</dd>
        </div>
        <div>
          <dt className={catalogLabelClass}>UCP type</dt>
          <dd className="text-sm text-[var(--color-heading)]">{formatCatalogEnum(form.ucpType)}</dd>
        </div>
        <div>
          <dt className={catalogLabelClass}>Calculation</dt>
          <dd className="text-sm text-[var(--color-heading)]">{formatCatalogEnum(form.calculationType)}</dd>
        </div>
        <div>
          <dt className={catalogLabelClass}>Status</dt>
          <dd className="text-sm text-[var(--color-heading)]">{formatCatalogEnum(form.status)}</dd>
        </div>
        <div>
          <dt className={catalogLabelClass}>Valid from</dt>
          <dd className="text-sm text-[var(--color-heading)]">{formatDisplayDate(form.startDate)}</dd>
        </div>
        <div>
          <dt className={catalogLabelClass}>Valid until</dt>
          <dd className="text-sm text-[var(--color-heading)]">{formatDisplayDate(form.expiryDate)}</dd>
        </div>
        <div>
          <dt className={catalogLabelClass}>Min value</dt>
          <dd className="text-sm text-[var(--color-heading)]">{form.minValue || '—'}</dd>
        </div>
        <div>
          <dt className={catalogLabelClass}>Max value</dt>
          <dd className="text-sm text-[var(--color-heading)]">{form.maxValue || '—'}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className={catalogLabelClass}>Debit on success</dt>
          <dd className="text-sm text-[var(--color-heading)]">
            {form.allowDebitOnSuccessfulTransaction ? 'Yes' : 'No'}
          </dd>
        </div>
        {form.ucpType === 'FIXED' ? (
          <div>
            <dt className={catalogLabelClass}>Fixed value</dt>
            <dd className="text-sm text-[var(--color-heading)]">{form.fixedValue || '—'}</dd>
          </div>
        ) : null}
      </dl>

      {form.ucpType === 'SLAB' ? (
        <div>
          <p className={catalogLabelClass}>Slab tiers</p>
          <SlabViewTable slabs={form.slabs} />
        </div>
      ) : null}
    </div>
  );
}

export function UcpsPage() {
  const [ucps, setUcps] = useState<UcpSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [createForm, setCreateForm] = useState<UcpForm>(emptyForm());

  const token = getAdminToken();
  const selected = ucps.find((u) => u.id === selectedId);

  const editor = useCatalogEditor<UcpForm>(selectedId, (item) => ucpToForm(item as UcpSummary));

  const listItems = useMemo(
    () =>
      ucps.map((ucp) => ({
        id: ucp.id,
        title: ucp.name,
        subtitle: `${formatCatalogEnum(ucp.unit)} · ${formatCatalogEnum(ucp.calculationType)}`,
        status: ucp.status,
        meta:
          ucp.ucpType === 'FIXED'
            ? `${formatCatalogEnum(ucp.ucpType)} · ${ucp.fixedValue ?? '—'}`
            : `${ucp.slabs.length} tier${ucp.slabs.length === 1 ? '' : 's'}`,
      })),
    [ucps],
  );

  const loadData = useCallback(async () => {
    if (!token) return;
    setUcps(await fetchUcps(token));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    loadData()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token, loadData]);

  useEffect(() => {
    if (selected) {
      editor.selectItem(selected);
    }
  }, [selected]);

  function handleSelect(id: string) {
    if (editor.isDirty) {
      const discard = window.confirm('Discard unsaved changes?');
      if (!discard) return;
    }
    setSelectedId(id);
    setSuccess('');
    setError('');
  }

  async function handleCreate() {
    if (!token || !createForm.code.trim() || !createForm.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const created = await createUcp(token, toPayload(createForm));
      await loadData();
      setShowForm(false);
      setCreateForm(emptyForm());
      setSelectedId(created.id);
      setSuccess(`UCP "${created.name}" created`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create UCP');
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!token || !selectedId || !editor.form?.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const payload = editor.form;
      await updateUcp(token, selectedId, toPayload(payload));
      await loadData();
      editor.commitSaved(payload);
      setSuccess('UCP updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update UCP');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!token || !selectedId) return;
    setSaving(true);
    setError('');
    try {
      await deleteUcp(token, selectedId);
      setSelectedId(null);
      setConfirmDelete(false);
      await loadData();
      setSuccess('UCP deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete UCP');
    } finally {
      setSaving(false);
    }
  }

  const form = editor.form;

  return (
    <>
      <PageHeader
        title="UCP"
        description="Universal charge parameters for fees, rewards, and settlements."
        actions={
          <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={14} className="mr-1 inline" />
            New UCP
          </button>
        }
      />

      <div className="p-8">
        {error ? <p className="mb-4 text-sm text-[#df1b41]">{error}</p> : null}
        {success ? <p className="mb-4 text-sm text-[var(--color-accent)]">{success}</p> : null}

        {loading ? (
          <p className="text-sm text-[var(--color-text-muted)]">Loading UCP records…</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <section className="panel overflow-hidden">
              <CatalogList
                items={listItems}
                selectedId={selectedId}
                onSelect={handleSelect}
                searchPlaceholder="Search UCP…"
                countLabel="record"
                emptyTitle="No UCP records yet"
                emptyDescription="Create charge parameters to apply later."
              />
            </section>

            <section className="panel p-6">
              {!selected || !form ? (
                <EmptyState title="Select a UCP" description="Choose a record from the list to view its details." />
              ) : (
                <>
                  <CatalogDetailToolbar
                    title={selected.name}
                    subtitle={`${formatCatalogEnum(selected.unit)} · ${formatCatalogEnum(selected.ucpType)}`}
                    isEditing={editor.isEditing}
                    isDirty={editor.isDirty}
                    saving={saving}
                    canSave={Boolean(form.code.trim() && form.name.trim())}
                    onEdit={editor.startEdit}
                    onCancel={editor.cancelEdit}
                    onSave={() => void handleSave()}
                    onDelete={() => setConfirmDelete(true)}
                  />

                  {editor.isEditing ? (
                    <UcpFormFields form={form} disabled={saving} onChange={(next) => editor.setForm(next)} />
                  ) : (
                    <UcpViewDetails form={form} />
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </div>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">New UCP</h3>
            <div className="mt-4">
              <UcpFormFields form={createForm} disabled={saving} onChange={setCreateForm} />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={saving || !createForm.code.trim() || !createForm.name.trim()}
                onClick={() => void handleCreate()}>
                {saving ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete UCP"
        description={`Delete "${selected?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={saving}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
