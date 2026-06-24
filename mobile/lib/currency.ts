const CURRENCY_SYMBOLS: Record<string, string> = {
  usd: '$',
  gbp: '£',
  eur: '€',
};

export function formatCardBalance(amount: number, currency: string): string {
  const code = currency.toLowerCase();
  const symbol = CURRENCY_SYMBOLS[code] ?? `${code.toUpperCase()} `;
  return `${symbol}${amount.toFixed(2)}`;
}

export function formatMaskedCardBalance(currency: string): string {
  const code = currency.toLowerCase();
  const symbol = CURRENCY_SYMBOLS[code] ?? '';
  return `${symbol}••••••`;
}

export function formatGmd(amount: number): string {
  return `D ${amount.toFixed(2)}`;
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function formatSignedGmd(amount: number, credit: boolean): string {
  const prefix = credit ? '+' : '−';
  return `${prefix}${formatGmd(Math.abs(amount))}`;
}

export function formatSignedUsd(amount: number, credit: boolean): string {
  const prefix = credit ? '+' : '−';
  return `${prefix}${formatUsd(Math.abs(amount))}`;
}
