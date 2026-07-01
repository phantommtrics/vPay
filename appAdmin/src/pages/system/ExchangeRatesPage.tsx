import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarRange, LineChart as LineChartIcon, RefreshCw } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { PageHeader } from '../../components/ui/PageHeader';
import { MetricCard } from '../../components/ui/MetricCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { CursorPagination } from '../../components/ui/CursorPagination';
import { StatusBadge } from '../../components/StatusBadge';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import {
  fetchExchangeRatePulls,
  fetchExchangeRateSnapshots,
  type ExchangeRateSnapshotRecord,
  type ExchangeRateSnapshotsResponse,
} from '../../lib/api';
import { getAdminToken } from '../../lib/auth-storage';
import {
  currentMonthRange,
  formatDateRangeLabel,
  last7DaysRange,
  todayRange,
  type DateRange,
} from '../../lib/dateRange';
import { formatDate } from '../../lib/format';

type RangePreset = 'today' | '7d' | 'month';

const PULL_PAGE_SIZE = 25;

function presetRange(preset: RangePreset): DateRange {
  if (preset === 'today') return todayRange();
  if (preset === '7d') return last7DaysRange();
  return currentMonthRange();
}

function formatRate(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function chartTimeLabel(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ExchangeRatesPage() {
  const [preset, setPreset] = useState<RangePreset>('today');
  const [dateRange, setDateRange] = useState<DateRange>(() => todayRange());
  const [data, setData] = useState<ExchangeRateSnapshotsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pullLimit, setPullLimit] = useState(PULL_PAGE_SIZE);

  const fetchPullPage = useCallback(
    async ({ cursor, limit }: { cursor?: string; limit: number }) => {
      const token = getAdminToken();
      if (!token) return { items: [], nextCursor: null };
      const response = await fetchExchangeRatePulls(token, dateRange, { cursor, limit });
      return { items: response.records, nextCursor: response.nextCursor };
    },
    [dateRange],
  );

  const pulls = useCursorPagination<ExchangeRateSnapshotRecord>(
    fetchPullPage,
    pullLimit,
    `${dateRange.startDate}:${dateRange.endDate}:${pullLimit}`,
  );

  const loadChart = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;

    setLoading(true);
    setError('');
    try {
      const response = await fetchExchangeRateSnapshots(token, dateRange);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exchange rate history');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    void loadChart();
  }, [loadChart]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadChart();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [loadChart]);

  const chartData = useMemo(
    () =>
      (data?.points ?? []).map((point: ExchangeRateSnapshotsResponse['points'][number]) => ({
        ...point,
        label: chartTimeLabel(point.requestedAt),
      })),
    [data?.points],
  );

  const pairLabel =
    data?.summary.baseCurrency && data?.summary.targetCurrency
      ? `${data.summary.targetCurrency} per ${data.summary.baseCurrency}`
      : 'GMD per USD';

  function applyPreset(next: RangePreset) {
    setPreset(next);
    setDateRange(presetRange(next));
  }

  const tableError = pulls.error;
  const displayError = error || tableError;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exchange rate history"
        description="Tracked pulls from ExchangeRate-API for the GMD/USD catalog rate."
        actions={
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-2"
            onClick={() => void loadChart()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      <div className="panel p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <CalendarRange className="h-4 w-4" />
            <span>{formatDateRangeLabel(dateRange)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['today', 'Today'],
                ['7d', 'Last 7 days'],
                ['month', 'This month'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={preset === key ? 'btn-primary' : 'btn-secondary'}
                onClick={() => applyPreset(key)}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              className="input"
              value={dateRange.startDate}
              onChange={(event) => {
                setPreset('today');
                setDateRange((current: DateRange) => ({ ...current, startDate: event.target.value }));
              }}
            />
            <span className="text-sm text-[var(--color-text-muted)]">to</span>
            <input
              type="date"
              className="input"
              value={dateRange.endDate}
              onChange={(event) => {
                setPreset('today');
                setDateRange((current: DateRange) => ({ ...current, endDate: event.target.value }));
              }}
            />
          </div>
        </div>
      </div>

      {displayError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{displayError}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Latest rate"
          value={formatRate(data?.summary.latestRate)}
          hint={data?.summary.latestAt ? `As of ${formatDate(data.summary.latestAt)}` : pairLabel}
        />
        <MetricCard label="Range low" value={formatRate(data?.summary.minRate)} hint={pairLabel} />
        <MetricCard label="Range high" value={formatRate(data?.summary.maxRate)} hint={pairLabel} />
        <MetricCard
          label="Pulls in range"
          value={data?.summary.pullCount ?? '—'}
          hint={`${data?.summary.successCount ?? 0} success · ${data?.summary.failureCount ?? 0} failed`}
        />
      </div>

      <div className="panel p-5">
        <div className="mb-4 flex items-center gap-2">
          <LineChartIcon className="h-5 w-5 text-[var(--color-accent)]" />
          <h2 className="text-base font-semibold text-[var(--color-heading)]">{pairLabel} trend</h2>
        </div>

        {loading && !data ? (
          <p className="text-sm text-[var(--color-text-muted)]">Loading chart…</p>
        ) : chartData.length === 0 ? (
          <EmptyState
            title="No rate data yet"
            description="Snapshots appear here after the backend exchange-rate sync runs."
          />
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  minTickGap={24}
                  tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickLine={false}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={72}
                  tickFormatter={(value: number) => formatRate(value)}
                />
                <Tooltip
                  formatter={(value: number) => [formatRate(value), 'Rate']}
                  labelFormatter={(_, payload) => {
                    const point = payload?.[0]?.payload as { requestedAt?: string } | undefined;
                    return point?.requestedAt ? formatDate(point.requestedAt) : '';
                  }}
                  contentStyle={{
                    borderRadius: 8,
                    borderColor: 'var(--color-border)',
                    fontSize: 13,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  dot={chartData.length <= 48}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="panel overflow-hidden">
        <div className="border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--color-heading)]">Recent pulls</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Requested</th>
                <th>Status</th>
                <th>Rate</th>
                <th>Previous</th>
                <th>Catalog updated</th>
                <th>HTTP</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {pulls.items.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.requestedAt)}</td>
                  <td>
                    <StatusBadge status={row.status === 'success' ? 'active' : 'failed'} />
                  </td>
                  <td>{formatRate(row.rate)}</td>
                  <td>{formatRate(row.previousRate)}</td>
                  <td>{row.catalogUpdated ? 'Yes' : 'No'}</td>
                  <td>{row.httpStatus ?? '—'}</td>
                  <td className="max-w-xs truncate">{row.errorMessage ?? '—'}</td>
                </tr>
              ))}
              {!pulls.loading && pulls.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[var(--color-text-muted)]">
                    No pull records in this range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <CursorPagination
          canGoBack={pulls.canGoBack}
          canGoForward={pulls.canGoForward}
          onPrev={pulls.goPrev}
          onNext={pulls.goNext}
          limit={pullLimit}
          onLimitChange={setPullLimit}
          itemCount={pulls.items.length}
          loading={pulls.loading}
        />
      </div>
    </div>
  );
}
