import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, UserPlus } from 'lucide-react';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { GroupCheckboxList } from '../../components/GroupCheckboxList';
import { Badge } from '../../components/ui/Badge';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  assignOperator,
  disableOperator,
  enableOperator,
  fetchGroups,
  fetchOperators,
  revokeOperator,
  searchOperatorCandidates,
  updateOperator,
  type GroupSummary,
  type OperatorCandidate,
  type OperatorSummary,
} from '../../lib/api';
import { getAdminToken } from '../../lib/auth-storage';
import { formatName } from '../../lib/format';

export function OperatorsPage() {
  const [operators, setOperators] = useState<OperatorSummary[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAssign, setShowAssign] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [candidates, setCandidates] = useState<OperatorCandidate[]>([]);
  const [selectedUser, setSelectedUser] = useState<OperatorCandidate | null>(null);
  const [assignGroupIds, setAssignGroupIds] = useState<string[]>([]);
  const [editingOperator, setEditingOperator] = useState<OperatorSummary | null>(null);
  const [editGroupIds, setEditGroupIds] = useState<string[]>([]);
  const [pendingRevoke, setPendingRevoke] = useState<OperatorSummary | null>(null);

  const token = getAdminToken();

  const loadData = useCallback(async () => {
    if (!token) return;
    const [opList, groupList] = await Promise.all([fetchOperators(token), fetchGroups(token)]);
    setOperators(opList);
    setGroups(groupList);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    loadData()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token, loadData]);

  useEffect(() => {
    if (!token || !showAssign || searchQuery.trim().length < 2) {
      setCandidates([]);
      return;
    }
    const timer = setTimeout(() => {
      searchOperatorCandidates(token, searchQuery.trim())
        .then(({ users }) => setCandidates(users))
        .catch(() => setCandidates([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [token, showAssign, searchQuery]);

  const editGroupsDirty = useMemo(() => {
    if (!editingOperator) return false;
    const current = [...editingOperator.groups.map((g) => g.id)].sort().join(',');
    const next = [...editGroupIds].sort().join(',');
    return current !== next;
  }, [editingOperator, editGroupIds]);

  function openAssign() {
    setShowAssign(true);
    setSearchQuery('');
    setCandidates([]);
    setSelectedUser(null);
    setAssignGroupIds([]);
    setError('');
  }

  function selectCandidate(candidate: OperatorCandidate) {
    if (candidate.isAdmin && candidate.adminUserType === 'OWNER') {
      setError('Cannot assign operator access to an owner account');
      return;
    }
    setSelectedUser(candidate);
    setSearchQuery(candidate.email);
    setCandidates([]);
    setError('');
  }

  async function handleAssign() {
    if (!token || !selectedUser || assignGroupIds.length === 0) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const created = await assignOperator(token, {
        userId: selectedUser.id,
        groupIds: assignGroupIds,
      });
      setSuccess(
        `${formatName(created.firstName, created.lastName, created.email)} now has admin operator access.`,
      );
      setShowAssign(false);
      setSelectedUser(null);
      setAssignGroupIds([]);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign operator');
    } finally {
      setSaving(false);
    }
  }

  async function saveGroupChanges() {
    if (!token || !editingOperator || editGroupIds.length === 0) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await updateOperator(token, editingOperator.id, { groupIds: editGroupIds });
      setSuccess(
        `Groups updated for ${formatName(editingOperator.firstName, editingOperator.lastName, editingOperator.email)}. They must sign in again for new permissions.`,
      );
      setEditingOperator(null);
      setEditGroupIds([]);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update groups');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(operator: OperatorSummary) {
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      if (operator.status === 'ACTIVE') {
        await disableOperator(token, operator.id);
        setSuccess(`${operator.email} disabled`);
      } else {
        await enableOperator(token, operator.id);
        setSuccess(`${operator.email} enabled`);
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke() {
    if (!token || !pendingRevoke) return;
    setSaving(true);
    setError('');
    try {
      await revokeOperator(token, pendingRevoke.id);
      setSuccess(`Admin access revoked for ${pendingRevoke.email}`);
      setPendingRevoke(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke access');
    } finally {
      setSaving(false);
    }
  }


  const groupOptions = useMemo(
    () =>
      groups.map((group) => ({
        id: group.id,
        name: group.name,
        roleName: group.role?.name ?? 'Unknown role',
        description: group.description,
        memberCount: group.memberCount,
      })),
    [groups],
  );

  return (
    <>
      <PageHeader
        title="Operators"
        description="Grant admin portal access to existing vPay users via user groups."
        actions={
          <button type="button" className="btn-primary" onClick={openAssign}>
            <UserPlus size={14} className="mr-1 inline" />
            Assign operator
          </button>
        }
      />

      <div className="p-8">
        {error ? <p className="mb-4 text-sm text-[#df1b41]">{error}</p> : null}
        {success ? <p className="mb-4 text-sm text-[var(--color-accent)]">{success}</p> : null}

        {loading ? (
          <p className="text-sm text-[var(--color-text-muted)]">Loading operators…</p>
        ) : operators.length === 0 ? (
          <EmptyState
            title="No operators yet"
            description="Search for an existing customer and assign them to a user group."
            action={
              <button type="button" className="btn-primary" onClick={openAssign}>
                <Plus size={14} className="mr-1 inline" />
                Assign operator
              </button>
            }
          />
        ) : (
          <section className="panel overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Groups</th>
                  <th>Status</th>
                  <th>TOTP</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {operators.map((operator) => (
                  <tr key={operator.id}>
                    <td>
                      <div className="font-medium">
                        {formatName(operator.firstName, operator.lastName, operator.email)}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">{operator.email}</div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {operator.groups.map((g) => (
                          <span
                            key={g.id}
                            className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-canvas-subtle)] px-2 py-0.5 text-xs text-[var(--color-text)]">
                            {g.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <Badge status={operator.status === 'ACTIVE' ? 'active' : 'inactive'} />
                    </td>
                    <td className="text-[var(--color-text-muted)]">
                      {operator.totpEnrolled ? 'Enrolled' : 'Pending'}
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="btn-secondary text-xs"
                          onClick={() => {
                            setEditingOperator(operator);
                            setEditGroupIds(operator.groups.map((g) => g.id));
                          }}>
                          Change groups
                        </button>
                        <button
                          type="button"
                          className="btn-secondary text-xs"
                          disabled={saving}
                          onClick={() => void handleToggleStatus(operator)}>
                          {operator.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          className="text-xs text-[#df1b41] hover:underline"
                          onClick={() => setPendingRevoke(operator)}>
                          Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>

      {showAssign ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Assign operator access</h3>
            <p className="mt-1 text-sm text-gray-600">
              Search for an existing vPay user. No new account is created.
            </p>

            <div className="relative mt-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedUser(null);
                }}
                placeholder="Search by email or name"
                className="w-full rounded-md border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
              />
              {candidates.length > 0 ? (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
                  {candidates.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                      onClick={() => selectCandidate(c)}>
                      <div className="font-medium">
                        {formatName(c.firstName, c.lastName, c.email)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {c.email}
                        {c.isAdmin ? ` · ${c.adminUserType ?? 'admin'}` : ''}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {selectedUser ? (
              <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Selected: {formatName(selectedUser.firstName, selectedUser.lastName, selectedUser.email)} (
                {selectedUser.email})
              </div>
            ) : null}

            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-gray-900">User groups</p>
              <GroupCheckboxList
                groups={groupOptions}
                selectedIds={assignGroupIds}
                onChange={setAssignGroupIds}
                disabled={saving}
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShowAssign(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={saving || !selectedUser || assignGroupIds.length === 0}
                onClick={() => void handleAssign()}>
                {saving ? 'Assigning…' : 'Assign access'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingOperator ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Change groups</h3>
            <p className="mt-1 text-sm text-gray-600">{editingOperator.email}</p>
            <div className="mt-4">
              <GroupCheckboxList
                groups={groupOptions}
                selectedIds={editGroupIds}
                onChange={setEditGroupIds}
                disabled={saving}
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setEditingOperator(null);
                  setEditGroupIds([]);
                }}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={saving || editGroupIds.length === 0 || !editGroupsDirty}
                onClick={() => void saveGroupChanges()}>
                {saving ? 'Saving…' : 'Save groups'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingRevoke)}
        title="Revoke operator access"
        description={`Remove admin portal access for ${pendingRevoke?.email}? Their customer account will remain.`}
        confirmLabel="Revoke"
        destructive
        loading={saving}
        onConfirm={() => void handleRevoke()}
        onCancel={() => setPendingRevoke(null)}
      />
    </>
  );
}
