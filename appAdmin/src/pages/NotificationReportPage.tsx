import { Fragment, useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange } from 'lucide-react';

import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { CursorPagination } from '../components/ui/CursorPagination';
import { EmptyState } from '../components/ui/EmptyState';
import { ExportMenu } from '../components/ui/ExportMenu';
import { useCursorPagination } from '../hooks/useCursorPagination';
import {
  fetchAllReportEmailNotifications,
  fetchReportEmailNotifications,
  type ReportEmailNotification,
} from '../lib/api';
import { getAdminToken } from '../lib/auth-storage';
import {
  currentMonthRange,
  formatDateRangeLabel,
  todayRange,
  type DateRange,
} from '../lib/dateRange';
import { formatDate, formatName } from '../lib/format';
import {
  exportReportToCsv,
  exportReportToPdf,
  sanitizeExportFilename,
  type ReportExportResult,
} from '../lib/reportExport';

const TEMPLATE_LABELS: Record<string, string> = {
  OTP_SIGN_IN: 'Sign-in code',
  WELCOME: 'Welcome',
  CARD_READY: 'Card ready',
};

function defaultDateRange(): DateRange {
  return currentMonthRange();
}

function notificationsToExportResult(
  items: ReportEmailNotification[],
  truncated: boolean,
): ReportExportResult {
  const columns = [
    'Date',
    'Recipient',
    'Customer',
    'Template',
    'Audience',
    'Subject',
    'Body',
    'Status',
    'Resend ID',
    'Error',
  ];
  const rows = items.map((item) => ({
    Date: formatDate(item.createdAt),
    Recipient: item.recipientEmail,
    Customer: item.user
      ? formatName(item.user.firstName, item.user.lastName, item.user.email)
      : '',
    Template: TEMPLATE_LABELS[item.template] ?? item.template,
    Audience: item.audience.toLowerCase(),
    Subject: item.subject,
    Body: item.body,
    Status: item.status.toLowerCase(),
    'Resend ID': item.resendMessageId ?? '',
    Error: item.errorMessage ?? '',
  }));
  return { columns, rows, rowCount: rows.length, truncated };
}

export function NotificationReportPage() {
  const [limit, setLimit] = useState(25);
  const [draftRange, setDraftRange] = useState<DateRange>(defaultDateRange);
  const [appliedRange, setAppliedRange] = useState<DateRange>(defaultDateRange);
  const [templateFilter, setTemplateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [appliedTemplate, setAppliedTemplate] = useState('');
  const [appliedStatus, setAppliedStatus] = useState('');
  const [appliedEmail, setAppliedEmail] = useState('');
  const [exportError, setExportError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filterKey = `${appliedRange.startDate}-${appliedRange.endDate}-${appliedTemplate}-${appliedStatus}-${appliedEmail}`;

  const fetchNotifications = useCallback(
    async (params: { cursor?: string; limit: number }) => {
      const token = getAdminToken();
      if (!token) return { items: [] as ReportEmailNotification[], nextCursor: null };
      const { notifications, nextCursor } = await fetchReportEmailNotifications(token, {
        ...params,
        startDate: appliedRange.startDate,
        endDate: appliedRange.endDate,
        template: appliedTemplate || undefined,
        status: appliedStatus || undefined,
        email: appliedEmail || undefined,
      });
      return { items: notifications, nextCursor };
    },
    [appliedRange, appliedTemplate, appliedStatus, appliedEmail],
  );

  const pagination = useCursorPagination(fetchNotifications, limit, `notifications-${limit}-${filterKey}`);
  const rangeLabel = useMemo(() => formatDateRangeLabel(appliedRange), [appliedRange]);

  function applyFilters() {
    if (draftRange.startDate > draftRange.endDate) {
      setExportError('Start date must be on or before end date.');
      return;
    }
    setExportError('');
    setAppliedRange(draftRange);
    setAppliedTemplate(templateFilter);
    setAppliedStatus(statusFilter);
    setAppliedEmail(emailFilter.trim());
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
      const reportName = 'Email notification report';
      const subtitle = 'Email notifications sent to customers and admins for the selected period.';

      const { items, truncated } = await fetchAllReportEmailNotifications(token, {
        startDate: appliedRange.startDate,
        endDate: appliedRange.endDate,
        template: appliedTemplate || undefined,
        status: appliedStatus || undefined,
        email: appliedEmail || undefined,
      });

      if (items.length === 0) {
        setExportError('No records to export for the selected filters.');
        return;
      }

      const result = notificationsToExportResult(items, truncated);
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
        title="Email notifications"
        description="Audit log of all email notifications sent to customers and admin operators."
        actions={<ExportMenu disabled={pagination.loading} onExport={handleExport} />}
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
          <label className="text-sm">
            <span className="mb-1.5 block font-medium text-[var(--color-heading)]">Template</span>
            <select
              value={templateFilter}
              onChange={(e) => setTemplateFilter(e.target.value)}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            >
              <option value="">All templates</option>
              <option value="OTP_SIGN_IN">Sign-in code</option>
              <option value="WELCOME">Welcome</option>
              <option value="CARD_READY">Card ready</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block font-medium text-[var(--color-heading)]">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            >
              <option value="">All statuses</option>
              <option value="SENT">Sent</option>
              <option value="FAILED">Failed</option>
              <option value="SKIPPED">Skipped (dev)</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block font-medium text-[var(--color-heading)]">Recipient email</span>
            <input
              type="email"
              value={emailFilter}
              onChange={(e) => setEmailFilter(e.target.value)}
              placeholder="Filter by email"
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            />
          </label>
          <button type="button" className="btn-primary" onClick={applyFilters}>
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
        {pagination.error ? (
          <div className="mb-4 rounded-md border border-[#fcd5df] bg-[#fff5f7] px-4 py-3 text-sm text-[#df1b41]">
            {pagination.error}
          </div>
        ) : null}
        {exportError ? (
          <div className="mb-4 rounded-md border border-[#fcd5df] bg-[#fff5f7] px-4 py-3 text-sm text-[#df1b41]">
            {exportError}
          </div>
        ) : null}

        <section className="panel overflow-hidden">
          {pagination.loading && pagination.items.length === 0 ? (
            <p className="p-6 text-sm text-[var(--color-text-muted)]">Loading notifications…</p>
          ) : pagination.items.length === 0 ? (
            <EmptyState
              title="No email notifications"
              description="No email notifications match the selected filters."
            />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Recipient</th>
                  <th>Template</th>
                  <th>Audience</th>
                  <th>Subject</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pagination.items.map((item) => (
                  <Fragment key={item.id}>
                    <tr
                      className="cursor-pointer hover:bg-[var(--color-canvas-subtle)]"
                      onClick={() => setExpandedId((current) => (current === item.id ? null : item.id))}
                    >
                      <td className="whitespace-nowrap text-[var(--color-text-muted)]">
                        {formatDate(item.createdAt)}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {item.user && !item.user.adminUser ? (
                          <Link
                            to={`/users/${item.user.id}`}
                            className="font-medium text-[var(--color-heading)] hover:text-[var(--color-accent)]"
                          >
                            {formatName(item.user.firstName, item.user.lastName, item.recipientEmail)}
                          </Link>
                        ) : (
                          <span className="font-medium text-[var(--color-heading)]">{item.recipientEmail}</span>
                        )}
                        <p className="text-xs text-[var(--color-text-muted)]">{item.recipientEmail}</p>
                      </td>
                      <td>{TEMPLATE_LABELS[item.template] ?? item.template}</td>
                      <td className="capitalize text-[var(--color-text-muted)]">{item.audience.toLowerCase()}</td>
                      <td className="max-w-[240px] truncate text-[var(--color-text-muted)]" title={item.subject}>
                        {item.subject}
                      </td>
                      <td>
                        <Badge status={item.status.toLowerCase()} dot />
                        {item.errorMessage ? (
                          <p className="mt-1 max-w-[180px] truncate text-xs text-[#df1b41]" title={item.errorMessage}>
                            {item.errorMessage}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                    {expandedId === item.id ? (
                      <tr key={`${item.id}-body`}>
                        <td colSpan={6} className="bg-[var(--color-canvas-subtle)] p-4">
                          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                            Email body
                          </p>
                          <iframe
                            title={`Email body for ${item.recipientEmail}`}
                            srcDoc={item.body}
                            sandbox=""
                            className="h-[420px] w-full rounded-md border border-[var(--color-border)] bg-white"
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
          <CursorPagination
            canGoBack={pagination.canGoBack}
            canGoForward={pagination.canGoForward}
            onPrev={pagination.goPrev}
            onNext={pagination.goNext}
            limit={limit}
            onLimitChange={setLimit}
            itemCount={pagination.items.length}
            loading={pagination.loading}
          />
        </section>
      </div>
    </>
  );
}
