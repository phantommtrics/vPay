import { VirtualCardStatus, type VirtualCard } from '@prisma/client';

import { getCardExpiryConfigAsync } from './fund-config.js';

/** Card is valid through the last day of expMonth/expYear (inclusive). */
export function isVirtualCardExpired(
  expMonth: number,
  expYear: number,
  now: Date = new Date(),
): boolean {
  const expiryEnd = new Date(expYear, expMonth, 0, 23, 59, 59, 999);
  return now > expiryEnd;
}

export function isVirtualCardActive(card: Pick<VirtualCard, 'expMonth' | 'expYear' | 'status'>): boolean {
  if (card.status === VirtualCardStatus.CANCELED) {
    return false;
  }
  return !isVirtualCardExpired(card.expMonth, card.expYear);
}

export async function computeCardExpirationAsync(from: Date = new Date()): Promise<{
  expMonth: number;
  expYear: number;
}> {
  const { expiryYears } = await getCardExpiryConfigAsync();
  const target = new Date(from);
  target.setFullYear(target.getFullYear() + expiryYears);

  return {
    expMonth: target.getMonth() + 1,
    expYear: target.getFullYear(),
  };
}
