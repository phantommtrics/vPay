import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';

import { CatalogDetailToolbar } from '../../components/catalog/CatalogDetailToolbar';
import { CatalogList } from '../../components/catalog/CatalogList';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CursorPagination } from '../../components/ui/CursorPagination';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { useCatalogEditor } from '../../hooks/useCatalogEditor';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import {
  catalogInputClass,
  catalogLabelClass,
  formatCatalogEnum,
} from '../../lib/catalog-form';
import {
  createBusinessAccount,
  createBusinessEntity,
  deleteBusinessAccount,
  deleteBusinessEntity,
  fetchBusinessAccountTransactions,
  fetchBusinessAccounts,
  fetchBusinessEntities,
  updateBusinessAccount,
  updateBusinessEntity,
  type BusinessAccountPurpose,
  type BusinessAccountSummary,
  type BusinessAccountTransaction,
  type BusinessEntitySummary,
  type BusinessEntityType,
  type CatalogStatus,
} from '../../lib/api';
import { getAdminToken } from '../../lib/auth-storage';
import { currentMonthRange, type DateRange } from '../../lib/dateRange';

const ENTITY_TYPES: BusinessEntityType[] = ['VENDOR_INCOME'];
const ACCOUNT_PURPOSES: BusinessAccountPurpose[] = ['FEE_INCOME', 'FUND_HOLDING', 'SETTLEMENT', 'OTHER'];
const CATALOG_STATUSES: CatalogStatus[] = ['ACTIVE', 'INACTIVE'];

type EntityForm = {
  code: string;
  name: string;
  type: BusinessEntityType;
  description: string;
  status: CatalogStatus;
};

type AccountForm = {
  code: string;
  name: string;
  currency: string;
  purpose: BusinessAccountPurpose;
  status: CatalogStatus;
};

function emptyEntityForm(): EntityForm {
  return {
    code: '',
    name: '',
    type: 'VENDOR_INCOME',
    description: '',
    status: 'ACTIVE',
  };
}

function entityToForm(entity: BusinessEntitySummary): EntityForm {
  return {
    code: entity.code,
    name: entity.name,
    type: entity.type,
    description: entity.description ?? '',
    status: entity.status,
  };
}

function emptyAccountForm(): AccountForm {
  return {
    code: '',
    name: '',
    currency: 'GMD',
    purpose: 'FEE_INCOME',
    status: 'ACTIVE',
  };
}

function accountToForm(account: BusinessAccountSummary): AccountForm {
  return {
    code: account.code,
    name: account.name,
    currency: account.currency,
    purpose: account.purpose,
    status: account.status,
  };
}

function formatGmd(amount: number) {
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} GMD`;
}

function AccountTransactionsPanel({
  accountId,
}: {
  accountId: string;
}) {
  const token = getAdminToken();
  const [draftRange, setDraftRange] = useState<DateRange>(currentMonthRange());
  const [appliedRange, setAppliedRange] = useState<DateRange>(currentMonthRange());
  const [limit, setLimit] = useState(25);
  const dateFilterKey = `${accountId}:${appliedRange.startDate}:${appliedRange.endDate}`;

  const fetchTransactions = useCallback(
    async (params: { cursor?: string; limit: number }) => {
      if (!token) return { items: [] as BusinessAccountTransaction[], nextCursor: null };
      const result = await fetchBusinessAccountTransactions(token, accountId, {
        ...params,
        startDate: appliedRange.startDate,
        endDate: appliedRange.endDate,
      });
      return { items: result.items, nextCursor: result.nextCursor };
    },
    [token, accountId, appliedRange.startDate, appliedRange.endDate],
  );

  const pager = useCursorPagination(
    fetchTransactions,
    limit,
    `account-tx-${limit}-${dateFilterKey}`,
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <h4 className="w-full text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Recent transactions
        </h4>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">From</label>
          <input
            type="date"
            className="rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm"
            value={draftRange.startDate}
            onChange={(e) => setDraftRange((r) => ({ ...r, startDate: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">To</label>
          <input
            type="date"
            className="rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm"
            value={draftRange.endDate}
            onChange={(e) => setDraftRange((r) => ({ ...r, endDate: e.target.value }))}
          />
        </div>
        <button type="button" className="btn-secondary text-sm" onClick={() => setDraftRange(currentMonthRange())}>
          This month
        </button>
        <button type="button" className="btn-primary text-sm" onClick={() => setAppliedRange(draftRange)}>
          Apply
        </button>
        <div className="ml-auto">
          <label className="mr-2 text-xs text-[var(--color-text-muted)]">Per page</label>
          <select
            className="rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}>
            {[25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
      {pager.error ? <p className="text-sm text-red-600">{pager.error}</p> : null}
      {pager.loading && pager.items.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading transactions…</p>
      ) : pager.items.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">No transactions in this period.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Balance</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {pager.items.map((tx) => (
                  <tr key={tx.id}>
                    <td>{new Date(tx.createdAt).toLocaleString()}</td>
                    <td>{formatCatalogEnum(tx.type)}</td>
                    <td>{formatGmd(tx.amount)}</td>
                    <td>{formatGmd(tx.balanceAfter)}</td>
                    <td className="text-xs text-[var(--color-text-muted)]">
                      {tx.referenceType}:{tx.referenceId.slice(0, 8)}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CursorPagination
            canGoBack={pager.canGoBack}
            canGoForward={pager.canGoForward}
            onPrev={pager.goPrev}
            onNext={pager.goNext}
            itemCount={pager.items.length}
            loading={pager.loading}
          />
        </>
      )}
    </div>
  );
}

export function BusinessEntitiesPage() {
  const [entities, setEntities] = useState<BusinessEntitySummary[]>([]);
  const [accounts, setAccounts] = useState<BusinessAccountSummary[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showEntityForm, setShowEntityForm] = useState(false);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [confirmDeleteEntity, setConfirmDeleteEntity] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [createEntityForm, setCreateEntityForm] = useState<EntityForm>(emptyEntityForm());
  const [createAccountForm, setCreateAccountForm] = useState<AccountForm>(emptyAccountForm());

  const token = getAdminToken();
  const selectedEntity = entities.find((e) => e.id === selectedEntityId);
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  const entityEditor = useCatalogEditor<EntityForm>(selectedEntityId, (item) =>
    entityToForm(item as BusinessEntitySummary),
  );

  const accountEditor = useCatalogEditor<AccountForm>(selectedAccountId, (item) =>
    accountToForm(item as BusinessAccountSummary),
  );

  const entityListItems = useMemo(
    () =>
      entities.map((entity) => ({
        id: entity.id,
        title: entity.name,
        subtitle: `${formatCatalogEnum(entity.type)} · ${entity.accountCount} account${entity.accountCount === 1 ? '' : 's'}`,
        status: entity.status,
      })),
    [entities],
  );

  const loadEntities = useCallback(async () => {
    if (!token) return;
    const rows = await fetchBusinessEntities(token);
    setEntities(rows);
    if (rows.length > 0 && !selectedEntityId) {
      setSelectedEntityId(rows[0].id);
    }
  }, [token, selectedEntityId]);

  const loadAccounts = useCallback(async () => {
    if (!token || !selectedEntityId) {
      setAccounts([]);
      return;
    }
    const rows = await fetchBusinessAccounts(token, { entityId: selectedEntityId });
    setAccounts(rows);
    if (rows.length > 0 && !rows.some((a) => a.id === selectedAccountId)) {
      setSelectedAccountId(rows[0].id);
    } else if (rows.length === 0) {
      setSelectedAccountId(null);
    }
  }, [token, selectedEntityId, selectedAccountId]);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      await loadEntities();
      await loadAccounts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load business entities');
    } finally {
      setLoading(false);
    }
  }, [token, loadEntities, loadAccounts]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (selectedEntity) {
      entityEditor.resetFromItem(selectedEntity);
    }
  }, [selectedEntity]);

  useEffect(() => {
    if (selectedAccount) {
      accountEditor.resetFromItem(selectedAccount);
    }
  }, [selectedAccount]);

  async function handleCreateEntity() {
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      const created = await createBusinessEntity(token, {
        code: createEntityForm.code.trim().toLowerCase(),
        name: createEntityForm.name.trim(),
        type: createEntityForm.type,
        description: createEntityForm.description.trim() || undefined,
        status: createEntityForm.status,
      });
      setShowEntityForm(false);
      setCreateEntityForm(emptyEntityForm());
      setSuccess('Business entity created');
      setSelectedEntityId(created.id);
      await loadEntities();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create entity');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEntity() {
    if (!token || !selectedEntityId || !entityEditor.form) return;
    setSaving(true);
    setError('');
    try {
      await updateBusinessEntity(token, selectedEntityId, {
        code: entityEditor.form.code.trim().toLowerCase(),
        name: entityEditor.form.name.trim(),
        type: entityEditor.form.type,
        description: entityEditor.form.description.trim() || null,
        status: entityEditor.form.status,
      });
      entityEditor.commitSaved(entityEditor.form!);
      setSuccess('Business entity updated');
      await loadEntities();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update entity');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEntity() {
    if (!token || !selectedEntityId) return;
    setSaving(true);
    setError('');
    try {
      await deleteBusinessEntity(token, selectedEntityId);
      setConfirmDeleteEntity(false);
      setSelectedEntityId(null);
      setSuccess('Business entity deleted');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete entity');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateAccount() {
    if (!token || !selectedEntityId) return;
    setSaving(true);
    setError('');
    try {
      const created = await createBusinessAccount(token, {
        entityId: selectedEntityId,
        code: createAccountForm.code.trim().toLowerCase(),
        name: createAccountForm.name.trim(),
        currency: createAccountForm.currency.trim().toUpperCase(),
        purpose: createAccountForm.purpose,
        status: createAccountForm.status,
      });
      setShowAccountForm(false);
      setCreateAccountForm(emptyAccountForm());
      setSuccess('Business account created');
      setSelectedAccountId(created.id);
      await loadEntities();
      await loadAccounts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create account');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAccount() {
    if (!token || !selectedAccountId || !accountEditor.form) return;
    setSaving(true);
    setError('');
    try {
      await updateBusinessAccount(token, selectedAccountId, {
        code: accountEditor.form.code.trim().toLowerCase(),
        name: accountEditor.form.name.trim(),
        currency: accountEditor.form.currency.trim().toUpperCase(),
        purpose: accountEditor.form.purpose,
        status: accountEditor.form.status,
      });
      accountEditor.commitSaved(accountEditor.form!);
      setSuccess('Business account updated');
      await loadAccounts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update account');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (!token || !selectedAccountId) return;
    setSaving(true);
    setError('');
    try {
      await deleteBusinessAccount(token, selectedAccountId);
      setConfirmDeleteAccount(false);
      setSelectedAccountId(null);
      setSuccess('Business account deleted');
      await loadEntities();
      await loadAccounts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete account');
    } finally {
      setSaving(false);
    }
  }

  const entityForm = entityEditor.form;
  const accountForm = accountEditor.form;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business entities"
        description="Vendor income entities and internal ledger wallets for fee recognition and fund routing."
        actions={
          <button type="button" className="btn-primary" onClick={() => setShowEntityForm(true)}>
            <Plus className="h-4 w-4" />
            New entity
          </button>
        }
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? (
        <p className="text-sm text-green-700" onAnimationEnd={() => setSuccess('')}>
          {success}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <CatalogList
          items={entityListItems}
          selectedId={selectedEntityId}
          emptyTitle="No business entities"
          emptyDescription="Create a vendor income entity to start routing fees and funds."
          onSelect={(id) => {
            setSelectedEntityId(id);
            setSelectedAccountId(null);
          }}
        />

        <div className="space-y-6">
          {selectedEntity && entityForm ? (
            <section className="panel p-6">
              <CatalogDetailToolbar
                title={selectedEntity.name}
                subtitle={selectedEntity.code}
                isEditing={entityEditor.isEditing}
                isDirty={entityEditor.isDirty}
                saving={saving}
                canSave={Boolean(entityForm?.name.trim())}
                onEdit={entityEditor.startEdit}
                onCancel={entityEditor.cancelEdit}
                onSave={() => void handleSaveEntity()}
                onDelete={() => setConfirmDeleteEntity(true)}
              />

              <div className="mt-4">
                {entityEditor.isEditing ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={catalogLabelClass}>Code</label>
                      <input
                        className={catalogInputClass}
                        value={entityForm.code}
                        onChange={(e) => entityEditor.setForm({ ...entityForm, code: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={catalogLabelClass}>Name</label>
                      <input
                        className={catalogInputClass}
                        value={entityForm.name}
                        onChange={(e) => entityEditor.setForm({ ...entityForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={catalogLabelClass}>Type</label>
                      <select
                        className={catalogInputClass}
                        value={entityForm.type}
                        onChange={(e) =>
                          entityEditor.setForm({
                            ...entityForm,
                            type: e.target.value as BusinessEntityType,
                          })
                        }>
                        {ENTITY_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {formatCatalogEnum(type)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={catalogLabelClass}>Status</label>
                      <select
                        className={catalogInputClass}
                        value={entityForm.status}
                        onChange={(e) =>
                          entityEditor.setForm({
                            ...entityForm,
                            status: e.target.value as CatalogStatus,
                          })
                        }>
                        {CATALOG_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {formatCatalogEnum(status)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className={catalogLabelClass}>Description</label>
                      <textarea
                        className={catalogInputClass}
                        rows={2}
                        value={entityForm.description}
                        onChange={(e) =>
                          entityEditor.setForm({ ...entityForm, description: e.target.value })
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className={catalogLabelClass}>Code</dt>
                      <dd className="text-sm text-[var(--color-heading)]">{selectedEntity.code}</dd>
                    </div>
                    <div>
                      <dt className={catalogLabelClass}>Type</dt>
                      <dd className="text-sm text-[var(--color-heading)]">
                        {formatCatalogEnum(selectedEntity.type)}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className={catalogLabelClass}>Description</dt>
                      <dd className="text-sm text-[var(--color-heading)]">
                        {selectedEntity.description || '—'}
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
            </section>
          ) : (
            <EmptyState title="Select an entity" description="Choose a business entity from the list." />
          )}

          {selectedEntity ? (
            <section className="panel">
              <div className="panel-header">
                <h2 className="text-sm font-semibold text-[var(--color-heading)]">Accounts / wallets</h2>
                <button type="button" className="btn-secondary" onClick={() => setShowAccountForm(true)}>
                  <Plus className="h-4 w-4" />
                  New account
                </button>
              </div>
              <div className="panel-body space-y-4">
                {accounts.length === 0 ? (
                  <EmptyState
                    title="No accounts"
                    description="Add wallets under this entity for fee income or fund holding."
                  />
                ) : (
                  <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="space-y-1">
                      {accounts.map((account) => (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => {
                            setSelectedAccountId(account.id);
                            accountEditor.cancel();
                          }}
                          className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                            selectedAccountId === account.id
                              ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                              : 'hover:bg-[var(--color-canvas-subtle)] text-[var(--color-text)]'
                          }`}>
                          <div className="font-medium">{account.name}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">
                            {formatCatalogEnum(account.purpose)} · {formatGmd(account.balance)}
                          </div>
                        </button>
                      ))}
                    </div>

                    {selectedAccount && accountForm ? (
                      <div className="space-y-4">
                        <CatalogDetailToolbar
                            title={selectedAccount.name}
                            subtitle={`${selectedAccount.code} · ${formatGmd(selectedAccount.balance)}`}
                            isEditing={accountEditor.isEditing}
                            isDirty={accountEditor.isDirty}
                            saving={saving}
                            canSave={Boolean(accountForm?.name.trim())}
                            onEdit={accountEditor.startEdit}
                            onCancel={accountEditor.cancelEdit}
                            onSave={() => void handleSaveAccount()}
                            onDelete={() => setConfirmDeleteAccount(true)}
                          />

                        {accountEditor.isEditing ? (
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <label className={catalogLabelClass}>Code</label>
                              <input
                                className={catalogInputClass}
                                value={accountForm.code}
                                onChange={(e) =>
                                  accountEditor.setForm({ ...accountForm, code: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <label className={catalogLabelClass}>Name</label>
                              <input
                                className={catalogInputClass}
                                value={accountForm.name}
                                onChange={(e) =>
                                  accountEditor.setForm({ ...accountForm, name: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <label className={catalogLabelClass}>Currency</label>
                              <input
                                className={catalogInputClass}
                                value={accountForm.currency}
                                onChange={(e) =>
                                  accountEditor.setForm({ ...accountForm, currency: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <label className={catalogLabelClass}>Purpose</label>
                              <select
                                className={catalogInputClass}
                                value={accountForm.purpose}
                                onChange={(e) =>
                                  accountEditor.setForm({
                                    ...accountForm,
                                    purpose: e.target.value as BusinessAccountPurpose,
                                  })
                                }>
                                {ACCOUNT_PURPOSES.map((purpose) => (
                                  <option key={purpose} value={purpose}>
                                    {formatCatalogEnum(purpose)}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className={catalogLabelClass}>Status</label>
                              <select
                                className={catalogInputClass}
                                value={accountForm.status}
                                onChange={(e) =>
                                  accountEditor.setForm({
                                    ...accountForm,
                                    status: e.target.value as CatalogStatus,
                                  })
                                }>
                                {CATALOG_STATUSES.map((status) => (
                                  <option key={status} value={status}>
                                    {formatCatalogEnum(status)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ) : (
                          <dl className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <dt className={catalogLabelClass}>Balance</dt>
                              <dd className="text-sm font-medium text-[var(--color-heading)]">
                                {formatGmd(selectedAccount.balance)}
                              </dd>
                            </div>
                            <div>
                              <dt className={catalogLabelClass}>Purpose</dt>
                              <dd className="text-sm text-[var(--color-heading)]">
                                {formatCatalogEnum(selectedAccount.purpose)}
                              </dd>
                            </div>
                            <div>
                              <dt className={catalogLabelClass}>Code</dt>
                              <dd className="text-sm text-[var(--color-heading)]">{selectedAccount.code}</dd>
                            </div>
                            <div>
                              <dt className={catalogLabelClass}>Currency</dt>
                              <dd className="text-sm text-[var(--color-heading)]">{selectedAccount.currency}</dd>
                            </div>
                          </dl>
                        )}

                        <AccountTransactionsPanel accountId={selectedAccount.id} />
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {showEntityForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="panel w-full max-w-lg">
            <div className="panel-header">
              <h2 className="text-sm font-semibold text-[var(--color-heading)]">New business entity</h2>
            </div>
            <div className="panel-body space-y-4">
              <div>
                <label className={catalogLabelClass}>Code</label>
                <input
                  className={catalogInputClass}
                  value={createEntityForm.code}
                  onChange={(e) => setCreateEntityForm({ ...createEntityForm, code: e.target.value })}
                />
              </div>
              <div>
                <label className={catalogLabelClass}>Name</label>
                <input
                  className={catalogInputClass}
                  value={createEntityForm.name}
                  onChange={(e) => setCreateEntityForm({ ...createEntityForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className={catalogLabelClass}>Type</label>
                <select
                  className={catalogInputClass}
                  value={createEntityForm.type}
                  onChange={(e) =>
                    setCreateEntityForm({
                      ...createEntityForm,
                      type: e.target.value as BusinessEntityType,
                    })
                  }>
                  {ENTITY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {formatCatalogEnum(type)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={catalogLabelClass}>Description</label>
                <textarea
                  className={catalogInputClass}
                  rows={2}
                  value={createEntityForm.description}
                  onChange={(e) =>
                    setCreateEntityForm({ ...createEntityForm, description: e.target.value })
                  }
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setShowEntityForm(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={saving}
                  onClick={() => void handleCreateEntity()}>
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showAccountForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="panel w-full max-w-lg">
            <div className="panel-header">
              <h2 className="text-sm font-semibold text-[var(--color-heading)]">New account</h2>
            </div>
            <div className="panel-body space-y-4">
              <div>
                <label className={catalogLabelClass}>Code</label>
                <input
                  className={catalogInputClass}
                  value={createAccountForm.code}
                  onChange={(e) => setCreateAccountForm({ ...createAccountForm, code: e.target.value })}
                />
              </div>
              <div>
                <label className={catalogLabelClass}>Name</label>
                <input
                  className={catalogInputClass}
                  value={createAccountForm.name}
                  onChange={(e) => setCreateAccountForm({ ...createAccountForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className={catalogLabelClass}>Currency</label>
                <input
                  className={catalogInputClass}
                  value={createAccountForm.currency}
                  onChange={(e) =>
                    setCreateAccountForm({ ...createAccountForm, currency: e.target.value })
                  }
                />
              </div>
              <div>
                <label className={catalogLabelClass}>Purpose</label>
                <select
                  className={catalogInputClass}
                  value={createAccountForm.purpose}
                  onChange={(e) =>
                    setCreateAccountForm({
                      ...createAccountForm,
                      purpose: e.target.value as BusinessAccountPurpose,
                    })
                  }>
                  {ACCOUNT_PURPOSES.map((purpose) => (
                    <option key={purpose} value={purpose}>
                      {formatCatalogEnum(purpose)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setShowAccountForm(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={saving}
                  onClick={() => void handleCreateAccount()}>
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDeleteEntity}
        title="Delete business entity?"
        description="Only entities without accounts can be deleted."
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDeleteEntity()}
        onCancel={() => setConfirmDeleteEntity(false)}
      />

      <ConfirmDialog
        open={confirmDeleteAccount}
        title="Delete business account?"
        description="Accounts with transactions or routing references cannot be deleted."
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDeleteAccount()}
        onCancel={() => setConfirmDeleteAccount(false)}
      />
    </div>
  );
}
