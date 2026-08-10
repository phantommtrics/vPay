import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarRange, Search } from 'lucide-react';

import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { fetchAdminUsers, lookupAdminUser, type AdminUserSummary } from '../lib/api';
import { getAdminToken } from '../lib/auth-storage';
import {
  currentMonthRange,
  formatDateRangeLabel,
  todayRange,
  type DateRange,
} from '../lib/dateRange';
import { formatName } from '../lib/format';

/** Join day in UTC — matches startDate/endDate filter bounds on the API. */
function formatJoinDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const PAGE_SIZES = [25, 50, 100] as const;

export function UsersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [draftRange, setDraftRange] = useState<DateRange>(() => todayRange());
  const [appliedRange, setAppliedRange] = useState<DateRange>(() => todayRange());
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const rangeLabel = useMemo(() => formatDateRangeLabel(appliedRange), [appliedRange]);

  const load = useCallback(
    async (opts: {
      searchValue: string;
      range: DateRange;
      pageValue: number;
      limitValue: number;
    }) => {
      const token = getAdminToken();
      if (!token) return;

      setLoading(true);
      setError('');
      try {
        const result = await fetchAdminUsers(token, {
          search: opts.searchValue.trim() || undefined,
          startDate: opts.range.startDate,
          endDate: opts.range.endDate,
          page: opts.pageValue,
          limit: opts.limitValue,
        });
        setUsers(result.users);
        setPage(result.pagination.page);
        setTotal(result.pagination.total);
        setTotalPages(Math.max(1, result.pagination.totalPages));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load customers');
        setUsers([]);
        setTotal(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load({
      searchValue: appliedSearch,
      range: appliedRange,
      pageValue: page,
      limitValue: limit,
    });
  }, [load, appliedSearch, appliedRange, page, limit]);

  async function applyFilters() {
    if (draftRange.startDate > draftRange.endDate) {
      setError('Start date must be on or before end date.');
      return;
    }

    const q = search.trim();
    if (q.includes('@')) {
      const token = getAdminToken();
      if (!token) return;
      setLoading(true);
      setError('');
      try {
        const { user } = await lookupAdminUser(token, q.toLowerCase());
        navigate(`/users/${user.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setUsers([]);
        setTotal(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
      return;
    }

    setError('');
    setAppliedRange(draftRange);
    setAppliedSearch(q);
    setPage(1);
  }

  function setPreset(range: DateRange) {
    setDraftRange(range);
    setAppliedRange(range);
    setAppliedSearch(search.trim().includes('@') ? '' : search.trim());
    setError('');
    setPage(1);
  }

  return (
    <>
      <PageHeader
        title="Customers"
        description="Search and manage customer accounts, wallets, and provisioning."
      />
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1.5 block font-medium text-[var(--color-heading)]">Start date</span>
            <input
              type="date"
              value={draftRange.startDate}
              onChange={(e) => setDraftRange((range) => ({ ...range, startDate: e.target.value }))}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block font-medium text-[var(--color-heading)]">End date</span>
            <input
              type="date"
              value={draftRange.endDate}
              onChange={(e) => setDraftRange((range) => ({ ...range, endDate: e.target.value }))}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            />
          </label>
          <div className="relative min-w-[240px] flex-1">
            <span className="mb-1.5 block text-sm font-medium text-[var(--color-heading)]">Search</span>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void applyFilters()}
                placeholder="Search by email or name"
                className="w-full rounded-md border border-[var(--color-border)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent-soft)]"
              />
            </div>
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={loading}
            onClick={() => void applyFilters()}
          >
            {loading ? 'Loading…' : 'Apply'}
          </button>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary text-xs" onClick={() => setPreset(todayRange())}>
              Today
            </button>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => setPreset(currentMonthRange())}
            >
              This month
            </button>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <CalendarRange size={13} />
          Showing customers who joined {rangeLabel}
        </p>
        {error ? <p className="mt-2 text-sm text-[#df1b41]">{error}</p> : null}
      </div>

      <div className="p-8">
        <section className="panel overflow-hidden">
          {loading && users.length === 0 ? (
            <p className="p-6 text-sm text-[var(--color-text-muted)]">Loading customers…</p>
          ) : users.length === 0 ? (
            <EmptyState
              title="No customers found"
              description="Try a different date range or search by email address."
            />
          ) : (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>KYC</th>
                    <th>Card</th>
                    <th>directPay</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="clickable"
                      onClick={() => navigate(`/users/${user.id}`)}
                    >
                      <td className="font-medium text-[var(--color-heading)]">
                        {formatName(user.firstName, user.lastName, user.email)}
                      </td>
                      <td className="text-[var(--color-text-muted)]">{user.email}</td>
                      <td>
                        <Badge status={user.accountStatus} dot />
                      </td>
                      <td>
                        <Badge status={user.kycStatus} dot />
                      </td>
                      <td>
                        <Badge status={user.stripeProvisioningStatus} />
                      </td>
                      <td>
                        <Badge status={user.directPayProvisioningStatus} />
                      </td>
                      <td className="text-[var(--color-text-muted)]">
                        {formatJoinDate(user.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-canvas-subtle)] px-4 py-3">
                <p className="text-sm text-[var(--color-text-muted)]">
                  {loading
                    ? 'Loading…'
                    : `Page ${page} of ${totalPages} · ${total} customer${total === 1 ? '' : 's'}`}
                </p>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                    Rows
                    <select
                      value={limit}
                      onChange={(e) => {
                        setLimit(Number(e.target.value));
                        setPage(1);
                      }}
                      className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm outline-none focus:border-[var(--color-accent)]"
                    >
                      {PAGE_SIZES.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={loading || page <= 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={loading || page >= totalPages}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
