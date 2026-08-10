/** Stable product codes used at transaction time. */
export const PRODUCT_CODES = {
  EXCHANGE_RATE: 'exchange-rate',
  WALLET_TOPUP: 'wallet-topup',
  CARD_ISSUANCE: 'card-issuance',
  CARD_FUND: 'card-fund',
  CARD_EXPIRY: 'card-expiry',
  ACCOUNT_TERMINATION: 'account-termination',
} as const;

export type ProductCode = (typeof PRODUCT_CODES)[keyof typeof PRODUCT_CODES];

/** Stable UCP codes for seeded charge parameters. */
export const UCP_CODES = {
  GMD_USD_EXCHANGE_RATE: 'gmd-usd-exchange-rate',
  WALLET_TOPUP_FEE_PERCENT: 'wallet-topup-fee-percent',
  CARD_FUND_FEE_PERCENT: 'card-fund-fee-percent',
  CARD_ISSUANCE_FEE_USD: 'card-issuance-fee-usd',
  CARD_EXPIRY_YEARS: 'card-expiry-years',
  ACCOUNT_TERMINATION_FORFEITURE: 'account-termination-forfeiture',
} as const;

export type UcpCode = (typeof UCP_CODES)[keyof typeof UCP_CODES];

/** Stable business account codes for platform ledger routing. */
export const BUSINESS_ACCOUNT_CODES = {
  PAYMENTS_RECEIVED: 'payments-received',
  CARD_FUNDING_CLEARING: 'card-funding-clearing',
  TERMINATED_BALANCES: 'terminated-balances',
} as const;

export type BusinessAccountCode = (typeof BUSINESS_ACCOUNT_CODES)[keyof typeof BUSINESS_ACCOUNT_CODES];
