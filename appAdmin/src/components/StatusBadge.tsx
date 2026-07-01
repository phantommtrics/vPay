import type { KycStatus, ProvisioningStatus } from '../lib/api';

const styles: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  active: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
  failed: 'bg-red-100 text-red-700',
  incomplete: 'bg-gray-100 text-gray-700',
  none: 'bg-gray-100 text-gray-600',
  inactive: 'bg-gray-100 text-gray-600',
};

type StatusBadgeProps = {
  status: KycStatus | ProvisioningStatus | string;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const key = status.toLowerCase();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[key] ?? styles.none}`}>
      {key}
    </span>
  );
}
