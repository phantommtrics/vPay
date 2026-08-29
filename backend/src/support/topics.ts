export const SUPPORT_TOPICS = [
  { key: 'account', label: 'Account' },
  { key: 'cards', label: 'Cards' },
  { key: 'funding', label: 'Funding' },
  { key: 'kyc', label: 'Verification' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'other', label: 'Other' },
] as const;

export type SupportTopicKey = (typeof SUPPORT_TOPICS)[number]['key'];
export type SupportKind = 'question' | 'issue';

const TOPIC_KEYS = new Set<string>(SUPPORT_TOPICS.map((topic) => topic.key));

export function isSupportTopic(value: string): value is SupportTopicKey {
  return TOPIC_KEYS.has(value);
}

export function topicLabel(key: SupportTopicKey): string {
  return SUPPORT_TOPICS.find((topic) => topic.key === key)?.label ?? 'Other';
}
