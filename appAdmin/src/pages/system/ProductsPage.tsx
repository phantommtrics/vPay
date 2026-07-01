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
  createProduct,
  deleteProduct,
  fetchProducts,
  fetchServices,
  updateProduct,
  type CatalogStatus,
  type DenominationUnitType,
  type ProductSummary,
  type ProductUnitType,
  type ServiceSummary,
} from '../../lib/api';
import { getAdminToken } from '../../lib/auth-storage';

const DENOMINATION_TYPES: DenominationUnitType[] = ['FLEX', 'FIXED'];
const PRODUCT_UNIT_TYPES: ProductUnitType[] = ['MONETARY', 'NON_MONETARY'];
const CATALOG_STATUSES: CatalogStatus[] = ['ACTIVE', 'INACTIVE'];

type ProductForm = {
  code: string;
  name: string;
  displayName: string;
  description: string;
  serviceId: string;
  denominationUnitType: DenominationUnitType;
  productUnitType: ProductUnitType;
  startDate: string;
  expiryDate: string;
  currency: string;
  status: CatalogStatus;
};

function emptyForm(serviceId = ''): ProductForm {
  return {
    code: '',
    name: '',
    displayName: '',
    description: '',
    serviceId,
    denominationUnitType: 'FLEX',
    productUnitType: 'MONETARY',
    startDate: '',
    expiryDate: '',
    currency: 'GMD',
    status: 'ACTIVE',
  };
}

function productToForm(product: ProductSummary): ProductForm {
  return {
    code: product.code,
    name: product.name,
    displayName: product.displayName,
    description: product.description ?? '',
    serviceId: product.serviceId,
    denominationUnitType: product.denominationUnitType,
    productUnitType: product.productUnitType,
    startDate: toDateInput(product.startDate),
    expiryDate: toDateInput(product.expiryDate),
    currency: product.currency,
    status: product.status,
  };
}

function toPayload(form: ProductForm) {
  return {
    code: form.code.trim().toLowerCase(),
    name: form.name.trim(),
    displayName: form.displayName.trim(),
    description: form.description.trim() || undefined,
    serviceId: form.serviceId,
    denominationUnitType: form.denominationUnitType,
    productUnitType: form.productUnitType,
    startDate: form.startDate ? `${form.startDate}T00:00:00.000Z` : null,
    expiryDate: form.expiryDate ? `${form.expiryDate}T23:59:59.999Z` : null,
    currency: form.currency.trim().toUpperCase(),
    status: form.status,
  };
}

export function ProductsPage() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [filterServiceId, setFilterServiceId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [createForm, setCreateForm] = useState<ProductForm>(emptyForm());

  const token = getAdminToken();
  const selected = products.find((p) => p.id === selectedId);

  const editor = useCatalogEditor<ProductForm>(selectedId, (item) =>
    productToForm(item as ProductSummary),
  );

  const listItems = useMemo(
    () =>
      products.map((product) => ({
        id: product.id,
        title: product.displayName,
        subtitle: `${product.service.name} · ${product.currency}`,
        status: product.status,
        meta: `${formatCatalogEnum(product.denominationUnitType)} · ${formatCatalogEnum(product.productUnitType)}`,
      })),
    [products],
  );

  const loadData = useCallback(async () => {
    if (!token) return;
    const [productList, serviceList] = await Promise.all([
      fetchProducts(token, filterServiceId || undefined),
      fetchServices(token),
    ]);
    setProducts(productList);
    setServices(serviceList);
    return serviceList;
  }, [token, filterServiceId]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    loadData()
      .then((serviceList) => {
        if (serviceList?.[0]) {
          const defaultId = serviceList[0].id;
          setCreateForm((f) => (f.serviceId ? f : { ...f, serviceId: defaultId }));
        }
      })
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

  function handleFilterChange(serviceId: string) {
    if (editor.isDirty) {
      const discard = window.confirm('Discard unsaved changes?');
      if (!discard) return;
    }
    setFilterServiceId(serviceId);
    setSelectedId(null);
  }

  async function handleCreate() {
    if (!token || !createForm.code.trim() || !createForm.name.trim() || !createForm.displayName.trim() || !createForm.serviceId) return;
    setSaving(true);
    setError('');
    try {
      const created = await createProduct(token, toPayload(createForm));
      await loadData();
      setShowForm(false);
      setCreateForm(emptyForm(services[0]?.id ?? ''));
      setSelectedId(created.id);
      setSuccess(`Product "${created.displayName}" created`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product');
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!token || !selectedId || !editor.form?.name.trim() || !editor.form.displayName.trim()) return;
    setSaving(true);
    setError('');
    try {
      const payload = editor.form;
      await updateProduct(token, selectedId, toPayload(payload));
      await loadData();
      editor.commitSaved(payload);
      setSuccess('Product updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!token || !selectedId) return;
    setSaving(true);
    setError('');
    try {
      await deleteProduct(token, selectedId);
      setSelectedId(null);
      setConfirmDelete(false);
      await loadData();
      setSuccess('Product deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
    } finally {
      setSaving(false);
    }
  }

  const fieldsDisabled = !editor.isEditing || saving;
  const form = editor.form;

  return (
    <>
      <PageHeader
        title="Products"
        description="Products belong to a service and define what can be offered."
        actions={
          <button
            type="button"
            className="btn-primary"
            disabled={services.length === 0}
            onClick={() => setShowForm(true)}>
            <Plus size={14} className="mr-1 inline" />
            New product
          </button>
        }
      />

      <div className="p-8">
        {error ? <p className="mb-4 text-sm text-[#df1b41]">{error}</p> : null}
        {success ? <p className="mb-4 text-sm text-[var(--color-accent)]">{success}</p> : null}

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-[var(--color-heading)]">Filter by service</label>
          <select
            value={filterServiceId}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]">
            <option value="">All services</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--color-text-muted)]">Loading products…</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <section className="panel overflow-hidden">
              <CatalogList
                items={listItems}
                selectedId={selectedId}
                onSelect={handleSelect}
                searchPlaceholder="Search products…"
                countLabel="product"
                emptyTitle="No products yet"
                emptyDescription="Create a product under a service."
              />
            </section>

            <section className="panel p-6">
              {!selected || !form ? (
                <EmptyState title="Select a product" description="Choose a product from the list to view its details." />
              ) : (
                <>
                  <CatalogDetailToolbar
                    title={selected.displayName}
                    subtitle={`${selected.service.name} · ${selected.currency}`}
                    isEditing={editor.isEditing}
                    isDirty={editor.isDirty}
                    saving={saving}
                    canSave={Boolean(form.code.trim() && form.name.trim() && form.displayName.trim() && form.serviceId)}
                    onEdit={editor.startEdit}
                    onCancel={editor.cancelEdit}
                    onSave={() => void handleSave()}
                    onDelete={() => setConfirmDelete(true)}
                  />

                  {!editor.isEditing ? (
                    <dl className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <dt className={catalogLabelClass}>Code</dt>
                        <dd className="font-mono text-sm text-[var(--color-heading)]">{form.code}</dd>
                      </div>
                      <div>
                        <dt className={catalogLabelClass}>Product name</dt>
                        <dd className="text-sm text-[var(--color-heading)]">{form.name}</dd>
                      </div>
                      <div>
                        <dt className={catalogLabelClass}>Display name</dt>
                        <dd className="text-sm text-[var(--color-heading)]">{form.displayName}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className={catalogLabelClass}>Description</dt>
                        <dd className="text-sm text-[var(--color-heading)]">{form.description || '—'}</dd>
                      </div>
                      <div>
                        <dt className={catalogLabelClass}>Service</dt>
                        <dd className="text-sm text-[var(--color-heading)]">{selected.service.name}</dd>
                      </div>
                      <div>
                        <dt className={catalogLabelClass}>Currency</dt>
                        <dd className="text-sm text-[var(--color-heading)]">{form.currency}</dd>
                      </div>
                      <div>
                        <dt className={catalogLabelClass}>Denomination</dt>
                        <dd className="text-sm text-[var(--color-heading)]">{formatCatalogEnum(form.denominationUnitType)}</dd>
                      </div>
                      <div>
                        <dt className={catalogLabelClass}>Unit type</dt>
                        <dd className="text-sm text-[var(--color-heading)]">{formatCatalogEnum(form.productUnitType)}</dd>
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
                        <dt className={catalogLabelClass}>Status</dt>
                        <dd className="text-sm text-[var(--color-heading)]">{formatCatalogEnum(form.status)}</dd>
                      </div>
                    </dl>
                  ) : (
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className={catalogLabelClass}>Code</label>
                        <input
                          type="text"
                          value={form.code}
                          disabled={fieldsDisabled}
                          onChange={(e) =>
                            editor.setForm({ ...form, code: e.target.value.toLowerCase() })
                          }
                          className={catalogInputClass}
                        />
                      </div>
                      <div>
                        <label className={catalogLabelClass}>Product name</label>
                        <input
                          type="text"
                          value={form.name}
                          disabled={fieldsDisabled}
                          onChange={(e) => editor.setForm({ ...form, name: e.target.value })}
                          className={catalogInputClass}
                        />
                      </div>
                      <div>
                        <label className={catalogLabelClass}>Display name</label>
                        <input
                          type="text"
                          value={form.displayName}
                          disabled={fieldsDisabled}
                          onChange={(e) => editor.setForm({ ...form, displayName: e.target.value })}
                          className={catalogInputClass}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={catalogLabelClass}>Description</label>
                        <textarea
                          value={form.description}
                          disabled={fieldsDisabled}
                          rows={2}
                          onChange={(e) => editor.setForm({ ...form, description: e.target.value })}
                          className={catalogInputClass}
                        />
                      </div>
                      <div>
                        <label className={catalogLabelClass}>Service</label>
                        <select
                          value={form.serviceId}
                          disabled={fieldsDisabled}
                          onChange={(e) => editor.setForm({ ...form, serviceId: e.target.value })}
                          className={catalogInputClass}>
                          {services.map((service) => (
                            <option key={service.id} value={service.id}>
                              {service.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={catalogLabelClass}>Currency</label>
                        <input
                          type="text"
                          maxLength={3}
                          value={form.currency}
                          disabled={fieldsDisabled}
                          onChange={(e) =>
                            editor.setForm({ ...form, currency: e.target.value.toUpperCase() })
                          }
                          className={catalogInputClass}
                        />
                      </div>
                      <div>
                        <label className={catalogLabelClass}>Denomination unit type</label>
                        <select
                          value={form.denominationUnitType}
                          disabled={fieldsDisabled}
                          onChange={(e) =>
                            editor.setForm({
                              ...form,
                              denominationUnitType: e.target.value as DenominationUnitType,
                            })
                          }
                          className={catalogInputClass}>
                          {DENOMINATION_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {formatCatalogEnum(type)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={catalogLabelClass}>Product unit type</label>
                        <select
                          value={form.productUnitType}
                          disabled={fieldsDisabled}
                          onChange={(e) =>
                            editor.setForm({ ...form, productUnitType: e.target.value as ProductUnitType })
                          }
                          className={catalogInputClass}>
                          {PRODUCT_UNIT_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {formatCatalogEnum(type)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={catalogLabelClass}>Start date</label>
                        <input
                          type="date"
                          value={form.startDate}
                          disabled={fieldsDisabled}
                          onChange={(e) => editor.setForm({ ...form, startDate: e.target.value })}
                          className={catalogInputClass}
                        />
                      </div>
                      <div>
                        <label className={catalogLabelClass}>Expiry date</label>
                        <input
                          type="date"
                          value={form.expiryDate}
                          disabled={fieldsDisabled}
                          onChange={(e) => editor.setForm({ ...form, expiryDate: e.target.value })}
                          className={catalogInputClass}
                        />
                      </div>
                      <div>
                        <label className={catalogLabelClass}>Status</label>
                        <select
                          value={form.status}
                          disabled={fieldsDisabled}
                          onChange={(e) =>
                            editor.setForm({ ...form, status: e.target.value as CatalogStatus })
                          }
                          className={catalogInputClass}>
                          {CATALOG_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {formatCatalogEnum(status)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
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
            <h3 className="text-lg font-semibold text-gray-900">New product</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={catalogLabelClass}>Code</label>
                <input
                  type="text"
                  value={createForm.code}
                  onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value.toLowerCase() }))}
                  placeholder="e.g. wallet-topup"
                  className={catalogInputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={catalogLabelClass}>Product name</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  className={catalogInputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={catalogLabelClass}>Display name</label>
                <input
                  type="text"
                  value={createForm.displayName}
                  onChange={(e) => setCreateForm((f) => ({ ...f, displayName: e.target.value }))}
                  className={catalogInputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={catalogLabelClass}>Service</label>
                <select
                  value={createForm.serviceId}
                  onChange={(e) => setCreateForm((f) => ({ ...f, serviceId: e.target.value }))}
                  className={catalogInputClass}>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={catalogLabelClass}>Currency</label>
                <input
                  type="text"
                  maxLength={3}
                  value={createForm.currency}
                  onChange={(e) => setCreateForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
                  className={catalogInputClass}
                />
              </div>
              <div>
                <label className={catalogLabelClass}>Denomination</label>
                <select
                  value={createForm.denominationUnitType}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      denominationUnitType: e.target.value as DenominationUnitType,
                    }))
                  }
                  className={catalogInputClass}>
                  {DENOMINATION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {formatCatalogEnum(type)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={catalogLabelClass}>Unit type</label>
                <select
                  value={createForm.productUnitType}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, productUnitType: e.target.value as ProductUnitType }))
                  }
                  className={catalogInputClass}>
                  {PRODUCT_UNIT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {formatCatalogEnum(type)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={catalogLabelClass}>Start date</label>
                <input
                  type="date"
                  value={createForm.startDate}
                  onChange={(e) => setCreateForm((f) => ({ ...f, startDate: e.target.value }))}
                  className={catalogInputClass}
                />
              </div>
              <div>
                <label className={catalogLabelClass}>Expiry date</label>
                <input
                  type="date"
                  value={createForm.expiryDate}
                  onChange={(e) => setCreateForm((f) => ({ ...f, expiryDate: e.target.value }))}
                  className={catalogInputClass}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={saving || !createForm.code.trim() || !createForm.name.trim() || !createForm.displayName.trim()}
                onClick={() => void handleCreate()}>
                {saving ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete product"
        description={`Delete "${selected?.displayName}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={saving}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
