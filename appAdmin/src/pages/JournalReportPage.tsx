import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarRange } from 'lucide-react';

import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Tabs } from '../components/ui/Tabs';
import { CursorPagination } from '../components/ui/CursorPagination';
import { EmptyState } from '../components/ui/EmptyState';
import { useCursorPagination } from '../hooks/useCursorPagination';
import {
  fetchReportJournalEntries,
  fetchReportJournalEntryDetail,
  fetchReportTrialBalance,
  type JournalEntryRecord,
} from '../lib/api';
import { getAdminToken } from '../lib/auth-storage';
import {
  currentMonthRange,
  formatDateRangeLabel,
  todayRange,
  type DateRange,
} from '../lib/dateRange';
import { formatDate, formatGmd } from '../lib/format';

function defaultDateRange(): DateRange {
  return currentMonthRange();
}

function formatAccountType(type: string) {
  return type === 'CUSTOMER_WALLET' ? 'Customer wallet' : 'Business account';
}

function JournalEntriesPanel({
  dateRange,
  limit,
}: {
  dateRange: DateRange;
  limit: number;
}) {
  const token = getAdminToken();
  const dateFilterKey = `${dateRange.startDate}:${dateRange.endDate}`;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedLines, setExpandedLines] = useState<Record<string, JournalEntryRecord['lines']>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);

  const fetchEntries = useCallback(
    async (params: { cursor?: string; limit: number }) => {
      if (!token) return { items: [] as JournalEntryRecord[], nextCursor: null };
      const result = await fetchReportJournalEntries(token, {
        ...params,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      return { items: result.items, nextCursor: result.nextCursor };
    },
    [token, dateRange.startDate, dateRange.endDate],
  );

  const pager = useCursorPagination(fetchEntries, limit, `journal-${limit}-${dateFilterKey}`);

  async function toggleExpand(entry: JournalEntryRecord) {
    if (expandedId === entry.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(entry.id);
    if (expandedLines[entry.id] || !token) return;

    setDetailLoadingId(entry.id);
    try {
      const detail = await fetchReportJournalEntryDetail(token, entry.id);
      setExpandedLines((prev) => ({ ...prev, [entry.id]: detail.lines ?? [] }));
    } finally {
      setDetailLoadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {pager.error ? <p className="text-sm text-red-600">{pager.error}</p> : null}
      {pager.loading && pager.items.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading journal entries…</p>
      ) : pager.items.length === 0 ? (
        <EmptyState
          title="No journal entries"
          description="Balanced journal entries appear here when wallet and platform transactions post."
        />
      ) : (
        <div className="space-y-3">
          {pager.items.map((entry) => {
            const expanded = expandedId === entry.id;
            const lines = expandedLines[entry.id];
            return (
              <div key={entry.id} className="panel p-4">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-4 text-left"
                  onClick={() => void toggleExpand(entry)}>
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-heading)]">
                      {entry.description || entry.referenceType}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      {formatDate(entry.postedAt)} · {entry.referenceType}:{entry.referenceId}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      {entry.lineCount} line{entry.lineCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="text-right text-xs text-[var(--color-text-muted)]">
                    <p>DR {formatGmd(entry.totalDebit)}</p>
                    <p>CR {formatGmd(entry.totalCredit)}</p>
                    {Math.abs(entry.totalDebit - entry.totalCredit) < 0.01 ? (
                      <Badge status="balanced" />
                    ) : (
                      <Badge status="unbalanced" />
                    )}
                  </div>
                </button>
                {expanded ? (
                  detailLoadingId === entry.id ? (
                    <p className="mt-4 text-sm text-[var(--color-text-muted)]">Loading lines…</p>
                  ) : lines && lines.length > 0 ? (
                    <table className="data-table mt-4">
                      <thead>
                        <tr>
                          <th>Account</th>
                          <th>Type</th>
                          <th>Debit</th>
                          <th>Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line) => (
                          <tr key={line.id}>
                            <td>
                              <div className="font-medium text-[var(--color-heading)]">
                                {line.accountName}
                              </div>
                              <div className="text-xs text-[var(--color-text-muted)]">
                                {line.accountCode}
                              </div>
                            </td>
                            <td>{formatAccountType(line.accountType)}</td>
                            <td>{line.debit > 0 ? formatGmd(line.debit) : '—'}</td>
                            <td>{line.credit > 0 ? formatGmd(line.credit) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="mt-4 text-sm text-[var(--color-text-muted)]">No lines found.</p>
                  )
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <CursorPagination
        canGoBack={pager.canGoBack}
        canGoForward={pager.canGoForward}
        onPrev={pager.goPrev}
        onNext={pager.goNext}
        itemCount={pager.items.length}
        loading={pager.loading}
      />
    </div>
  );
}

function TrialBalancePanel({
  dateRange,
  limit,
  accountType,
}: {
  dateRange: DateRange;
  limit: number;
  accountType: 'CUSTOMER_WALLET' | 'BUSINESS_ACCOUNT' | '';
}) {
  const token = getAdminToken();
  const dateFilterKey = `${dateRange.startDate}:${dateRange.endDate}:${accountType}`;

  const fetchTrialBalance = useCallback(
    async (params: { cursor?: string; limit: number }) => {
      if (!token) {
        return {
          items: [] as Array<{
            accountType: string;
            accountId: string;
            accountName: string;
            accountCode: string;
            totalDebit: number;
            totalCredit: number;
            netBalance: number;
            liveBalance: number | null;
            currency: string;
          }>,
          nextCursor: null,
        };
      }
      const result = await fetchReportTrialBalance(token, {
        cursor: params.cursor,
        limit: params.limit,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        accountType: accountType || undefined,
      });
      return { items: result.rows, nextCursor: result.nextCursor };
    },
    [token, dateRange.startDate, dateRange.endDate, accountType],
  );

  const pager = useCursorPagination(fetchTrialBalance, limit, `trial-${limit}-${dateFilterKey}`);
  const [totals, setTotals] = useState({ totalDebit: 0, totalCredit: 0, balanced: true });

  useEffect(() => {
    if (!token) return;
    fetchReportTrialBalance(token, {
      limit: 1,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      accountType: accountType || undefined,
    }).then((result) => setTotals(result.totals));
  }, [token, dateRange.startDate, dateRange.endDate, accountType]);

  if (pager.loading && pager.items.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">Loading trial balance…</p>;
  }

  if (pager.error) {
    return <p className="text-sm text-red-600">{pager.error}</p>;
  }

  if (pager.items.length === 0) {
    return (
      <EmptyState
        title="No trial balance data"
        description="Journal activity in the selected period will populate account totals here."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge status={totals.balanced ? 'balanced' : 'unbalanced'} />
        <span className="text-sm text-[var(--color-text-muted)]">
          {totals.balanced ? 'Books balanced' : 'Out of balance'} · Total DR {formatGmd(totals.totalDebit)} · Total CR{' '}
          {formatGmd(totals.totalCredit)}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Type</th>
              <th>Total debit</th>
              <th>Total credit</th>
              <th>Net (journal)</th>
              <th>Live balance</th>
            </tr>
          </thead>
          <tbody>
            {pager.items.map((row) => (
              <tr key={`${row.accountType}:${row.accountId}`}>
                <td>
                  <div className="font-medium text-[var(--color-heading)]">{row.accountName}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{row.accountCode}</div>
                </td>
                <td>{formatAccountType(row.accountType)}</td>
                <td>{formatGmd(row.totalDebit)}</td>
                <td>{formatGmd(row.totalCredit)}</td>
                <td>{formatGmd(row.netBalance)}</td>
                <td>{row.liveBalance != null ? formatGmd(row.liveBalance) : '—'}</td>
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
    </div>
  );
}

export function JournalReportPage() {
  const [tab, setTab] = useState('entries');
  const [limit, setLimit] = useState(25);
  const [trialAccountType, setTrialAccountType] = useState<'CUSTOMER_WALLET' | 'BUSINESS_ACCOUNT' | ''>(
    'BUSINESS_ACCOUNT',
  );
  const [draftRange, setDraftRange] = useState<DateRange>(defaultDateRange);
  const [appliedRange, setAppliedRange] = useState<DateRange>(defaultDateRange);

  const dateLabel = useMemo(() => formatDateRangeLabel(appliedRange), [appliedRange]);

  return (
    <div>
      <PageHeader
        title="Journal & trial balance"
        description="Paginated double-entry journal designed for high transaction volume. Defaults to a bounded date window."
      />

      <div className="space-y-6 p-8">
        <Tabs
          tabs={[
            { id: 'entries', label: 'Journal entries' },
            { id: 'trial-balance', label: 'Trial balance' },
          ]}
          value={tab}
          onChange={setTab}
        />

        <div className="panel p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
                Start date
              </label>
              <input
                type="date"
                className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                value={draftRange.startDate}
                onChange={(e) => setDraftRange((r) => ({ ...r, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
                End date
              </label>
              <input
                type="date"
                className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                value={draftRange.endDate}
                onChange={(e) => setDraftRange((r) => ({ ...r, endDate: e.target.value }))}
              />
            </div>
            <button type="button" className="btn-secondary" onClick={() => setDraftRange(todayRange())}>
              Today
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setDraftRange(currentMonthRange())}>
              This month
            </button>
            <button type="button" className="btn-primary" onClick={() => setAppliedRange(draftRange)}>
              Apply
            </button>
            {tab === 'trial-balance' ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
                  Account type
                </label>
                <select
                  className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                  value={trialAccountType}
                  onChange={(e) =>
                    setTrialAccountType(e.target.value as 'CUSTOMER_WALLET' | 'BUSINESS_ACCOUNT' | '')
                  }>
                  <option value="BUSINESS_ACCOUNT">Business accounts</option>
                  <option value="CUSTOMER_WALLET">Customer wallets</option>
                  <option value="">All accounts</option>
                </select>
              </div>
            ) : null}
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
          <p className="mt-3 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <CalendarRange className="h-3.5 w-3.5" />
            Showing {dateLabel} · max 366-day window per query
          </p>
        </div>

        {tab === 'entries' ? (
          <JournalEntriesPanel dateRange={appliedRange} limit={limit} />
        ) : (
          <TrialBalancePanel dateRange={appliedRange} limit={limit} accountType={trialAccountType} />
        )}
      </div>
    </div>
  );
}
