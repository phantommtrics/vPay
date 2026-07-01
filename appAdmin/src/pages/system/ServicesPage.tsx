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
} from '../../lib/catalog-form';
import {
  createService,
  deleteService,
  fetchServices,
  updateService,
  type CatalogStatus,
  type ServiceBehaviour,
  type ServiceSummary,
  type ServiceType,
} from '../../lib/api';
import { getAdminToken } from '../../lib/auth-storage';

const SERVICE_TYPES: ServiceType[] = ['INTERNAL', 'EXTERNAL', 'INTERNATIONAL'];
const SERVICE_BEHAVIOURS: ServiceBehaviour[] = ['TRANSACTIONAL', 'NON_TRANSACTIONAL'];
const CATALOG_STATUSES: CatalogStatus[] = ['ACTIVE', 'INACTIVE'];

type ServiceForm = {
  name: string;
  description: string;
  type: ServiceType;
  behaviour: ServiceBehaviour;
  status: CatalogStatus;
};

function emptyForm(): ServiceForm {
  return {
    name: '',
    description: '',
    type: 'INTERNAL',
    behaviour: 'TRANSACTIONAL',
    status: 'ACTIVE',
  };
}

function serviceToForm(service: ServiceSummary): ServiceForm {
  return {
    name: service.name,
    description: service.description ?? '',
    type: service.type,
    behaviour: service.behaviour,
    status: service.status,
  };
}

export function ServicesPage() {
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [createForm, setCreateForm] = useState<ServiceForm>(emptyForm());

  const token = getAdminToken();
  const selected = services.find((s) => s.id === selectedId);

  const editor = useCatalogEditor<ServiceForm>(selectedId, (item) =>
    serviceToForm(item as ServiceSummary),
  );

  const listItems = useMemo(
    () =>
      services.map((service) => ({
        id: service.id,
        title: service.name,
        subtitle: `${formatCatalogEnum(service.type)} · ${formatCatalogEnum(service.behaviour)}`,
        status: service.status,
        meta: `${service.productCount} product${service.productCount === 1 ? '' : 's'}`,
      })),
    [services],
  );

  const loadData = useCallback(async () => {
    if (!token) return;
    setServices(await fetchServices(token));
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
    if (!token || !createForm.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const created = await createService(token, {
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
        type: createForm.type,
        behaviour: createForm.behaviour,
        status: createForm.status,
      });
      await loadData();
      setShowForm(false);
      setCreateForm(emptyForm());
      setSelectedId(created.id);
      setSuccess(`Service "${created.name}" created`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create service');
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
      await updateService(token, selectedId, {
        name: payload.name.trim(),
        description: payload.description.trim() || null,
        type: payload.type,
        behaviour: payload.behaviour,
        status: payload.status,
      });
      await loadData();
      editor.commitSaved(payload);
      setSuccess('Service updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update service');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!token || !selectedId) return;
    setSaving(true);
    setError('');
    try {
      await deleteService(token, selectedId);
      setSelectedId(null);
      setConfirmDelete(false);
      await loadData();
      setSuccess('Service deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete service');
    } finally {
      setSaving(false);
    }
  }

  const fieldsDisabled = !editor.isEditing || saving;
  const form = editor.form;

  return (
    <>
      <PageHeader
        title="Services"
        description="Define platform services that products belong to."
        actions={
          <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={14} className="mr-1 inline" />
            New service
          </button>
        }
      />

      <div className="p-8">
        {error ? <p className="mb-4 text-sm text-[#df1b41]">{error}</p> : null}
        {success ? <p className="mb-4 text-sm text-[var(--color-accent)]">{success}</p> : null}

        {loading ? (
          <p className="text-sm text-[var(--color-text-muted)]">Loading services…</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <section className="panel overflow-hidden">
              <CatalogList
                items={listItems}
                selectedId={selectedId}
                onSelect={handleSelect}
                searchPlaceholder="Search services…"
                countLabel="service"
                emptyTitle="No services yet"
                emptyDescription="Create a service to get started."
              />
            </section>

            <section className="panel p-6">
              {!selected || !form ? (
                <EmptyState title="Select a service" description="Choose a service from the list to view its details." />
              ) : (
                <>
                  <CatalogDetailToolbar
                    title={selected.name}
                    subtitle={formatCatalogEnum(selected.type)}
                    isEditing={editor.isEditing}
                    isDirty={editor.isDirty}
                    saving={saving}
                    canSave={Boolean(form.name.trim())}
                    onEdit={editor.startEdit}
                    onCancel={editor.cancelEdit}
                    onSave={() => void handleSave()}
                    onDelete={() => setConfirmDelete(true)}
                    deleteDisabled={selected.productCount > 0}
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
                        <dt className={catalogLabelClass}>Type</dt>
                        <dd className="text-sm text-[var(--color-heading)]">{formatCatalogEnum(form.type)}</dd>
                      </div>
                      <div>
                        <dt className={catalogLabelClass}>Behaviour</dt>
                        <dd className="text-sm text-[var(--color-heading)]">{formatCatalogEnum(form.behaviour)}</dd>
                      </div>
                      <div>
                        <dt className={catalogLabelClass}>Products</dt>
                        <dd className="text-sm text-[var(--color-heading)]">{selected.productCount}</dd>
                      </div>
                      <div>
                        <dt className={catalogLabelClass}>Status</dt>
                        <dd className="text-sm text-[var(--color-heading)]">{formatCatalogEnum(form.status)}</dd>
                      </div>
                    </dl>
                  ) : (
                    <div className="grid gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className={catalogLabelClass}>Name</label>
                      <input
                        type="text"
                        value={form.name}
                        disabled={fieldsDisabled}
                        onChange={(e) => editor.setForm({ ...form, name: e.target.value })}
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
                      <label className={catalogLabelClass}>Type</label>
                      <select
                        value={form.type}
                        disabled={fieldsDisabled}
                        onChange={(e) =>
                          editor.setForm({ ...form, type: e.target.value as ServiceType })
                        }
                        className={catalogInputClass}>
                        {SERVICE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {formatCatalogEnum(type)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={catalogLabelClass}>Behaviour</label>
                      <select
                        value={form.behaviour}
                        disabled={fieldsDisabled}
                        onChange={(e) =>
                          editor.setForm({ ...form, behaviour: e.target.value as ServiceBehaviour })
                        }
                        className={catalogInputClass}>
                        {SERVICE_BEHAVIOURS.map((behaviour) => (
                          <option key={behaviour} value={behaviour}>
                            {formatCatalogEnum(behaviour)}
                          </option>
                        ))}
                      </select>
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
            <h3 className="text-lg font-semibold text-gray-900">New service</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={catalogLabelClass}>Name</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Service name"
                  className={catalogInputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={catalogLabelClass}>Description</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional"
                  rows={2}
                  className={catalogInputClass}
                />
              </div>
              <div>
                <label className={catalogLabelClass}>Type</label>
                <select
                  value={createForm.type}
                  onChange={(e) => setCreateForm((f) => ({ ...f, type: e.target.value as ServiceType }))}
                  className={catalogInputClass}>
                  {SERVICE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {formatCatalogEnum(type)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={catalogLabelClass}>Behaviour</label>
                <select
                  value={createForm.behaviour}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, behaviour: e.target.value as ServiceBehaviour }))
                  }
                  className={catalogInputClass}>
                  {SERVICE_BEHAVIOURS.map((behaviour) => (
                    <option key={behaviour} value={behaviour}>
                      {formatCatalogEnum(behaviour)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={catalogLabelClass}>Status</label>
                <select
                  value={createForm.status}
                  onChange={(e) => setCreateForm((f) => ({ ...f, status: e.target.value as CatalogStatus }))}
                  className={catalogInputClass}>
                  {CATALOG_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {formatCatalogEnum(status)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
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
        title="Delete service"
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
