/** Stable product codes used at transaction time. */
export const PRODUCT_CODES = {
  EXCHANGE_RATE: 'exchange-rate',
  WALLET_TOPUP: 'wallet-topup',
  CARD_ISSUANCE: 'card-issuance',
  CARD_FUND: 'card-fund',
  CARD_EXPIRY: 'card-expiry',
} as const;

export type ProductCode = (typeof PRODUCT_CODES)[keyof typeof PRODUCT_CODES];

/** Stable UCP codes for seeded charge parameters. */
export const UCP_CODES = {
  GMD_USD_EXCHANGE_RATE: 'gmd-usd-exchange-rate',
  WALLET_TOPUP_FEE_PERCENT: 'wallet-topup-fee-percent',
  CARD_ISSUANCE_FEE_USD: 'card-issuance-fee-usd',
  CARD_EXPIRY_YEARS: 'card-expiry-years',
} as const;

export type UcpCode = (typeof UCP_CODES)[keyof typeof UCP_CODES];
