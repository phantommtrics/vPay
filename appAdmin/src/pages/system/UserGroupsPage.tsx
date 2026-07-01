import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  createGroup,
  deleteGroup,
  fetchGroups,
  fetchRoles,
  updateGroup,
  type GroupSummary,
  type RoleSummary,
} from '../../lib/api';
import { getAdminToken } from '../../lib/auth-storage';

export function UserGroupsPage() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formRoleId, setFormRoleId] = useState('');

  const token = getAdminToken();
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  const loadData = useCallback(async () => {
    if (!token) return;
    const [groupList, roleList] = await Promise.all([fetchGroups(token), fetchRoles(token)]);
    setGroups(groupList);
    setRoles(roleList);
    return roleList;
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    loadData()
      .then((roleList) => {
        if (roleList?.[0]) {
          setFormRoleId((current) => current || roleList[0].id);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token, loadData]);

  async function handleCreate() {
    if (!token || !formName.trim() || !formRoleId) return;
    setSaving(true);
    setError('');
    try {
      const created = await createGroup(token, {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        roleId: formRoleId,
      });
      await loadData();
      setShowForm(false);
      setFormName('');
      setFormDescription('');
      setSelectedGroupId(created.id);
      setSuccess(`Group "${created.name}" created`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(roleId: string) {
    if (!token || !selectedGroupId) return;
    const current = groups.find((g) => g.id === selectedGroupId);
    if (current?.roleId === roleId) return;
    setSaving(true);
    setError('');
    try {
      await updateGroup(token, selectedGroupId, { roleId });
      await loadData();
      setSuccess('Group role updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update group');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!token || !selectedGroupId) return;
    setSaving(true);
    setError('');
    try {
      await deleteGroup(token, selectedGroupId);
      setSelectedGroupId(null);
      setConfirmDelete(false);
      await loadData();
      setSuccess('Group deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete group');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="User groups"
        description="Bundle roles into groups and assign operators to them."
        actions={
          <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={14} className="mr-1 inline" />
            New group
          </button>
        }
      />

      <div className="p-8">
        {error ? <p className="mb-4 text-sm text-[#df1b41]">{error}</p> : null}
        {success ? <p className="mb-4 text-sm text-[var(--color-accent)]">{success}</p> : null}

        {loading ? (
          <p className="text-sm text-[var(--color-text-muted)]">Loading groups…</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <section className="panel overflow-hidden">
              {groups.length === 0 ? (
                <EmptyState title="No groups yet" description="Create a group to assign roles." />
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Group</th>
                      <th>Members</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => (
                      <tr
                        key={group.id}
                        className={`clickable ${selectedGroupId === group.id ? 'bg-[var(--color-accent-soft)]' : ''}`}
                        onClick={() => setSelectedGroupId(group.id)}>
                        <td>
                          <div className="font-medium">{group.name}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">
                            {group.role?.name ?? '—'}
                          </div>
                        </td>
                        <td className="text-[var(--color-text-muted)]">{group.memberCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="panel p-5">
              {!selectedGroup ? (
                <EmptyState title="Select a group" description="Choose a group to view or edit its role." />
              ) : (
                <>
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-[var(--color-heading)]">
                        {selectedGroup.name}
                      </h2>
                      {selectedGroup.description ? (
                        <p className="text-sm text-[var(--color-text-muted)]">{selectedGroup.description}</p>
                      ) : null}
                    </div>
                    {selectedGroup.memberCount === 0 ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-[#df1b41] hover:bg-red-50"
                        onClick={() => setConfirmDelete(true)}>
                        <Trash2 size={14} />
                        Delete
                      </button>
                    ) : null}
                  </div>

                  <label className="mb-1.5 block text-sm font-medium text-[var(--color-heading)]">
                    Assigned role
                  </label>
                  <select
                    value={selectedGroup.roleId}
                    disabled={saving}
                    onChange={(e) => void handleRoleChange(e.target.value)}
                    className="w-full max-w-sm rounded-md border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]">
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                    {selectedGroup.memberCount} operator(s) inherit permissions from this role.
                  </p>
                </>
              )}
            </section>
          </div>
        )}
      </div>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">New user group</h3>
            <div className="mt-4 space-y-3">
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Group name"
                className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              />
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              />
              <select
                value={formRoleId}
                onChange={(e) => setFormRoleId(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]">
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={saving || !formName.trim() || !formRoleId}
                onClick={() => void handleCreate()}>
                {saving ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete group"
        description={`Delete "${selectedGroup?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={saving}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
