import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';

import { PageHeader } from '../../components/ui/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { MetricCard } from '../../components/ui/MetricCard';
import { fetchKycWorkflowSummary, type KycWorkflowSummary } from '../../lib/api';
import { getAdminToken } from '../../lib/auth-storage';
import { formatDate, formatName, formatShortDate } from '../../lib/format';

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function WorkflowSummaryPage() {
  const [date, setDate] = useState(todayInputValue);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [summary, setSummary] = useState<KycWorkflowSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchKycWorkflowSummary(token, {
        date,
        search: appliedSearch || undefined,
      });
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load summary');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [date, appliedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  function runSearch() {
    setAppliedSearch(search.trim());
  }

  const adminCount = useMemo(() => {
    if (!summary) return 0;
    const keys = new Set(summary.rows.map((row) => row.adminUserId ?? row.email));
    return keys.size;
  }, [summary]);

  return (
    <>
      <PageHeader
        title="KYC workflow summary"
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
            <span className="mb-1.5 block font-medium text-[var(--color-heading)]">Search admin or customer</span>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                placeholder="Email or name"
                className="w-full rounded-md border border-[var(--color-border)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-accent)]"
              />
            </div>
          </label>
          <button type="button" className="btn-primary" onClick={runSearch}>
            Apply
          </button>
          {appliedSearch ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setSearch('');
                setAppliedSearch('');
              }}>
              Clear search
            </button>
          ) : null}
        </div>
      </div>

      <div className="p-8">
        {error ? (
          <div className="mb-4 rounded-md border border-[#fcd5df] bg-[#fff5f7] px-4 py-3 text-sm text-[#df1b41]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-[var(--color-text-muted)]">Loading summary…</p>
        ) : summary ? (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Total actions" value={String(summary.totals.total)} />
              <MetricCard label="Admins active" value={String(adminCount)} />
              <MetricCard label="Approved" value={String(summary.totals.approved)} />
              <MetricCard label="Rejected" value={String(summary.totals.rejected)} />
            </div>

            <section className="panel overflow-hidden">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--color-heading)]">By admin operator</h2>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {summary.rows.length} row(s) for {formatShortDate(`${date}T12:00:00.000Z`)}
                  </p>
                </div>
                <Link
                  to={`/workflow/detail?date=${encodeURIComponent(date)}${appliedSearch ? `&search=${encodeURIComponent(appliedSearch)}` : ''}`}
                  className="text-xs font-medium text-[var(--color-accent)] hover:underline"
                >
                  View full audit log →
                </Link>
              </div>

              {summary.rows.length === 0 ? (
                <div className="p-6">
                  <EmptyState title="No workflow activity" description="No KYC reviews recorded for this date." />
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Admin operator</th>
                      <th>Action</th>
                      <th>Count</th>
                      <th>Last action</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {summary.rows.map((row) => {
                      const rowKey = `${row.adminUserId ?? row.email}:${row.action}`;
                      const detailLink = `/workflow/detail?date=${encodeURIComponent(date)}&action=${row.action}&search=${encodeURIComponent(row.email)}`;

                      return (
                        <tr key={rowKey}>
                          <td>
                            <div className="font-medium text-[var(--color-heading)]">
                              {formatName(row.firstName, row.lastName, row.email)}
                            </div>
                            <div className="text-xs text-[var(--color-text-muted)]">{row.email}</div>
                          </td>
                          <td>
                            <Badge status={row.action} dot />
                          </td>
                          <td>
                            <span className="font-mono text-sm font-semibold text-[var(--color-heading)]">
                              {row.count}
                            </span>
                          </td>
                          <td className="whitespace-nowrap text-[var(--color-text-muted)]">
                            {formatDate(row.lastAt)}
                          </td>
                          <td className="text-right">
                            <Link
                              to={detailLink}
                              className="text-xs font-medium text-[var(--color-accent)] hover:underline"
                            >
                              Detail
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>
          </>
        ) : null}
      </div>
    </>
  );
}
