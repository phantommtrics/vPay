export type KycStatus = 'incomplete' | 'pending' | 'approved' | 'rejected';

export type StripeProvisioningStatus = 'none' | 'pending' | 'active' | 'failed';

export type DirectPayProvisioningStatus = 'none' | 'pending' | 'active' | 'failed';

export type FundingOrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled';

export type VirtualCardStatus = 'active' | 'inactive' | 'canceled';

export type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  countryCode: string | null;
  postalCode: string | null;
  kycStatus: KycStatus;
  kycComplete: boolean;
  documentType: string | null;
  documentFrontUrl: string | null;
  documentBackUrl: string | null;
  selfieUrl: string | null;
  kycSubmittedAt: string | null;
  kycRejectionReason: string | null;
  cardTermsAcceptedAt: string | null;
  stripeProvisioningStatus: StripeProvisioningStatus;
  stripeProvisioningError: string | null;
  stripeConnectedAccountId: string | null;
  directPayProvisioningStatus: DirectPayProvisioningStatus;
  directPayProvisioningError: string | null;
  directPayBusinessId: string | null;
  deviceLockEnabled: boolean;
  deviceLockActiveOnThisDevice?: boolean;
  monthlyDevicesUsed: number;
  monthlyDevicesLimit: number;
};

export type CheckoutWallet = {
  gatewayId: string;
  code: string;
  name: string;
  checkoutAdapter: string;
  hasStoredPayerPhone: boolean;
};

export type FundingOrderSummary = {
  id: string;
  amountGmd: number;
  feeGmd: number;
  totalGmd: number;
  usdEstimate: number;
  status: FundingOrderStatus;
  directPayOrderId: string | null;
  directPayOrderPublicCode: string | null;
  paidAt: string | null;
  createdAt: string;
};

export type FundPrepareResponse = {
  ok: boolean;
  funding: FundingOrderSummary;
  exchangeRate: number;
  feePercent: number;
  simulationEnabled?: boolean;
  businessId: string | null;
  order: {
    id: string;
    publicCode: string;
    status: string;
    total: number;
    currency: string;
  } | null;
  wallets: CheckoutWallet[];
  prepareHint?: string;
};

export type FundWalletCheckoutResponse = {
  ok: boolean;
  fundingId: string;
  businessId: string;
  orderId: string;
  launchUrl: string;
  qrPayload: string;
  paymentHtml: string | null;
  checkoutAdapter: string;
};

export type VirtualCardSummary = {
  id: string;
  stripeCardId: string;
  last4: string;
  brand: string;
  expMonth: number;
  expYear: number;
  status: VirtualCardStatus;
  expired: boolean;
  balance: number;
  balanceUsd: number;
  balanceGmdEstimate: number;
  balanceSource: 'stripe' | 'simulated' | 'unavailable';
  currency: string;
  cardholderName: string;
};

export type CardsResponse = {
  cards: VirtualCardSummary[];
  provisioning: {
    status: StripeProvisioningStatus;
    error: string | null;
  };
  issuance: {
    feeUsd: number;
    feeGmd: number;
    exchangeRate: number;
    required: boolean;
    expiryYears: number;
    paid: boolean;
    paidAt: string | null;
    canReissue: boolean;
  };
  stripePublishableKey: string | null;
  stripeConnectedAccountId: string | null;
};

export type CardIssuancePayResponse = {
  ok: boolean;
  feeUsd?: number;
  feeGmd?: number;
  paidAt?: string;
  alreadyPaid?: boolean;
  feeWaived?: boolean;
  wallet?: WalletSummary;
  provisioning: { status: string };
};

export type KycSubmitPayload = {
  documentType: DocumentType;
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  city: string;
  country: string;
  countryCode?: string;
  postalCode: string;
  acceptCardTerms: true;
};

export type ProfileUpdate = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  country?: string;
  countryCode?: string;
  postalCode?: string;
  documentType?: string;
};

export type DocumentType =
  | 'national_id'
  | 'passport'
  | 'drivers_license'
  | 'residence_permit';

export type WalletSummary = {
  phoneNumber: string;
  balanceGmd: number;
  usdEstimate: number;
  exchangeRate: number;
};

export type WalletFundingSource = 'aps' | 'wave' | 'simulation';

export type WalletTransactionSummary = {
  id: string;
  type: string;
  amountGmd: number;
  balanceBeforeGmd: number;
  balanceAfterGmd: number;
  usdEstimate: number | null;
  exchangeRate: number | null;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  fundingSource: WalletFundingSource | null;
  fundingSourceLabel: string | null;
  createdAt: string;
};

export type CardFundTransactionSummary = {
  id: string;
  amountGmd: number;
  feeGmd: number;
  totalGmd: number;
  amountUsd: number;
  exchangeRate: number;
  stripeBalanceBeforeUsd: number;
  stripeBalanceAfterUsd: number;
  gmdEstimateBefore: number;
  gmdEstimateAfter: number;
  stripeCredited: boolean;
  status: string;
  createdAt: string;
};
