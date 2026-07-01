import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PermissionMatrix } from '../../components/PermissionMatrix';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import {
  createRole,
  fetchPermissionsCatalog,
  fetchRole,
  fetchRoles,
  setRolePermissions,
  type PermissionsCatalog,
  type RoleSummary,
} from '../../lib/api';
import { getAdminToken } from '../../lib/auth-storage';

function setsEqual(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

export function RolesPage() {
  const { refreshUser } = useAdminAuth();
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [catalog, setCatalog] = useState<PermissionsCatalog | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');

  const token = getAdminToken();
  const permissionsDirty = useMemo(
    () => selectedRoleId !== null && !setsEqual(selectedIds, savedIds),
    [selectedRoleId, selectedIds, savedIds],
  );

  const loadRoles = useCallback(async () => {
    if (!token) return;
    setRoles(await fetchRoles(token));
  }, [token]);

  const loadCatalog = useCallback(async () => {
    if (!token) return;
    setCatalog(await fetchPermissionsCatalog(token));
  }, [token]);

  const loadRolePermissions = useCallback(
    async (roleId: string) => {
      if (!token) return;
      const detail = await fetchRole(token, roleId);
      const ids = new Set(detail.permissionIds);
      setSelectedIds(ids);
      setSavedIds(new Set(ids));
    },
    [token],
  );

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([loadRoles(), loadCatalog()])
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token, loadRoles, loadCatalog]);

  useEffect(() => {
    if (selectedRoleId) {
      loadRolePermissions(selectedRoleId).catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load role'),
      );
    } else {
      setSelectedIds(new Set());
      setSavedIds(new Set());
    }
  }, [selectedRoleId, loadRolePermissions]);

  async function handleCreate() {
    if (!token || !formName.trim()) return;
    setSaving(true);
    setError('');
    try {
      const created = await createRole(token, {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
      });
      await loadRoles();
      setShowForm(false);
      setFormName('');
      setFormDescription('');
      setSelectedRoleId(created.id);
      setSuccess(`Role "${created.name}" created`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create role');
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePermissions() {
    if (!token || !selectedRoleId || !permissionsDirty) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await setRolePermissions(token, selectedRoleId, [...selectedIds]);
      await Promise.all([loadRolePermissions(selectedRoleId), loadRoles(), refreshUser()]);
      setSuccess('Permissions saved. Access and menus have been updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save permissions');
    } finally {
      setSaving(false);
      setConfirmSave(false);
    }
  }

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  return (
    <>
      <PageHeader
        title="Roles"
        description="Define permission sets that can be assigned to user groups."
        actions={
          <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={14} className="mr-1 inline" />
            New role
          </button>
        }
      />

      <div className="p-8">
        {error ? <p className="mb-4 text-sm text-[#df1b41]">{error}</p> : null}
        {success ? <p className="mb-4 text-sm text-[var(--color-accent)]">{success}</p> : null}

        {loading ? (
          <p className="text-sm text-[var(--color-text-muted)]">Loading roles…</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <section className="panel overflow-hidden">
              {roles.length === 0 ? (
                <EmptyState title="No roles yet" description="Create a role to get started." />
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th>Perms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map((role) => (
                      <tr
                        key={role.id}
                        className={`clickable ${selectedRoleId === role.id ? 'bg-[var(--color-accent-soft)]' : ''}`}
                        onClick={() => setSelectedRoleId(role.id)}>
                        <td>
                          <div className="font-medium">{role.name}</div>
                          {role.description ? (
                            <div className="text-xs text-[var(--color-text-muted)]">{role.description}</div>
                          ) : null}
                        </td>
                        <td className="text-[var(--color-text-muted)]">{role.permissionCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="panel p-5">
              {!selectedRole ? (
                <EmptyState title="Select a role" description="Choose a role to edit its permissions." />
              ) : catalog ? (
                <>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-[var(--color-heading)]">
                        {selectedRole.name}
                      </h2>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {selectedRole.userCount} direct users · {selectedRole.groupCount} groups
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={!permissionsDirty || saving}
                      onClick={() => setConfirmSave(true)}>
                      Save permissions
                    </button>
                  </div>
                  <PermissionMatrix
                    modules={catalog.modules}
                    actions={catalog.actions}
                    moduleActions={catalog.moduleActions}
                    permissions={catalog.permissions}
                    selectedIds={selectedIds}
                    onChange={setSelectedIds}
                  />
                </>
              ) : null}
            </section>
          </div>
        )}
      </div>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">New role</h3>
            <div className="mt-4 space-y-3">
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Role name"
                className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              />
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={3}
                className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={saving || !formName.trim()}
                onClick={() => void handleCreate()}>
                {saving ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmSave}
        title="Save permissions"
        description={`Update permissions for "${selectedRole?.name}"? Users with this role must sign in again for changes to apply.`}
        confirmLabel="Save"
        loading={saving}
        onConfirm={() => void handleSavePermissions()}
        onCancel={() => setConfirmSave(false)}
      />
    </>
  );
}
