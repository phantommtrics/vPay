import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

import { PageHeader } from '../../components/ui/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { CopyId } from '../../components/ui/CopyId';
import { DetailRow, DetailSection } from '../../components/ui/DetailSection';
import { fetchCustomerDeviceGroup, type CustomerDeviceGroupDetail } from '../../lib/api';
import { getAdminToken } from '../../lib/auth-storage';
import { formatDate, formatDeviceLabel, formatName } from '../../lib/format';

export function CustomerDeviceDetailPage() {
  const navigate = useNavigate();
  const { groupType, groupKey } = useParams<{ groupType: string; groupKey: string }>();
  const [group, setGroup] = useState<CustomerDeviceGroupDetail | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const token = getAdminToken();
    if (!token || !groupType || !groupKey) return;
    if (groupType !== 'hardware' && groupType !== 'device') {
      setError('Invalid device group type');
      return;
    }

    setError('');
    try {
      const { group: data } = await fetchCustomerDeviceGroup(
        token,
        groupType,
        decodeURIComponent(groupKey),
      );
      setGroup(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load device');
      setGroup(null);
    }
  }, [groupType, groupKey]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!group) {
    return (
      <div className="p-8">
        <p className="text-sm text-[var(--color-text-muted)]">{error || 'Loading device…'}</p>
      </div>
    );
  }

  const representative = group.devices[0];

  return (
    <>
      <PageHeader
        title={representative ? formatDeviceLabel(representative) : 'Device details'}
        description={
          group.groupType === 'hardware'
            ? `Hardware ID · ${group.hardwareId ?? group.groupKey}`
            : `Device ID · ${group.groupKey}`
        }
        breadcrumb={
          <Link to="/device-info/customer-devices" className="hover:text-[var(--color-accent)]">
            Customer devices
          </Link>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge status={group.userCount > 1 ? 'pending' : 'active'} />
            <span className="text-sm text-[var(--color-text-muted)]">
              {group.userCount} linked user{group.userCount === 1 ? '' : 's'}
            </span>
          </div>
        }
      />

      <div className="space-y-6 p-8">
        {error ? (
          <div className="rounded-md border border-[#fcd5df] bg-[#fff5f7] px-4 py-3 text-sm text-[#df1b41]">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <DetailSection title="Device profile">
            <DetailRow
              label="Device"
              value={representative ? formatDeviceLabel(representative) : '—'}
            />
            <DetailRow label="Hardware ID" value={group.hardwareId ?? '—'} />
            <DetailRow
              label="Representative device ID"
              value={<CopyId value={representative?.id ?? group.groupKey} />}
            />
            <DetailRow
              label="OS"
              value={
                representative
                  ? [representative.osName, representative.osVersion].filter(Boolean).join(' ') || '—'
                  : '—'
              }
            />
            <DetailRow label="App version" value={representative?.appVersion ?? '—'} />
            <DetailRow
              label="Emulator"
              value={representative?.isEmulator ? 'Yes' : 'No'}
            />
            <DetailRow
              label="Last seen"
              value={representative ? formatDate(representative.lastSeenAt) : '—'}
            />
          </DetailSection>

          <DetailSection title="Grouping">
            <DetailRow label="Group type" value={group.groupType === 'hardware' ? 'Hardware ID' : 'Device record'} />
            <DetailRow label="Linked users" value={String(group.userCount)} />
            <DetailRow label="Device records" value={String(group.devices.length)} />
            <DetailRow
              label="Last IP"
              value={representative?.lastIpAddress ?? '—'}
            />
          </DetailSection>
        </div>

        <section className="panel overflow-hidden">
          <div className="panel-header">
            <h3 className="text-sm font-semibold text-[var(--color-heading)]">Linked customers</h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Accounts that signed in or transacted from this device
            </p>
          </div>
          {group.users.length === 0 ? (
            <p className="p-6 text-sm text-[var(--color-text-muted)]">No linked users.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>KYC status</th>
                  <th>Document</th>
                  <th>Country</th>
                  <th>KYC submitted</th>
                  <th>Last seen on device</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {group.users.map((user) => (
                  <tr key={user.id}>
                    <td className="font-medium text-[var(--color-heading)]">
                      {formatName(user.firstName, user.lastName, user.email)}
                    </td>
                    <td className="text-[var(--color-text-muted)]">{user.email}</td>
                    <td>
                      <Badge status={user.kycStatus} dot />
                    </td>
                    <td className="text-[var(--color-text-muted)]">
                      {user.documentType?.replace(/_/g, ' ') ?? '—'}
                    </td>
                    <td className="text-[var(--color-text-muted)]">{user.country ?? '—'}</td>
                    <td className="text-[var(--color-text-muted)]">
                      {formatDate(user.kycSubmittedAt)}
                    </td>
                    <td className="text-[var(--color-text-muted)]">
                      {formatDate(user.deviceLastSeenAt)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-accent)] hover:underline"
                        onClick={() => navigate(`/users/${user.id}?tab=kyc`)}>
                        View KYC
                        <ExternalLink size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
