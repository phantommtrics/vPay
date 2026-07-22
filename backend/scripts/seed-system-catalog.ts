import 'dotenv/config';

import {
  CatalogStatus,
  DenominationUnitType,
  ProductUnitType,
  ServiceBehaviour,
  ServiceType,
  UcpCalculationType,
  UcpType,
  UcpUnit,
  BusinessAccountPurpose,
  BusinessEntityType,
} from '@prisma/client';

import { PRODUCT_CODES, UCP_CODES, BUSINESS_ACCOUNT_CODES } from '../src/settlement/catalog-codes.js';
import { invalidatePlatformConfigCache } from '../src/settlement/config-cache.js';
import { prisma } from '../src/db.js';

function parseEnvNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function upsertService(data: {
  name: string;
  description: string;
  type: ServiceType;
  behaviour: ServiceBehaviour;
}) {
  return prisma.service.upsert({
    where: { name: data.name },
    update: {
      description: data.description,
      type: data.type,
      behaviour: data.behaviour,
      status: CatalogStatus.ACTIVE,
    },
    create: {
      ...data,
      status: CatalogStatus.ACTIVE,
    },
  });
}

async function upsertProduct(data: {
  code: string;
  name: string;
  displayName: string;
  description: string;
  serviceId: string;
  currency: string;
  denominationUnitType: DenominationUnitType;
  productUnitType: ProductUnitType;
}) {
  return prisma.product.upsert({
    where: { code: data.code },
    update: {
      name: data.name,
      displayName: data.displayName,
      description: data.description,
      serviceId: data.serviceId,
      currency: data.currency,
      denominationUnitType: data.denominationUnitType,
      productUnitType: data.productUnitType,
      status: CatalogStatus.ACTIVE,
    },
    create: {
      ...data,
      status: CatalogStatus.ACTIVE,
    },
  });
}

async function upsertUcp(data: {
  code: string;
  name: string;
  description: string;
  unit: UcpUnit;
  ucpType: UcpType;
  calculationType: UcpCalculationType;
  fixedValue: number;
}) {
  return prisma.ucp.upsert({
    where: { code: data.code },
    update: {
      name: data.name,
      description: data.description,
      unit: data.unit,
      ucpType: data.ucpType,
      calculationType: data.calculationType,
      fixedValue: data.fixedValue,
      status: CatalogStatus.ACTIVE,
    },
    create: {
      ...data,
      allowDebitOnSuccessfulTransaction: true,
      status: CatalogStatus.ACTIVE,
    },
  });
}

async function upsertSettlementRequest(data: {
  name: string;
  description: string;
  productId: string;
  ucpId: string;
  priority?: number;
}) {
  return prisma.settlementRequest.upsert({
    where: {
      productId_ucpId: {
        productId: data.productId,
        ucpId: data.ucpId,
      },
    },
    update: {
      name: data.name,
      description: data.description,
      priority: data.priority ?? 0,
      status: CatalogStatus.ACTIVE,
    },
    create: {
      ...data,
      priority: data.priority ?? 0,
      status: CatalogStatus.ACTIVE,
    },
  });
}

async function main(): Promise<void> {
  const exchangeRate = parseEnvNumber(process.env.FUND_EXCHANGE_RATE, 71);
  const feePercent = parseEnvNumber(process.env.FUND_FEE_PERCENT, 0.02);
  const cardFundFeePercent = parseEnvNumber(process.env.CARD_FUND_FEE_PERCENT, feePercent);
  const cardIssuanceFeeUsd = parseEnvNumber(process.env.CARD_ISSUANCE_FEE_USD, 1.5);
  const cardExpiryYears = parseEnvNumber(process.env.CARD_EXPIRY_YEARS, 1);

  const platformService = await upsertService({
    name: 'Platform Config',
    description: 'Global platform parameters',
    type: ServiceType.INTERNAL,
    behaviour: ServiceBehaviour.NON_TRANSACTIONAL,
  });

  const walletService = await upsertService({
    name: 'Wallet',
    description: 'vPay wallet top-up and balance',
    type: ServiceType.INTERNAL,
    behaviour: ServiceBehaviour.TRANSACTIONAL,
  });

  const cardService = await upsertService({
    name: 'Virtual Card',
    description: 'Stripe virtual card issuance and funding',
    type: ServiceType.INTERNAL,
    behaviour: ServiceBehaviour.TRANSACTIONAL,
  });

  const exchangeRateProduct = await upsertProduct({
    code: PRODUCT_CODES.EXCHANGE_RATE,
    name: 'exchange-rate',
    displayName: 'GMD / USD exchange rate',
    description: 'Conversion rate from GMD to USD',
    serviceId: platformService.id,
    currency: 'GMD',
    denominationUnitType: DenominationUnitType.FIXED,
    productUnitType: ProductUnitType.MONETARY,
  });

  const cardExpiryProduct = await upsertProduct({
    code: PRODUCT_CODES.CARD_EXPIRY,
    name: 'card-expiry',
    displayName: 'Card expiry',
    description: 'Virtual card validity period in years',
    serviceId: platformService.id,
    currency: 'USD',
    denominationUnitType: DenominationUnitType.FIXED,
    productUnitType: ProductUnitType.NON_MONETARY,
  });

  const walletTopupProduct = await upsertProduct({
    code: PRODUCT_CODES.WALLET_TOPUP,
    name: 'wallet-topup',
    displayName: 'Wallet top-up',
    description: 'DirectPay wallet funding',
    serviceId: walletService.id,
    currency: 'GMD',
    denominationUnitType: DenominationUnitType.FLEX,
    productUnitType: ProductUnitType.MONETARY,
  });

  const cardIssuanceProduct = await upsertProduct({
    code: PRODUCT_CODES.CARD_ISSUANCE,
    name: 'card-issuance',
    displayName: 'Card issuance',
    description: 'One-time virtual card issuance fee',
    serviceId: cardService.id,
    currency: 'USD',
    denominationUnitType: DenominationUnitType.FIXED,
    productUnitType: ProductUnitType.MONETARY,
  });

  const cardFundProduct = await upsertProduct({
    code: PRODUCT_CODES.CARD_FUND,
    name: 'card-fund',
    displayName: 'Card fund',
    description: 'Transfer from vPay wallet to virtual card',
    serviceId: cardService.id,
    currency: 'GMD',
    denominationUnitType: DenominationUnitType.FLEX,
    productUnitType: ProductUnitType.MONETARY,
  });

  const exchangeRateUcp = await upsertUcp({
    code: UCP_CODES.GMD_USD_EXCHANGE_RATE,
    name: 'GMD/USD exchange rate',
    description: `Seeded from FUND_EXCHANGE_RATE (${exchangeRate})`,
    unit: UcpUnit.OTHER,
    ucpType: UcpType.FIXED,
    calculationType: UcpCalculationType.EXCLUSIVE,
    fixedValue: exchangeRate,
  });

  const walletFeeUcp = await upsertUcp({
    code: UCP_CODES.WALLET_TOPUP_FEE_PERCENT,
    name: 'Wallet top-up fee',
    description: `Seeded from FUND_FEE_PERCENT (${feePercent}) — decimal fraction of amount`,
    unit: UcpUnit.FEES,
    ucpType: UcpType.FIXED,
    calculationType: UcpCalculationType.EXCLUSIVE,
    fixedValue: feePercent,
  });

  const cardIssuanceFeeUcp = await upsertUcp({
    code: UCP_CODES.CARD_ISSUANCE_FEE_USD,
    name: 'Card issuance fee',
    description: `Seeded from CARD_ISSUANCE_FEE_USD (${cardIssuanceFeeUsd})`,
    unit: UcpUnit.FEES,
    ucpType: UcpType.FIXED,
    calculationType: UcpCalculationType.EXCLUSIVE,
    fixedValue: cardIssuanceFeeUsd,
  });

  const cardFundFeeUcp = await upsertUcp({
    code: UCP_CODES.CARD_FUND_FEE_PERCENT,
    name: 'Card funding fee',
    description: `Seeded from CARD_FUND_FEE_PERCENT (${cardFundFeePercent}) — decimal fraction of amount`,
    unit: UcpUnit.FEES,
    ucpType: UcpType.FIXED,
    calculationType: UcpCalculationType.EXCLUSIVE,
    fixedValue: cardFundFeePercent,
  });

  const cardExpiryUcp = await upsertUcp({
    code: UCP_CODES.CARD_EXPIRY_YEARS,
    name: 'Card expiry years',
    description: `Seeded from CARD_EXPIRY_YEARS (${cardExpiryYears})`,
    unit: UcpUnit.OTHER,
    ucpType: UcpType.FIXED,
    calculationType: UcpCalculationType.EXCLUSIVE,
    fixedValue: cardExpiryYears,
  });

  const settlements = await Promise.all([
    upsertSettlementRequest({
      name: 'Wallet top-up platform fee',
      description: 'Platform fee on wallet funding',
      productId: walletTopupProduct.id,
      ucpId: walletFeeUcp.id,
      priority: 0,
    }),
    upsertSettlementRequest({
      name: 'Wallet top-up exchange rate',
      description: 'FX rate for wallet funding estimates',
      productId: walletTopupProduct.id,
      ucpId: exchangeRateUcp.id,
      priority: 1,
    }),
    upsertSettlementRequest({
      name: 'Card issuance fee',
      description: 'Fee debited before card provisioning',
      productId: cardIssuanceProduct.id,
      ucpId: cardIssuanceFeeUcp.id,
      priority: 0,
    }),
    upsertSettlementRequest({
      name: 'Card issuance exchange rate',
      description: 'FX rate for issuance fee GMD conversion',
      productId: cardIssuanceProduct.id,
      ucpId: exchangeRateUcp.id,
      priority: 1,
    }),
    upsertSettlementRequest({
      name: 'Card fund exchange rate',
      description: 'FX rate for card funding',
      productId: cardFundProduct.id,
      ucpId: exchangeRateUcp.id,
      priority: 0,
    }),
    upsertSettlementRequest({
      name: 'Card fund platform fee',
      description: 'Platform fee on wallet-to-card transfers',
      productId: cardFundProduct.id,
      ucpId: cardFundFeeUcp.id,
      priority: 1,
    }),
    upsertSettlementRequest({
      name: 'Global exchange rate',
      description: 'Default GMD/USD rate',
      productId: exchangeRateProduct.id,
      ucpId: exchangeRateUcp.id,
      priority: 0,
    }),
    upsertSettlementRequest({
      name: 'Card expiry configuration',
      description: 'Card validity in years',
      productId: cardExpiryProduct.id,
      ucpId: cardExpiryUcp.id,
      priority: 0,
    }),
  ]);

  const feeIncomeEntity = await prisma.businessEntity.upsert({
    where: { code: 'platform-fee-income' },
    update: {
      name: 'Platform Fee Income',
      type: BusinessEntityType.VENDOR_INCOME,
      description: 'Vendor entity for platform fee and income recognition',
      status: CatalogStatus.ACTIVE,
    },
    create: {
      code: 'platform-fee-income',
      name: 'Platform Fee Income',
      type: BusinessEntityType.VENDOR_INCOME,
      description: 'Vendor entity for platform fee and income recognition',
      status: CatalogStatus.ACTIVE,
    },
  });

  const walletTopupFeesAccount = await prisma.businessAccount.upsert({
    where: { entityId_code: { entityId: feeIncomeEntity.id, code: 'wallet-topup-fees' } },
    update: {
      name: 'Wallet top-up fees',
      currency: 'GMD',
      purpose: BusinessAccountPurpose.FEE_INCOME,
      status: CatalogStatus.ACTIVE,
    },
    create: {
      entityId: feeIncomeEntity.id,
      code: 'wallet-topup-fees',
      name: 'Wallet top-up fees',
      currency: 'GMD',
      purpose: BusinessAccountPurpose.FEE_INCOME,
      status: CatalogStatus.ACTIVE,
    },
  });

  const cardIssuanceFeesAccount = await prisma.businessAccount.upsert({
    where: { entityId_code: { entityId: feeIncomeEntity.id, code: 'card-issuance-fees' } },
    update: {
      name: 'Card issuance fees',
      currency: 'GMD',
      purpose: BusinessAccountPurpose.FEE_INCOME,
      status: CatalogStatus.ACTIVE,
    },
    create: {
      entityId: feeIncomeEntity.id,
      code: 'card-issuance-fees',
      name: 'Card issuance fees',
      currency: 'GMD',
      purpose: BusinessAccountPurpose.FEE_INCOME,
      status: CatalogStatus.ACTIVE,
    },
  });

  const cardFundFeesAccount = await prisma.businessAccount.upsert({
    where: { entityId_code: { entityId: feeIncomeEntity.id, code: 'card-fund-fees' } },
    update: {
      name: 'Card funding fees',
      currency: 'GMD',
      purpose: BusinessAccountPurpose.FEE_INCOME,
      status: CatalogStatus.ACTIVE,
    },
    create: {
      entityId: feeIncomeEntity.id,
      code: 'card-fund-fees',
      name: 'Card funding fees',
      currency: 'GMD',
      purpose: BusinessAccountPurpose.FEE_INCOME,
      status: CatalogStatus.ACTIVE,
    },
  });

  const customerFundsPoolAccount = await prisma.businessAccount.upsert({
    where: { entityId_code: { entityId: feeIncomeEntity.id, code: 'customer-funds-pool' } },
    update: {
      name: 'Customer funds pool',
      currency: 'GMD',
      purpose: BusinessAccountPurpose.FUND_HOLDING,
      status: CatalogStatus.ACTIVE,
    },
    create: {
      entityId: feeIncomeEntity.id,
      code: 'customer-funds-pool',
      name: 'Customer funds pool',
      currency: 'GMD',
      purpose: BusinessAccountPurpose.FUND_HOLDING,
      status: CatalogStatus.ACTIVE,
    },
  });

  await prisma.businessAccount.upsert({
    where: {
      entityId_code: {
        entityId: feeIncomeEntity.id,
        code: BUSINESS_ACCOUNT_CODES.PAYMENTS_RECEIVED,
      },
    },
    update: {
      name: 'Payments received clearing',
      currency: 'GMD',
      purpose: BusinessAccountPurpose.SETTLEMENT,
      status: CatalogStatus.ACTIVE,
    },
    create: {
      entityId: feeIncomeEntity.id,
      code: BUSINESS_ACCOUNT_CODES.PAYMENTS_RECEIVED,
      name: 'Payments received clearing',
      currency: 'GMD',
      purpose: BusinessAccountPurpose.SETTLEMENT,
      status: CatalogStatus.ACTIVE,
    },
  });

  await prisma.businessAccount.upsert({
    where: {
      entityId_code: {
        entityId: feeIncomeEntity.id,
        code: BUSINESS_ACCOUNT_CODES.CARD_FUNDING_CLEARING,
      },
    },
    update: {
      name: 'Card funding clearing',
      currency: 'GMD',
      purpose: BusinessAccountPurpose.SETTLEMENT,
      status: CatalogStatus.ACTIVE,
    },
    create: {
      entityId: feeIncomeEntity.id,
      code: BUSINESS_ACCOUNT_CODES.CARD_FUNDING_CLEARING,
      name: 'Card funding clearing',
      currency: 'GMD',
      purpose: BusinessAccountPurpose.SETTLEMENT,
      status: CatalogStatus.ACTIVE,
    },
  });

  await prisma.product.update({
    where: { id: walletTopupProduct.id },
    data: { fundHoldingAccountId: customerFundsPoolAccount.id },
  });
  await prisma.product.update({
    where: { id: cardFundProduct.id },
    data: { fundHoldingAccountId: customerFundsPoolAccount.id },
  });

  await prisma.settlementRequest.update({
    where: {
      productId_ucpId: { productId: walletTopupProduct.id, ucpId: walletFeeUcp.id },
    },
    data: { feeDestinationAccountId: walletTopupFeesAccount.id },
  });
  await prisma.settlementRequest.update({
    where: {
      productId_ucpId: { productId: cardIssuanceProduct.id, ucpId: cardIssuanceFeeUcp.id },
    },
    data: { feeDestinationAccountId: cardIssuanceFeesAccount.id },
  });
  await prisma.settlementRequest.update({
    where: {
      productId_ucpId: { productId: cardFundProduct.id, ucpId: cardFundFeeUcp.id },
    },
    data: { feeDestinationAccountId: cardFundFeesAccount.id },
  });

  invalidatePlatformConfigCache();

  console.log('Seeded system catalog:');
  console.log(`  Services: ${platformService.name}, ${walletService.name}, ${cardService.name}`);
  console.log(`  Products: 5 (exchange-rate, wallet-topup, card-issuance, card-fund, card-expiry)`);
  console.log(`  UCPs: 5`);
  console.log(`  Settlement requests: ${settlements.length}`);
  console.log(`  Business entity: ${feeIncomeEntity.name} with 6 accounts`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
