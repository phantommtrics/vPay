import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { DocumentViewer } from '../components/DocumentViewer';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { CopyId } from '../components/ui/CopyId';
import { DetailRow, DetailSection } from '../components/ui/DetailSection';
import { Tabs } from '../components/ui/Tabs';
import {
  approveKyc,
  fetchAdminStats,
  fetchAdminUser,
  fetchUserDevices,
  unlockAdminUserDevice,
  fetchUserFundingOrders,
  fetchUserWallet,
  fetchUserWalletTransactions,
  provisionCard,
  provisionDirectPay,
  updateCardStatus,
  type AdminCardSummary,
  type AdminUser,
  type AdminUserDevice,
  type FundingOrder,
  type WalletTransaction,
} from '../lib/api';
import { getAdminToken } from '../lib/auth-storage';
import { formatDate, formatDeviceLabel, formatGmd, formatName, formatUsd } from '../lib/format';

type TabId = 'overview' | 'kyc' | 'wallet' | 'devices' | 'provisioning';

export function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [user, setUser] = useState<AdminUser | null>(null);
  const [tab, setTab] = useState<TabId>(() => {
    if (
      initialTab === 'kyc' ||
      initialTab === 'wallet' ||
      initialTab === 'devices' ||
      initialTab === 'provisioning'
    ) {
      return initialTab;
    }
    return 'overview';
  });
  const [wallet, setWallet] = useState<Awaited<ReturnType<typeof fetchUserWallet>> | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [fundingOrders, setFundingOrders] = useState<FundingOrder[]>([]);
  const [devices, setDevices] = useState<AdminUserDevice[]>([]);
  const [directPayHolder, setDirectPayHolder] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | 'approve' | 'card-free' | 'card-charge' | 'directpay' | 'unlock-device'>(null);
  const [cardAction, setCardAction] = useState<{
    card: AdminCardSummary;
    action: 'freeze' | 'unfreeze';
  } | null>(null);

  const load = useCallback(async () => {
    const token = getAdminToken();
    if (!token || !userId) return;
    setError('');
    try {
      const [{ user: data }, statsRes, walletRes, txRes, fundRes, devicesRes] = await Promise.all([
        fetchAdminUser(token, userId),
        fetchAdminStats(token),
        fetchUserWallet(token, userId),
        fetchUserWalletTransactions(token, userId, { limit: 50 }),
        fetchUserFundingOrders(token, userId),
        fetchUserDevices(token, userId),
      ]);
      setUser(data);
      setDirectPayHolder(statsRes.stats.directPayMerchantEmail);
      setWallet(walletRes);
      setTransactions(txRes.transactions);
      setFundingOrders(fundRes.orders);
      setDevices(devicesRes.devices);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customer');
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async () => {
    const token = getAdminToken();
    if (!token || !user || !confirm) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (confirm === 'approve') {
        await approveKyc(token, user.id);
        setMessage('KYC approved successfully.');
      } else if (confirm === 'card-free') {
        await provisionCard(token, user.id, false);
        setMessage('Card provisioning started (issuance fee waived).');
      } else if (confirm === 'card-charge') {
        await provisionCard(token, user.id, true);
        setMessage('Card provisioning started (customer charged).');
      } else if (confirm === 'directpay') {
        await provisionDirectPay(token, user.id);
        setMessage('directPay merchant linked.');
      } else if (confirm === 'unlock-device') {
        const { user: updated } = await unlockAdminUserDevice(token, user.id);
        setUser(updated);
        setMessage('Device lock cleared. The customer can sign in from any device.');
      }
      setConfirm(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const runCardAction = async () => {
    const token = getAdminToken();
    if (!token || !user || !cardAction) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await updateCardStatus(
        token,
        user.id,
        cardAction.card.id,
        cardAction.action === 'freeze' ? 'inactive' : 'active',
      );
      setMessage(cardAction.action === 'freeze' ? 'Card frozen.' : 'Card unfrozen.');
      setCardAction(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Card update failed');
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <div className="p-8">
        <p className="text-sm text-[var(--color-text-muted)]">{error || 'Loading customer…'}</p>
      </div>
    );
  }

  const directPayTaken =
    Boolean(directPayHolder) && directPayHolder !== user.email && !user.directPayBusinessId;

  return (
    <>
      <PageHeader
        title={formatName(user.firstName, user.lastName, user.email)}
        description={user.email}
        breadcrumb={
          <Link to="/users" className="hover:text-[var(--color-accent)]">
            Customers
          </Link>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge status={user.kycStatus} dot />
            <Badge status={user.stripeProvisioningStatus} />
            <Badge status={user.directPayProvisioningStatus} />
          </div>
        }
      />

      <Tabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'kyc', label: 'KYC' },
          { id: 'wallet', label: 'Wallet & activity' },
          { id: 'devices', label: `Devices (${devices.length})` },
          { id: 'provisioning', label: 'Provisioning' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      <div className="p-8 space-y-6">
        {error ? (
          <div className="rounded-md border border-[#fcd5df] bg-[#fff5f7] px-4 py-3 text-sm text-[#df1b41]">{error}</div>
        ) : null}
        {message ? (
          <div className="rounded-md border border-[#a7f3d0] bg-[var(--color-accent-soft)] px-4 py-3 text-sm text-[var(--color-accent)]">
            {message}
          </div>
        ) : null}

        {tab === 'overview' ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <DetailSection title="Customer details">
                <DetailRow label="Customer ID" value={<CopyId value={user.id} />} />
                <DetailRow label="Phone" value={user.phone ?? '—'} />
                <DetailRow label="Date of birth" value={user.dateOfBirth ?? '—'} />
                <DetailRow
                  label="Address"
                  value={[user.address, user.city, user.country, user.postalCode].filter(Boolean).join(', ') || '—'}
                />
                <DetailRow label="Member since" value={formatDate(user.createdAt)} />
              </DetailSection>
            </div>
            <div className="space-y-4">
              <div className="panel p-5">
                <p className="metric-label">vPay wallet</p>
                <p className="metric-value mt-1">
                  {wallet?.wallet ? formatGmd(wallet.wallet.balanceGmd) : 'No wallet'}
                </p>
                {wallet?.wallet ? (
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    ≈ {formatUsd(wallet.wallet.usdEstimate)} · {wallet.wallet.phoneNumber}
                  </p>
                ) : null}
              </div>
              <div className="panel p-5">
                <p className="metric-label">Card balance</p>
                <p className="metric-value mt-1">
                  {wallet?.card ? formatUsd(wallet.card.balanceUsd) : '—'}
                </p>
                {wallet?.card ? (
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    ≈ {formatGmd(wallet.card.balanceGmdEstimate)} · {wallet.card.balanceSource}
                  </p>
                ) : null}
              </div>
              <div className="panel p-5">
                <p className="metric-label">Virtual cards</p>
                <p className="metric-value mt-1">{user.virtualCardCount}</p>
                {user.latestCardLast4 ? (
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">Latest •••• {user.latestCardLast4}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'kyc' ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <DetailSection title="Verification status">
              <DetailRow label="Status" value={<Badge status={user.kycStatus} dot />} />
              <DetailRow label="Submitted" value={formatDate(user.kycSubmittedAt)} />
              <DetailRow label="Document type" value={user.documentType?.replace(/_/g, ' ') ?? '—'} />
              <DetailRow label="Terms accepted" value={formatDate(user.cardTermsAcceptedAt)} />
              {user.kycRejectionReason ? (
                <DetailRow label="Rejection reason" value={user.kycRejectionReason} />
              ) : null}
              <DetailRow
                label="Submitted from device"
                value={
                  user.kycSubmittedDevice ? (
                    <DeviceSummary device={user.kycSubmittedDevice} />
                  ) : (
                    '—'
                  )
                }
              />
            </DetailSection>
            <section className="panel">
              <div className="panel-header">
                <h3 className="text-sm font-semibold text-[var(--color-heading)]">Documents</h3>
              </div>
              <div className="panel-body">
                <DocumentViewer
                  frontUrl={user.documentFrontUrl}
                  backUrl={user.documentBackUrl}
                  selfieUrl={user.selfieUrl}
                />
              </div>
            </section>
            {user.kycStatus === 'pending' ? (
              <div className="lg:col-span-2 flex gap-2">
                <button type="button" className="btn-primary" onClick={() => setConfirm('approve')}>
                  Approve KYC
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === 'wallet' ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="panel p-5">
                <p className="metric-label">Wallet balance</p>
                <p className="metric-value mt-1">{wallet?.wallet ? formatGmd(wallet.wallet.balanceGmd) : '—'}</p>
              </div>
              <div className="panel p-5">
                <p className="metric-label">USD equivalent</p>
                <p className="metric-value mt-1">{wallet?.wallet ? formatUsd(wallet.wallet.usdEstimate) : '—'}</p>
              </div>
              <div className="panel p-5">
                <p className="metric-label">Exchange rate</p>
                <p className="metric-value mt-1">{wallet?.wallet ? wallet.wallet.exchangeRate : '—'}</p>
              </div>
            </div>

            <section className="panel overflow-hidden">
              <div className="panel-header">
                <h3 className="text-sm font-semibold text-[var(--color-heading)]">Wallet ledger</h3>
              </div>
              {transactions.length === 0 ? (
                <p className="p-6 text-sm text-[var(--color-text-muted)]">No wallet transactions.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Balance</th>
                      <th>Source</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="text-[var(--color-text-muted)]">{formatDate(tx.createdAt)}</td>
                        <td><Badge status={tx.type} /></td>
                        <td className="font-mono">{formatGmd(tx.amountGmd)}</td>
                        <td className="font-mono text-[var(--color-text-muted)]">{formatGmd(tx.balanceAfterGmd)}</td>
                        <td className="text-[var(--color-text-muted)]">{tx.fundingSourceLabel ?? '—'}</td>
                        <td className="max-w-[180px] truncate">{tx.description ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="panel overflow-hidden">
              <div className="panel-header">
                <h3 className="text-sm font-semibold text-[var(--color-heading)]">Funding orders</h3>
              </div>
              {fundingOrders.length === 0 ? (
                <p className="p-6 text-sm text-[var(--color-text-muted)]">No funding orders.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Code</th>
                      <th>Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fundingOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="text-[var(--color-text-muted)]">{formatDate(order.createdAt)}</td>
                        <td className="font-mono">{formatGmd(order.amountGmd)}</td>
                        <td className="font-mono">{formatGmd(order.totalGmd)}</td>
                        <td><Badge status={order.status} dot /></td>
                        <td className="font-mono text-xs">{order.directPayOrderPublicCode ?? '—'}</td>
                        <td className="text-[var(--color-text-muted)]">{formatDate(order.paidAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        ) : null}

        {tab === 'devices' ? (
          <div className="space-y-6">
            <section className="panel overflow-hidden">
              <div className="panel-header flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-heading)]">Device lock</h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    When enabled, the customer can only sign in from their locked device
                  </p>
                </div>
                {user.deviceLockEnabled ? (
                  <button
                    type="button"
                    onClick={() => setConfirm('unlock-device')}
                    disabled={busy}
                    className="rounded-lg bg-[#df1b41] px-4 py-2 text-sm font-medium text-white hover:bg-[#c9183a] disabled:opacity-50">
                    Unlock device
                  </button>
                ) : (
                  <span className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-muted)]">
                    Not locked
                  </span>
                )}
              </div>
              <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Status</p>
                  <p className="mt-1 text-sm font-medium text-[var(--color-heading)]">
                    {user.deviceLockEnabled ? 'Locked to one device' : 'Off'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                    Monthly devices
                  </p>
                  <p className="mt-1 text-sm font-medium text-[var(--color-heading)]">
                    {user.monthlyDevicesUsed} / {user.monthlyDevicesLimit} this month
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                    Locked device
                  </p>
                  <p className="mt-1 text-sm font-medium text-[var(--color-heading)]">
                    {user.lockedDevice ? formatDeviceLabel(user.lockedDevice) : '—'}
                  </p>
                  {user.lockedDevice ? (
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {[user.lockedDevice.osName, user.lockedDevice.osVersion].filter(Boolean).join(' ') || '—'}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="panel overflow-hidden">
              <div className="panel-header">
                <h3 className="text-sm font-semibold text-[var(--color-heading)]">Registered devices</h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Devices used to sign in and perform transactions
                </p>
              </div>
            {devices.length === 0 ? (
              <p className="p-6 text-sm text-[var(--color-text-muted)]">No devices registered yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>OS</th>
                    <th>Hardware ID</th>
                    <th>App</th>
                    <th>Last IP</th>
                    <th>Last seen</th>
                    <th>First seen</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => (
                    <tr key={device.id}>
                      <td>
                        <div className="space-y-1">
                          <p className="font-medium text-[var(--color-heading)]">
                            {formatDeviceLabel(device)}
                            {device.isEmulator ? (
                              <span className="ml-2 text-xs text-[#df1b41]">Emulator</span>
                            ) : null}
                            {user.kycSubmittedDevice?.id === device.id ? (
                              <span className="ml-2 text-xs text-[var(--color-accent)]">KYC device</span>
                            ) : null}
                            {user.lockedDevice?.id === device.id ? (
                              <span className="ml-2 text-xs text-[#df1b41]">Locked device</span>
                            ) : null}
                          </p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {[device.manufacturer, device.deviceType?.toLowerCase()].filter(Boolean).join(' · ') || '—'}
                          </p>
                          <CopyId value={device.id} />
                        </div>
                      </td>
                      <td className="text-[var(--color-text-muted)]">
                        {[device.osName, device.osVersion].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td className="font-mono text-xs text-[var(--color-text-muted)]">
                        {device.hardwareId ?? device.imei ?? '—'}
                      </td>
                      <td className="text-[var(--color-text-muted)]">{device.appVersion ?? '—'}</td>
                      <td className="font-mono text-xs text-[var(--color-text-muted)]">
                        {device.lastIpAddress ?? '—'}
                      </td>
                      <td className="text-[var(--color-text-muted)]">{formatDate(device.lastSeenAt)}</td>
                      <td className="text-[var(--color-text-muted)]">{formatDate(device.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            </section>
          </div>
        ) : null}

        {tab === 'provisioning' ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <DetailSection title="Stripe card">
              <DetailRow label="Status" value={<Badge status={user.stripeProvisioningStatus} dot />} />
              <DetailRow label="Connected account" value={user.stripeConnectedAccountId ? <CopyId value={user.stripeConnectedAccountId} /> : '—'} />
              <DetailRow label="Issuance paid" value={user.cardIssuancePaidAt ? formatDate(user.cardIssuancePaidAt) : 'No'} />
              <DetailRow label="Issuance fee" value={user.cardIssuanceFeeUsd ? formatUsd(user.cardIssuanceFeeUsd) : '—'} />
              {user.stripeProvisioningError ? (
                <DetailRow label="Error" value={<span className="text-[#df1b41]">{user.stripeProvisioningError}</span>} />
              ) : null}
            </DetailSection>
            <DetailSection title="directPay">
              <DetailRow label="Status" value={<Badge status={user.directPayProvisioningStatus} dot />} />
              <DetailRow label="Business ID" value={user.directPayBusinessId ?? '—'} />
              <DetailRow label="Slug" value={user.directPaySlug ?? '—'} />
              {user.directPayProvisioningError ? (
                <DetailRow label="Error" value={<span className="text-[#df1b41]">{user.directPayProvisioningError}</span>} />
              ) : null}
            </DetailSection>

            {user.cards.length > 0 ? (
              <section className="panel lg:col-span-2 overflow-hidden">
                <div className="panel-header">
                  <h3 className="text-sm font-semibold text-[var(--color-heading)]">Virtual cards</h3>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Card</th>
                      <th>Expires</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.cards.map((card) => (
                      <tr key={card.id}>
                        <td className="font-mono">•••• {card.last4}</td>
                        <td className="text-[var(--color-text-muted)]">
                          {String(card.expMonth).padStart(2, '0')}/{card.expYear}
                          {card.expired ? ' (expired)' : ''}
                        </td>
                        <td>
                          {card.expired ? (
                            <Badge status="inactive" />
                          ) : card.frozen ? (
                            <Badge status="inactive" dot />
                          ) : (
                            <Badge status="active" dot />
                          )}
                        </td>
                        <td>
                          {!card.expired && card.status !== 'canceled' ? (
                            card.frozen ? (
                              <button
                                type="button"
                                className="text-sm font-medium text-[var(--color-accent)] hover:underline"
                                onClick={() => setCardAction({ card, action: 'unfreeze' })}>
                                Unfreeze
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="text-sm font-medium text-[#df1b41] hover:underline"
                                onClick={() => setCardAction({ card, action: 'freeze' })}>
                                Freeze card
                              </button>
                            )
                          ) : (
                            <span className="text-xs text-[var(--color-text-muted)]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : null}

            <section className="panel lg:col-span-2">
              <div className="panel-header">
                <h3 className="text-sm font-semibold text-[var(--color-heading)]">Admin actions</h3>
              </div>
              <div className="panel-body grid gap-3 sm:grid-cols-2">
                <ActionCard
                  title="Approve KYC"
                  description="Mark identity verification as approved"
                  disabled={user.kycStatus !== 'pending'}
                  onClick={() => setConfirm('approve')}
                />
                <ActionCard
                  title="Issue card (free)"
                  description={
                    user.hasActiveCard
                      ? `Active card on file (•••• ${user.latestCardLast4}). Freeze or wait for expiry to reissue.`
                      : 'Waive issuance fee and provision Stripe virtual card'
                  }
                  disabled={!user.kycComplete || user.hasActiveCard}
                  onClick={() => setConfirm('card-free')}
                />
                <ActionCard
                  title="Issue card (charge customer)"
                  description={
                    user.hasActiveCard
                      ? 'Customer already has a non-expired card'
                      : 'Debit vPay wallet for issuance fee, then provision'
                  }
                  disabled={!user.kycComplete || user.hasActiveCard}
                  onClick={() => setConfirm('card-charge')}
                />
                <ActionCard
                  title="Connect directPay merchant"
                  description={
                    directPayTaken
                      ? `Already linked to ${directPayHolder}`
                      : 'Platform merchant account (one per platform)'
                  }
                  disabled={!user.kycComplete || directPayTaken}
                  onClick={() => setConfirm('directpay')}
                />
              </div>
            </section>
          </div>
        ) : null}
      </div>

      <ConfirmDialog open={confirm === 'approve'} title="Approve KYC" description={`Approve verification for ${user.email}?`} confirmLabel="Approve" loading={busy} onConfirm={() => void runAction()} onCancel={() => setConfirm(null)} />
      <ConfirmDialog open={confirm === 'card-free'} title="Issue card (free)" description="Provision a virtual card and waive the issuance fee?" loading={busy} onConfirm={() => void runAction()} onCancel={() => setConfirm(null)} />
      <ConfirmDialog open={confirm === 'card-charge'} title="Issue card (charge)" description="Debit the customer's wallet for the issuance fee, then provision the card?" loading={busy} onConfirm={() => void runAction()} onCancel={() => setConfirm(null)} />
      <ConfirmDialog open={confirm === 'directpay'} title="Connect directPay" description="Provision this customer as the platform directPay merchant?" loading={busy} onConfirm={() => void runAction()} onCancel={() => setConfirm(null)} />
      <ConfirmDialog
        open={confirm === 'unlock-device'}
        title="Unlock device"
        description={
          user.lockedDevice
            ? `Clear device lock for ${user.email}? They will be able to sign in from any device. Currently locked to ${formatDeviceLabel(user.lockedDevice)}.`
            : `Clear device lock for ${user.email}? They will be able to sign in from any device.`
        }
        confirmLabel="Unlock device"
        destructive
        loading={busy}
        onConfirm={() => void runAction()}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={cardAction?.action === 'freeze'}
        title="Freeze card"
        description={`Freeze card •••• ${cardAction?.card.last4}? The customer will not be able to use it until unfrozen.`}
        confirmLabel="Freeze card"
        destructive
        loading={busy}
        onConfirm={() => void runCardAction()}
        onCancel={() => setCardAction(null)}
      />
      <ConfirmDialog
        open={cardAction?.action === 'unfreeze'}
        title="Unfreeze card"
        description={`Restore card •••• ${cardAction?.card.last4} to active status?`}
        confirmLabel="Unfreeze card"
        loading={busy}
        onConfirm={() => void runCardAction()}
        onCancel={() => setCardAction(null)}
      />
    </>
  );
}

function DeviceSummary({ device }: { device: AdminUserDevice }) {
  return (
    <div className="space-y-1">
      <p className="font-medium text-[var(--color-heading)]">
        {formatDeviceLabel(device)}
        {device.isEmulator ? <span className="ml-2 text-xs text-[#df1b41]">Emulator</span> : null}
      </p>
      <p className="text-xs text-[var(--color-text-muted)]">
        {[device.osName, device.osVersion].filter(Boolean).join(' ') || 'Unknown OS'}
        {device.appVersion ? ` · v${device.appVersion}` : ''}
      </p>
      <CopyId value={device.id} />
    </div>
  );
}

function ActionCard({
  title,
  description,
  disabled,
  onClick,
}: {
  title: string;
  description: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-[var(--color-border)] p-4 text-left transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-canvas-subtle)] disabled:cursor-not-allowed disabled:opacity-50">
      <p className="text-sm font-semibold text-[var(--color-heading)]">{title}</p>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">{description}</p>
    </button>
  );
}
