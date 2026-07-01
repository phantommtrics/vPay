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
  createSettlementRequest,
  deleteSettlementRequest,
  fetchProducts,
  fetchSettlementRequests,
  fetchUcps,
  updateSettlementRequest,
  type CatalogStatus,
  type ProductSummary,
  type SettlementRequestSummary,
  type UcpSummary,
} from '../../lib/api';
import { getAdminToken } from '../../lib/auth-storage';

const CATALOG_STATUSES: CatalogStatus[] = ['ACTIVE', 'INACTIVE'];

type SettlementForm = {
  name: string;
  description: string;
  productId: string;
  ucpId: string;
  priority: string;
  startDate: string;
  expiryDate: string;
  status: CatalogStatus;
};

function emptyForm(productId = '', ucpId = ''): SettlementForm {
  return {
    name: '',
    description: '',
    productId,
    ucpId,
    priority: '0',
    startDate: '',
    expiryDate: '',
    status: 'ACTIVE',
  };
}

function rowToForm(row: SettlementRequestSummary): SettlementForm {
  return {
    name: row.name,
    description: row.description ?? '',
    productId: row.productId,
    ucpId: row.ucpId,
    priority: String(row.priority),
    startDate: toDateInput(row.startDate),
    expiryDate: toDateInput(row.expiryDate),
    status: row.status,
  };
}

function toPayload(form: SettlementForm) {
  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    productId: form.productId,
    ucpId: form.ucpId,
    priority: Number(form.priority) || 0,
    startDate: form.startDate ? `${form.startDate}T00:00:00.000Z` : null,
    expiryDate: form.expiryDate ? `${form.expiryDate}T23:59:59.999Z` : null,
    status: form.status,
  };
}

export function SettlementRequestsPage() {
  const [rows, setRows] = useState<SettlementRequestSummary[]>([]);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [ucps, setUcps] = useState<UcpSummary[]>([]);
  const [filterProductId, setFilterProductId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [createForm, setCreateForm] = useState<SettlementForm>(emptyForm());

  const token = getAdminToken();
  const selected = rows.find((r) => r.id === selectedId);

  const editor = useCatalogEditor<SettlementForm>(selectedId, (item) =>
    rowToForm(item as SettlementRequestSummary),
  );

  const listItems = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        title: row.name,
        subtitle: `${row.product.displayName} → ${row.ucp.name}`,
        status: row.status,
        meta: `Priority ${row.priority}`,
      })),
    [rows],
  );

  const loadData = useCallback(async () => {
    if (!token) return;
    const [settlementList, productList, ucpList] = await Promise.all([
      fetchSettlementRequests(token, filterProductId || undefined),
      fetchProducts(token),
      fetchUcps(token),
    ]);
    setRows(settlementList);
    setProducts(productList);
    setUcps(ucpList);
    return { productList, ucpList };
  }, [token, filterProductId]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    loadData()
      .then((result) => {
        if (result?.productList?.[0] && result?.ucpList?.[0]) {
          setCreateForm((f) =>
            f.productId && f.ucpId
              ? f
              : emptyForm(result.productList[0].id, result.ucpList[0].id),
          );
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token, loadData]);

  useEffect(() => {
    if (selected) editor.selectItem(selected);
  }, [selected]);

  function handleSelect(id: string) {
    if (editor.isDirty && !window.confirm('Discard unsaved changes?')) return;
    setSelectedId(id);
    setSuccess('');
    setError('');
  }

  async function handleCreate() {
    if (!token || !createForm.name.trim() || !createForm.productId || !createForm.ucpId) return;
    setSaving(true);
    setError('');
    try {
      const created = await createSettlementRequest(token, toPayload(createForm));
      await loadData();
      setShowForm(false);
      setCreateForm(emptyForm(products[0]?.id ?? '', ucps[0]?.id ?? ''));
      setSelectedId(created.id);
      setSuccess(`Settlement request "${created.name}" created`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create settlement request');
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
      await updateSettlementRequest(token, selectedId, toPayload(payload));
      await loadData();
      editor.commitSaved(payload);
      setSuccess('Settlement request updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settlement request');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!token || !selectedId) return;
    setSaving(true);
    setError('');
    try {
      await deleteSettlementRequest(token, selectedId);
      setSelectedId(null);
      setConfirmDelete(false);
      await loadData();
      setSuccess('Settlement request deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete settlement request');
    } finally {
      setSaving(false);
    }
  }

  const form = editor.form;
  const fieldsDisabled = !editor.isEditing || saving;

  function renderFormFields(
    value: SettlementForm,
    onChange: (next: SettlementForm) => void,
    disabled: boolean,
  ) {
    return (
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={catalogLabelClass}>Name</label>
          <input
            type="text"
            value={value.name}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            className={catalogInputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={catalogLabelClass}>Description</label>
          <textarea
            value={value.description}
            disabled={disabled}
            rows={2}
            onChange={(e) => onChange({ ...value, description: e.target.value })}
            className={catalogInputClass}
          />
        </div>
        <div>
          <label className={catalogLabelClass}>Product</label>
          <select
            value={value.productId}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, productId: e.target.value })}
            className={catalogInputClass}>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.displayName} ({product.code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={catalogLabelClass}>UCP</label>
          <select
            value={value.ucpId}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, ucpId: e.target.value })}
            className={catalogInputClass}>
            {ucps.map((ucp) => (
              <option key={ucp.id} value={ucp.id}>
                {ucp.name} ({ucp.code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={catalogLabelClass}>Priority</label>
          <input
            type="number"
            min={0}
            value={value.priority}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, priority: e.target.value })}
            className={catalogInputClass}
          />
        </div>
        <div>
          <label className={catalogLabelClass}>Status</label>
          <select
            value={value.status}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, status: e.target.value as CatalogStatus })}
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
            value={value.startDate}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, startDate: e.target.value })}
            className={catalogInputClass}
          />
        </div>
        <div>
          <label className={catalogLabelClass}>Expiry date</label>
          <input
            type="date"
            value={value.expiryDate}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, expiryDate: e.target.value })}
            className={catalogInputClass}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Settlement requests"
        description="Link products to UCP charge parameters applied at transaction time."
        actions={
          <button
            type="button"
            className="btn-primary"
            disabled={products.length === 0 || ucps.length === 0}
            onClick={() => setShowForm(true)}>
            <Plus size={14} className="mr-1 inline" />
            New settlement request
          </button>
        }
      />

      <div className="p-8">
        {error ? <p className="mb-4 text-sm text-[#df1b41]">{error}</p> : null}
        {success ? <p className="mb-4 text-sm text-[var(--color-accent)]">{success}</p> : null}

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-[var(--color-heading)]">Filter by product</label>
          <select
            value={filterProductId}
            onChange={(e) => {
              if (editor.isDirty && !window.confirm('Discard unsaved changes?')) return;
              setFilterProductId(e.target.value);
              setSelectedId(null);
            }}
            className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]">
            <option value="">All products</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.displayName}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--color-text-muted)]">Loading settlement requests…</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <section className="panel overflow-hidden">
              <CatalogList
                items={listItems}
                selectedId={selectedId}
                onSelect={handleSelect}
                searchPlaceholder="Search settlement requests…"
                countLabel="request"
                emptyTitle="No settlement requests yet"
                emptyDescription="Link a product to a UCP to drive transaction charges."
              />
            </section>

            <section className="panel p-6">
              {!selected || !form ? (
                <EmptyState
                  title="Select a settlement request"
                  description="Choose a request to view how a product maps to a UCP."
                />
              ) : (
                <>
                  <CatalogDetailToolbar
                    title={selected.name}
                    subtitle={`${selected.product.code} → ${selected.ucp.code}`}
                    isEditing={editor.isEditing}
                    isDirty={editor.isDirty}
                    saving={saving}
                    canSave={Boolean(form.name.trim() && form.productId && form.ucpId)}
                    onEdit={editor.startEdit}
                    onCancel={editor.cancelEdit}
                    onSave={() => void handleSave()}
                    onDelete={() => setConfirmDelete(true)}
                  />

                  {!editor.isEditing ? (
                    <dl className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <dt className={catalogLabelClass}>Name</dt>
                        <dd className="text-sm text-[var(--color-heading)]">{form.name}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className={catalogLabelClass}>Description</dt>
                        <dd className="text-sm text-[var(--color-heading)]">{form.description || '—'}</dd>
                      </div>
                      <div>
                        <dt className={catalogLabelClass}>Product</dt>
                        <dd className="text-sm text-[var(--color-heading)]">
                          {selected.product.displayName} ({selected.product.code})
                        </dd>
                      </div>
                      <div>
                        <dt className={catalogLabelClass}>UCP</dt>
                        <dd className="text-sm text-[var(--color-heading)]">
                          {selected.ucp.name} ({selected.ucp.code})
                        </dd>
                      </div>
                      <div>
                        <dt className={catalogLabelClass}>Priority</dt>
                        <dd className="text-sm text-[var(--color-heading)]">{form.priority}</dd>
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
                    </dl>
                  ) : (
                    renderFormFields(form, (next) => editor.setForm(next), fieldsDisabled)
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </div>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">New settlement request</h3>
            <div className="mt-4">{renderFormFields(createForm, setCreateForm, saving)}</div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={saving || !createForm.name.trim()}
                onClick={() => void handleCreate()}>
                {saving ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete settlement request"
        description={`Delete "${selected?.name}"? Transaction pricing may fall back to env defaults.`}
        confirmLabel="Delete"
        destructive
        loading={saving}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
