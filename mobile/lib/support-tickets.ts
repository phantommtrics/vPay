import type { SupportTicketSummary, SupportTopic } from '@/lib/types';

export const SUPPORT_TOPICS: SupportTopic[] = [
  { key: 'account', label: 'Account' },
  { key: 'cards', label: 'Cards' },
  { key: 'funding', label: 'Funding' },
  { key: 'kyc', label: 'Verification' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'other', label: 'Other' },
];

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Submitted',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  ON_HOLD: 'On hold',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
  REOPENED: 'Reopened',
  ESCALATED: 'Escalated',
};

export function supportStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, ' ').toLowerCase();
}

export function formatSupportTicketDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatSupportTicketDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function supportTicketKindLabel(ticket: SupportTicketSummary): string {
  return ticket.kind === 'issue' ? 'Problem' : 'Question';
}

export function supportTopicLabel(topic: SupportTicketSummary['topic']): string {
  return SUPPORT_TOPICS.find((item) => item.key === topic)?.label ?? 'Other';
}
