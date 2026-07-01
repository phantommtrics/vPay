export function formatGmd(amount: number): string {
  return `D${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatShortDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDeviceLabel(device: {
  deviceName: string | null;
  brand: string | null;
  modelName: string | null;
}): string {
  const name = device.deviceName?.trim();
  if (name) return name;
  const model = [device.brand, device.modelName].filter(Boolean).join(' ').trim();
  return model || 'Unknown device';
}

export function formatName(first: string | null, last: string | null, email?: string): string {
  const name = [first, last].filter(Boolean).join(' ').trim();
  return name || email?.split('@')[0] || '—';
}

export function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}
