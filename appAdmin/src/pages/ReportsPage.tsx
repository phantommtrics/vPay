import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange } from 'lucide-react';

import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Tabs } from '../components/ui/Tabs';
import { CursorPagination } from '../components/ui/CursorPagination';
import { EmptyState } from '../components/ui/EmptyState';
import { ExportMenu } from '../components/ui/ExportMenu';
import { useCursorPagination } from '../hooks/useCursorPagination';
import {
  fetchAllReportFundingOrders,
  fetchAllReportWalletTransactions,
  fetchReportFundingOrders,
  fetchReportWalletTransactions,
  type ReportFundingOrder,
  type ReportWalletTransaction,
} from '../lib/api';
import { getAdminToken } from '../lib/auth-storage';
import {
  currentMonthRange,
  formatDateRangeLabel,
  todayRange,
  type DateRange,
} from '../lib/dateRange';
import { formatDate, formatGmd, formatName, formatUsd } from '../lib/format';
import {
  exportReportToCsv,
  exportReportToPdf,
  sanitizeExportFilename,
  type ReportExportResult,
} from '../lib/reportExport';

function defaultDateRange(): DateRange {
  return currentMonthRange();
}

function ledgerToExportResult(items: ReportWalletTransaction[], truncated: boolean): ReportExportResult {
  const columns = [
    'Date',
    'Customer',
    'Email',
    'Type',
    'Amount (GMD)',
    'Balance after (GMD)',
    'Description',
    'Reference type',
    'Reference ID',
  ];
  const rows = items.map((tx) => ({
    Date: formatDate(tx.createdAt),
    Customer: formatName(tx.user.firstName, tx.user.lastName, tx.user.email),
    Email: tx.user.email,
    Type: tx.type,
    'Amount (GMD)': formatGmd(tx.amountGmd),
    'Balance after (GMD)': formatGmd(tx.balanceAfterGmd),
    Description: tx.description ?? '',
    'Reference type': tx.referenceType ?? '',
    'Reference ID': tx.referenceId ?? '',
  }));
  return { columns, rows, rowCount: rows.length, truncated };
}

function fundingToExportResult(items: ReportFundingOrder[], truncated: boolean): ReportExportResult {
  const columns = [
    'Date',
    'Customer',
    'Email',
    'Amount (GMD)',
    'Fee (GMD)',
    'Total (GMD)',
    'USD estimate',
    'Status',
    'DirectPay code',
  ];
  const rows = items.map((order) => ({
    Date: formatDate(order.createdAt),
    Customer: formatName(order.user.firstName, order.user.lastName, order.user.email),
    Email: order.user.email,
    'Amount (GMD)': formatGmd(order.amountGmd),
    'Fee (GMD)': formatGmd(order.feeGmd),
    'Total (GMD)': formatGmd(order.totalGmd),
    'USD estimate': formatUsd(order.usdEstimate),
    Status: order.status,
    'DirectPay code': order.directPayOrderPublicCode ?? '',
  }));
  return { columns, rows, rowCount: rows.length, truncated };
}

export function ReportsPage() {
  const [tab, setTab] = useState('ledger');
  const [limit, setLimit] = useState(25);
  const [draftRange, setDraftRange] = useState<DateRange>(defaultDateRange);
  const [appliedRange, setAppliedRange] = useState<DateRange>(defaultDateRange);
  const [exportError, setExportError] = useState('');

  const dateFilterKey = `${appliedRange.startDate}-${appliedRange.endDate}`;

  const fetchLedger = useCallback(
    async (params: { cursor?: string; limit: number }) => {
      const token = getAdminToken();
      if (!token) return { items: [] as ReportWalletTransaction[], nextCursor: null };
      const { transactions, nextCursor } = await fetchReportWalletTransactions(token, {
        ...params,
        startDate: appliedRange.startDate,
        endDate: appliedRange.endDate,
      });
      return { items: transactions, nextCursor };
    },
    [appliedRange],
  );

  const fetchFunding = useCallback(
    async (params: { cursor?: string; limit: number }) => {
      const token = getAdminToken();
      if (!token) return { items: [] as ReportFundingOrder[], nextCursor: null };
      const { orders, nextCursor } = await fetchReportFundingOrders(token, {
        ...params,
        startDate: appliedRange.startDate,
        endDate: appliedRange.endDate,
      });
      return { items: orders, nextCursor };
    },
    [appliedRange],
  );

  const ledger = useCursorPagination(fetchLedger, limit, `ledger-${limit}-${dateFilterKey}`);
  const funding = useCursorPagination(fetchFunding, limit, `funding-${limit}-${dateFilterKey}`);
  const active = tab === 'ledger' ? ledger : funding;

  const rangeLabel = useMemo(() => formatDateRangeLabel(appliedRange), [appliedRange]);

  function applyDateRange() {
    if (draftRange.startDate > draftRange.endDate) {
      setExportError('Start date must be on or before end date.');
      return;
    }
    setExportError('');
    setAppliedRange(draftRange);
  }

  function setPreset(range: DateRange) {
    setDraftRange(range);
    setAppliedRange(range);
    setExportError('');
  }

  async function handleExport(format: 'csv' | 'pdf') {
    const token = getAdminToken();
    if (!token) return;

    setExportError('');
    try {
      const isLedger = tab === 'ledger';
      const reportName = isLedger ? 'Wallet ledger report' : 'Funding orders report';
      const subtitle = isLedger
        ? 'Wallet transaction ledger for the selected period.'
        : 'Customer funding orders for the selected period.';

      if (isLedger) {
        const { items, truncated } = await fetchAllReportWalletTransactions(token, appliedRange);
        if (items.length === 0) {
          setExportError('No records to export for the selected date range.');
          return;
        }
        const result = ledgerToExportResult(items, truncated);
        const filename = sanitizeExportFilename(reportName);
        const meta = { reportName, filterLabel: rangeLabel, subtitle };
        if (format === 'csv') exportReportToCsv(result, filename);
        else await exportReportToPdf(result, filename, meta);
        return;
      }

      const { items, truncated } = await fetchAllReportFundingOrders(token, appliedRange);
      if (items.length === 0) {
        setExportError('No records to export for the selected date range.');
        return;
      }
      const result = fundingToExportResult(items, truncated);
      const filename = sanitizeExportFilename(reportName);
      const meta = { reportName, filterLabel: rangeLabel, subtitle };
      if (format === 'csv') exportReportToCsv(result, filename);
      else await exportReportToPdf(result, filename, meta);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    }
  }

  return (
    <>
      <PageHeader
        title="Transaction reports"
        description="Wallet ledger and funding activity with date-filtered exports."
        actions={<ExportMenu disabled={active.loading} onExport={handleExport} />}
      />

      <Tabs
        tabs={[
          { id: 'ledger', label: 'Wallet ledger' },
          { id: 'funding', label: 'Funding orders' },
        ]}
        active={tab}
        onChange={setTab}
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
          <button type="button" className="btn-primary" onClick={applyDateRange}>
            Apply
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
          Showing records for {rangeLabel}
        </p>
      </div>

      <div className="p-8">
        {active.error ? (
          <div className="mb-4 rounded-md border border-[#fcd5df] bg-[#fff5f7] px-4 py-3 text-sm text-[#df1b41]">
            {active.error}
          </div>
        ) : null}
        {exportError ? (
          <div className="mb-4 rounded-md border border-[#fcd5df] bg-[#fff5f7] px-4 py-3 text-sm text-[#df1b41]">
            {exportError}
          </div>
        ) : null}

        {tab === 'ledger' ? (
          <section className="panel overflow-hidden">
            {ledger.loading && ledger.items.length === 0 ? (
              <p className="p-6 text-sm text-[var(--color-text-muted)]">Loading reports…</p>
            ) : ledger.items.length === 0 ? (
              <EmptyState
                title="No ledger entries"
                description="No wallet transactions match the selected date range."
              />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Balance after</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.items.map((tx) => (
                    <tr key={tx.id}>
                      <td className="whitespace-nowrap text-[var(--color-text-muted)]">{formatDate(tx.createdAt)}</td>
                      <td>
                        <Link
                          to={`/users/${tx.user.id}`}
                          className="font-medium text-[var(--color-heading)] hover:text-[var(--color-accent)]"
                        >
                          {formatName(tx.user.firstName, tx.user.lastName, tx.user.email)}
                        </Link>
                      </td>
                      <td>
                        <Badge status={tx.type} />
                      </td>
                      <td className="font-mono">{formatGmd(tx.amountGmd)}</td>
                      <td className="font-mono text-[var(--color-text-muted)]">{formatGmd(tx.balanceAfterGmd)}</td>
                      <td className="max-w-[200px] truncate text-[var(--color-text-muted)]">
                        {tx.description ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <CursorPagination
              canGoBack={ledger.canGoBack}
              canGoForward={ledger.canGoForward}
              onPrev={ledger.goPrev}
              onNext={ledger.goNext}
              limit={limit}
              onLimitChange={setLimit}
              itemCount={ledger.items.length}
              loading={ledger.loading}
            />
          </section>
        ) : (
          <section className="panel overflow-hidden">
            {funding.loading && funding.items.length === 0 ? (
              <p className="p-6 text-sm text-[var(--color-text-muted)]">Loading reports…</p>
            ) : funding.items.length === 0 ? (
              <EmptyState
                title="No funding orders"
                description="No funding orders match the selected date range."
              />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Fee</th>
                    <th>Total</th>
                    <th>USD est.</th>
                    <th>Status</th>
                    <th>Code</th>
                  </tr>
                </thead>
                <tbody>
                  {funding.items.map((order) => (
                    <tr key={order.id}>
                      <td className="whitespace-nowrap text-[var(--color-text-muted)]">{formatDate(order.createdAt)}</td>
                      <td>
                        <Link
                          to={`/users/${order.user.id}`}
                          className="font-medium text-[var(--color-heading)] hover:text-[var(--color-accent)]"
                        >
                          {formatName(order.user.firstName, order.user.lastName, order.user.email)}
                        </Link>
                      </td>
                      <td className="font-mono">{formatGmd(order.amountGmd)}</td>
                      <td className="font-mono text-[var(--color-text-muted)]">{formatGmd(order.feeGmd)}</td>
                      <td className="font-mono">{formatGmd(order.totalGmd)}</td>
                      <td className="font-mono text-[var(--color-text-muted)]">{formatUsd(order.usdEstimate)}</td>
                      <td>
                        <Badge status={order.status} dot />
                      </td>
                      <td className="font-mono text-xs text-[var(--color-text-muted)]">
                        {order.directPayOrderPublicCode ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <CursorPagination
              canGoBack={funding.canGoBack}
              canGoForward={funding.canGoForward}
              onPrev={funding.goPrev}
              onNext={funding.goNext}
              limit={limit}
              onLimitChange={setLimit}
              itemCount={funding.items.length}
              loading={funding.loading}
            />
          </section>
        )}
      </div>
    </>
  );
}
