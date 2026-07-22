import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CreditCard, Users, Wallet } from 'lucide-react';

import { PageHeader } from '../components/ui/PageHeader';
import { MetricCard } from '../components/ui/MetricCard';
import { Badge } from '../components/ui/Badge';
import {
  fetchAdminStats,
  fetchPlatformActivity,
  type AdminStats,
  type PlatformActivity,
} from '../lib/api';
import { getAdminToken } from '../lib/auth-storage';
import { formatDate, formatGmd, formatName } from '../lib/format';

export function DashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [activity, setActivity] = useState<PlatformActivity | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getAdminToken();
    if (!token) return;
    Promise.all([fetchAdminStats(token), fetchPlatformActivity(token, 15)])
      .then(([statsRes, activityRes]) => {
        setStats(statsRes.stats);
        setActivity(activityRes);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard'));
  }, []);

  return (
    <>
      <PageHeader
        title="Home"
        description="Overview of platform health, customer activity, and items needing attention."
      />
      <div className="p-8 space-y-8">
        {error ? (
          <div className="rounded-md border border-[#fcd5df] bg-[#fff5f7] px-4 py-3 text-sm text-[#df1b41]">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Pending KYC"
            value={stats?.pendingKyc ?? '—'}
            hint="Reviews awaiting decision"
            onClick={() => window.location.assign('/kyc')}
          />
          <MetricCard
            label="Platform wallet balance"
            value={stats ? formatGmd(stats.totalWalletBalanceGmd) : '—'}
            hint={`${stats?.walletsWithBalance ?? 0} wallets with funds`}
          />
          <MetricCard
            label="Active cards"
            value={stats?.activeCards ?? '—'}
            hint={`${stats?.totalUsers ?? 0} total customers`}
          />
          <MetricCard
            label="Deposits (7 days)"
            value={stats?.depositsLast7Days ?? '—'}
            hint={`${stats?.pendingFundingOrders ?? 0} pending funding orders`}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="panel">
            <div className="panel-header flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--color-heading)]">Recent wallet activity</h2>
              <Link
                to="/reports/transactions"
                className="flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline">
                View all <ArrowRight size={12} />
              </Link>
            </div>
            {!activity?.walletTransactions.length ? (
              <p className="p-6 text-sm text-[var(--color-text-muted)]">No transactions yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.walletTransactions.slice(0, 8).map((tx) => (
                    <tr key={tx.id} className="clickable" onClick={() => window.location.assign(`/users/${tx.user.id}`)}>
                      <td>
                        <Link to={`/users/${tx.user.id}`} className="font-medium text-[var(--color-heading)] hover:text-[var(--color-accent)]">
                          {formatName(tx.user.firstName, tx.user.lastName, tx.user.email)}
                        </Link>
                        <p className="text-xs text-[var(--color-text-muted)]">{tx.user.email}</p>
                      </td>
                      <td><Badge status={tx.type} /></td>
                      <td className="font-mono text-[13px]">{formatGmd(tx.amountGmd)}</td>
                      <td className="text-[var(--color-text-muted)]">{formatDate(tx.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2 className="text-sm font-semibold text-[var(--color-heading)]">Quick actions</h2>
            </div>
            <div className="panel-body space-y-3">
              <Link
                to="/kyc"
                className="flex items-center gap-3 rounded-md border border-[var(--color-border)] p-4 transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-canvas-subtle)]">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                  <Users size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--color-heading)]">Review KYC submissions</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {stats?.pendingKyc ?? 0} pending verification{stats?.pendingKyc === 1 ? '' : 's'}
                  </p>
                </div>
                <ArrowRight size={16} className="text-[var(--color-text-muted)]" />
              </Link>
              <Link
                to="/users"
                className="flex items-center gap-3 rounded-md border border-[var(--color-border)] p-4 transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-canvas-subtle)]">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#e8f4fd] text-[#0055bc]">
                  <Wallet size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--color-heading)]">Customer wallets</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {stats ? formatGmd(stats.totalWalletBalanceGmd) : '—'} total balance
                  </p>
                </div>
                <ArrowRight size={16} className="text-[var(--color-text-muted)]" />
              </Link>
              <Link
                to="/reports/transactions"
                className="flex items-center gap-3 rounded-md border border-[var(--color-border)] p-4 transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-canvas-subtle)]">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#f3e8ff] text-[#6b21a8]">
                  <CreditCard size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--color-heading)]">Transaction reports</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Funding orders & ledger flows</p>
                </div>
                <ArrowRight size={16} className="text-[var(--color-text-muted)]" />
              </Link>
              {stats?.directPayMerchantEmail ? (
                <div className="rounded-md bg-[var(--color-canvas-subtle)] px-4 py-3 text-xs text-[var(--color-text-muted)]">
                  directPay merchant: <span className="font-medium text-[var(--color-heading)]">{stats.directPayMerchantEmail}</span>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
