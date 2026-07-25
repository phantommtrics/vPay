import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Smartphone } from 'lucide-react';

import { PageHeader } from '../../components/ui/PageHeader';
import { CopyId } from '../../components/ui/CopyId';
import { EmptyState } from '../../components/ui/EmptyState';
import { fetchCustomerDeviceGroups, type CustomerDeviceGroupSummary } from '../../lib/api';
import { getAdminToken } from '../../lib/auth-storage';
import { formatDate, formatDeviceLabel } from '../../lib/format';

function deviceGroupPath(group: CustomerDeviceGroupSummary): string {
  return `/device-info/customer-devices/${group.groupType}/${encodeURIComponent(group.groupKey)}`;
}

export function CustomerDevicesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [groups, setGroups] = useState<CustomerDeviceGroupSummary[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (searchValue: string, pageValue: number) => {
    const token = getAdminToken();
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const result = await fetchCustomerDeviceGroups(token, {
        search: searchValue.trim() || undefined,
        page: pageValue,
        limit: 25,
      });
      setGroups(result.groups);
      setPage(result.pagination.page);
      setTotalPages(result.pagination.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load devices');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load('', 1);
  }, [load]);

  const runSearch = () => {
    void load(search, 1);
  };

  return (
    <>
      <PageHeader
        title="Customer devices"
        description="Unique devices linked to customer accounts. Search by device ID or hardware ID."
        breadcrumb="Device info"
      />

      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-4">
        <div className="flex max-w-xl gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder="Search by device ID or hardware ID"
              className="w-full rounded-md border border-[var(--color-border)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent-soft)]"
            />
          </div>
          <button type="button" className="btn-primary" disabled={loading} onClick={runSearch}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-[#df1b41]">{error}</p> : null}
      </div>

      <div className="p-8">
        <section className="panel overflow-hidden">
          {loading && groups.length === 0 ? (
            <p className="p-6 text-sm text-[var(--color-text-muted)]">Loading devices…</p>
          ) : groups.length === 0 ? (
            <EmptyState
              title="No devices found"
              description="Try a different device ID or hardware ID."
            />
          ) : (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Hardware ID</th>
                    <th>OS</th>
                    <th>Users</th>
                    <th>Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <tr
                      key={`${group.groupType}:${group.groupKey}`}
                      className="clickable"
                      onClick={() => navigate(deviceGroupPath(group))}>
                      <td>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-md bg-[var(--color-canvas-subtle)] p-2 text-[var(--color-text-muted)]">
                            <Smartphone size={16} />
                          </div>
                          <div className="space-y-1">
                            <p className="font-medium text-[var(--color-heading)]">
                              {formatDeviceLabel(group)}
                              {group.isEmulator ? (
                                <span className="ml-2 text-xs text-[#df1b41]">Emulator</span>
                              ) : null}
                            </p>
                            <CopyId value={group.representativeDeviceId} />
                            {group.groupType === 'hardware' ? (
                              <p className="text-xs text-[var(--color-text-muted)]">
                                Grouped by hardware ID
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="font-mono text-xs text-[var(--color-text-muted)]">
                        {group.hardwareId ?? '—'}
                      </td>
                      <td className="text-[var(--color-text-muted)]">
                        {[group.osName, group.osVersion].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td>
                        <span
                          className={`inline-flex min-w-8 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            group.userCount > 1
                              ? 'bg-[#fff5f7] text-[#df1b41]'
                              : 'bg-[var(--color-canvas-subtle)] text-[var(--color-heading)]'
                          }`}>
                          {group.userCount}
                        </span>
                      </td>
                      <td className="text-[var(--color-text-muted)]">{formatDate(group.lastSeenAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {totalPages > 1 ? (
                <div className="flex items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-canvas-subtle)] px-4 py-3">
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={loading || page <= 1}
                      onClick={() => void load(search, page - 1)}>
                      Previous
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={loading || page >= totalPages}
                      onClick={() => void load(search, page + 1)}>
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </>
  );
}
