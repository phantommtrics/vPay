const FUND_ERROR_RULES: Array<{ test: RegExp; message: string }> = [
  {
    test: /insufficient balance/i,
    message: 'Your wallet does not have enough balance for this payment.',
  },
  {
    test: /does not match this order|authorization required|invalid aps checkout state|session expired/i,
    message: 'This payment session expired. Tap Fund card again to receive a new code.',
  },
  {
    test: /unable to reach the server/i,
    message: 'Unable to reach the server. Check your connection and try again.',
  },
  {
    test: /directpay|payment request failed/i,
    message: 'We could not complete this payment. Please try again.',
  },
];

function humanizeSnippet(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return 'Something went wrong. Please try again.';
  if (trimmed.length <= 120 && !trimmed.includes('directPay') && !trimmed.includes('/api/')) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }
  return 'Something went wrong. Please try again.';
}

export function toFriendlyFundError(raw: string): string {
  for (const rule of FUND_ERROR_RULES) {
    if (rule.test.test(raw)) return rule.message;
  }
  return humanizeSnippet(raw);
}
