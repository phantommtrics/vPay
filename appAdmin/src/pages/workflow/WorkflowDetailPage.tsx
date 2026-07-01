import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';

import { PageHeader } from '../../components/ui/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { CursorPagination } from '../../components/ui/CursorPagination';
import { Tabs } from '../../components/ui/Tabs';
import { fetchKycWorkflowDetail, type KycWorkflowAuditRecord } from '../../lib/api';
import { getAdminToken } from '../../lib/auth-storage';
import { formatDate, formatName } from '../../lib/format';

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function WorkflowDetailPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDate = searchParams.get('date') ?? todayInputValue();
  const initialAction = searchParams.get('action');
  const initialSearch = searchParams.get('search') ?? '';

  const [date, setDate] = useState(initialDate);
  const [search, setSearch] = useState(initialSearch);
  const [appliedSearch, setAppliedSearch] = useState(initialSearch);
  const [actionTab, setActionTab] = useState<'all' | 'approved' | 'rejected'>(
    initialAction === 'approved' || initialAction === 'rejected' ? initialAction : 'all',
  );
  const [records, setRecords] = useState<KycWorkflowAuditRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | undefined>();
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const actionFilter = actionTab === 'all' ? undefined : actionTab;
  const resetKey = `${date}-${appliedSearch}-${actionTab}-${limit}`;

  useEffect(() => {
    setCursorStack([]);
    setCurrentCursor(undefined);
  }, [resetKey]);

  const load = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchKycWorkflowDetail(token, {
        date,
        search: appliedSearch || undefined,
        action: actionFilter,
        cursor: currentCursor,
        limit,
      });
      setRecords(data.records);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load detail');
      setRecords([]);
      setNextCursor(null);
    } finally {
      setLoading(false);
    }
  }, [date, appliedSearch, actionFilter, currentCursor, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('date', date);
    if (actionTab !== 'all') params.set('action', actionTab);
    if (appliedSearch) params.set('search', appliedSearch);
    setSearchParams(params, { replace: true });
  }, [date, actionTab, appliedSearch, setSearchParams]);

  const canGoBack = cursorStack.length > 0;
  const canGoForward = nextCursor !== null;

  const subtitle = useMemo(() => {
    const parts = [`Records for ${date}`];
    if (appliedSearch) parts.push(`matching “${appliedSearch}”`);
    return parts.join(' ');
  }, [date, appliedSearch]);

  return (
    <>
      <PageHeader
        title="KYC workflow detail"
      />

      <Tabs
        tabs={[
          { id: 'all', label: 'All actions' },
          { id: 'approved', label: 'Approved' },
          { id: 'rejected', label: 'Rejected' },
        ]}
        active={actionTab}
        onChange={(id) => setActionTab(id as 'all' | 'approved' | 'rejected')}
      />

      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1.5 block font-medium text-[var(--color-heading)]">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            />
          </label>
          <label className="min-w-[240px] flex-1 text-sm">
            <span className="mb-1.5 block font-medium text-[var(--color-heading)]">Search</span>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setAppliedSearch(search.trim())}
                placeholder="Customer or admin email / name"
                className="w-full rounded-md border border-[var(--color-border)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-accent)]"
              />
            </div>
          </label>
          <button type="button" className="btn-primary" onClick={() => setAppliedSearch(search.trim())}>
            Apply
          </button>
        </div>
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">{subtitle}</p>
      </div>

      <div className="p-8">
        {error ? (
          <div className="mb-4 rounded-md border border-[#fcd5df] bg-[#fff5f7] px-4 py-3 text-sm text-[#df1b41]">
            {error}
          </div>
        ) : null}

        <section className="panel overflow-hidden">
          {loading && records.length === 0 ? (
            <p className="p-6 text-sm text-[var(--color-text-muted)]">Loading audit records…</p>
          ) : records.length === 0 ? (
            <EmptyState title="No audit records" description="Try another date or clear your search filters." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Customer</th>
                  <th>Performed by</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td className="whitespace-nowrap text-[var(--color-text-muted)]">
                      {formatDate(record.createdAt)}
                    </td>
                    <td>
                      <Badge status={record.action} dot />
                    </td>
                    <td>
                      <Link
                        to={`/users/${record.customer.id}`}
                        className="font-medium text-[var(--color-heading)] hover:text-[var(--color-accent)]"
                      >
                        {formatName(record.customer.firstName, record.customer.lastName, record.customer.email)}
                      </Link>
                      <div className="text-xs text-[var(--color-text-muted)]">{record.customer.email}</div>
                    </td>
                    <td>
                      <div className="font-medium text-[var(--color-heading)]">
                        {formatName(record.admin.firstName, record.admin.lastName, record.admin.email)}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">{record.admin.email}</div>
                    </td>
                    <td className="max-w-[220px] truncate text-[var(--color-text-muted)]">
                      {record.action === 'rejected' ? record.rejectionReason ?? '—' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <CursorPagination
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            onPrev={() => {
              setCursorStack((stack) => {
                if (stack.length === 0) return stack;
                const prev = stack[stack.length - 1];
                setCurrentCursor(prev);
                return stack.slice(0, -1);
              });
            }}
            onNext={() => {
              if (!nextCursor) return;
              setCursorStack((stack) => [...stack, currentCursor]);
              setCurrentCursor(nextCursor);
            }}
            limit={limit}
            onLimitChange={setLimit}
            itemCount={records.length}
            loading={loading}
          />
        </section>
      </div>
    </>
  );
}
