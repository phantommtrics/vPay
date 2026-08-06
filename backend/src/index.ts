import 'dotenv/config';

import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { prisma } from './db.js';
import { log } from './logger.js';
import { LEGACY_UPLOADS_DIR, UPLOADS_DIR } from './paths.js';
import { requireAdminAccess, requireAdminJwt, requireAdminPreAuth } from './middleware/admin-auth.js';
import { perm } from './middleware/admin-route-perms.js';
import {
  handleAdminConfirmTotp,
  handleAdminMe,
  handleAdminSendOtp,
  handleAdminSetupTotp,
  handleAdminVerifyOtp,
  handleAdminVerifyTotp,
} from './routes/admin-auth.js';
import {
  adminGroupsAuthorize,
  handleCreateAdminGroup,
  handleDeleteAdminGroup,
  handleGetAdminGroup,
  handleListAdminGroups,
  handleUpdateAdminGroup,
} from './routes/admin-groups.js';
import {
  adminProductsAuthorize,
  handleCreateAdminProduct,
  handleDeleteAdminProduct,
  handleGetAdminProduct,
  handleListAdminProducts,
  handleUpdateAdminProduct,
} from './routes/admin-products.js';
import {
  adminServicesAuthorize,
  handleCreateAdminService,
  handleDeleteAdminService,
  handleGetAdminService,
  handleListAdminServices,
  handleUpdateAdminService,
} from './routes/admin-services.js';
import {
  adminUcpsAuthorize,
  handleCreateAdminUcp,
  handleDeleteAdminUcp,
  handleGetAdminUcp,
  handleListAdminUcps,
  handleUpdateAdminUcp,
} from './routes/admin-ucps.js';
import {
  adminSettlementRequestsAuthorize,
  handleCreateAdminSettlementRequest,
  handleDeleteAdminSettlementRequest,
  handleGetAdminSettlementRequest,
  handleListAdminSettlementRequests,
  handleUpdateAdminSettlementRequest,
} from './routes/admin-settlement-requests.js';
import {
  adminBusinessEntitiesAuthorize,
  handleCreateAdminBusinessEntity,
  handleDeleteAdminBusinessEntity,
  handleGetAdminBusinessEntity,
  handleListAdminBusinessEntities,
  handleUpdateAdminBusinessEntity,
} from './routes/admin-business-entities.js';
import {
  adminBusinessAccountsAuthorize,
  handleCreateAdminBusinessAccount,
  handleDeleteAdminBusinessAccount,
  handleGetAdminBusinessAccount,
  handleListAdminBusinessAccountTransactions,
  handleListAdminBusinessAccounts,
  handleUpdateAdminBusinessAccount,
} from './routes/admin-business-accounts.js';
import {
  adminExchangeRatesAuthorize,
  handleAdminListExchangeRatePulls,
  handleAdminListExchangeRateSnapshots,
} from './routes/admin-exchange-rates.js';
import { warmPlatformConfigCache } from './fund-config.js';
import {
  startExchangeRateSyncScheduler,
  stopExchangeRateSyncScheduler,
} from './exchange-rate/scheduler.js';
import {
  adminOperatorsAuthorize,
  handleAssignAdminOperator,
  handleDisableAdminOperator,
  handleEnableAdminOperator,
  handleGetAdminOperator,
  handleListAdminOperators,
  handleRevokeAdminOperator,
  handleSearchOperatorCandidates,
  handleUpdateAdminOperator,
} from './routes/admin-operators.js';
import {
  adminRolesAuthorize,
  handleAdminPermissionsCatalog,
  handleCreateAdminRole,
  handleDeleteAdminRole,
  handleGetAdminRole,
  handleListAdminRoles,
  handleSetAdminRolePermissions,
  handleUpdateAdminRole,
} from './routes/admin-roles.js';
import {
  handleGetAdminUser,
  handleAdminUserDevices,
  handleAdminUnlockUserDevice,
  handleListAdminUsers,
  handleLookupAdminUser,
  handleAdminStats,
} from './routes/admin-users.js';
import {
  handleAdminPlatformActivity,
  handleAdminUserCardFundTransactions,
  handleAdminUserFundingOrders,
  handleAdminUserWallet,
  handleAdminUserWalletTransactions,
} from './routes/admin-wallet.js';
import { handleAdminUpdateCardStatus } from './routes/admin-cards.js';
import {
  handleAdminPushConfig,
  handleAdminPushSubscribe,
  handleAdminPushUnsubscribe,
} from './routes/admin-push.js';
import {
  handleAdminReportEmailNotifications,
  handleAdminReportFundingOrders,
  handleAdminReportWalletTransactions,
} from './routes/admin-reports.js';
import {
  handleAdminReportJournalEntries,
  handleAdminReportJournalEntryDetail,
  handleAdminReportTrialBalance,
} from './routes/admin-journal.js';
import { handleApproveKyc, handleProvisionCard, handleProvisionDirectPay, handleRejectKyc } from './routes/admin.js';
import {
  handleKycWorkflowDetail,
  handleKycWorkflowSummary,
} from './routes/admin-workflow.js';
import {
  handleDeleteAccount,
  handleMe,
  handleRegisterDevice,
  handleSendOtp,
  handleUpdateDeviceLock,
  handleUpdateProfile,
  handleVerifyOtp,
  requireAuth,
} from './routes/auth.js';
import { attachUserDevice } from './middleware/device.js';
import {
  handleCreateEphemeralKey,
  handleGetCard,
  handleListCards,
  handleUpdateCardStatus,
} from './routes/cards.js';
import {
  handleFundCard,
  handleGetCardFundBalance,
  handleListCardFundTransactions,
} from './routes/card-fund.js';
import {
  handleGetCardIssuanceConfig,
  handlePayCardIssuance,
} from './routes/card-issuance.js';
import { handleGetAppConfig } from './routes/app-config.js';
import {
  handleFundApsAuthorize,
  handleFundApsComplete,
  handleFundWallet,
  handleGetFundConfig,
  handleGetFundingOrder,
  handlePrepareFund,
  handleSimulateFund,
} from './routes/fund.js';
import {
  handleKycUpload,
  handleSubmitKyc,
  handleUploadDocument,
} from './routes/kyc.js';
import { handleIssuingElementsPage } from './routes/issuing-elements.js';
import {
  handleGetCustomerDeviceGroup,
  handleListCustomerDeviceGroups,
} from './routes/admin-customer-devices.js';
import { handleDirectPayWebhook } from './routes/directpay-webhook.js';
import { handleGetWallet, handleListWalletTransactions } from './routes/wallet.js';
import { handleStripeWebhook } from './routes/webhooks.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT ?? 3001);

const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:8081')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  }),
);

app.post(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook,
);

app.post(
  '/api/webhooks/directpay',
  express.raw({ type: 'application/json' }),
  handleDirectPayWebhook,
);

app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/uploads', express.static(LEGACY_UPLOADS_DIR));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    log('HTTP request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs,
    });
  });
  next();
});

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: 'connected' });
  } catch {
    res.status(503).json({ ok: false, db: 'disconnected' });
  }
});

app.get('/api/app/config', handleGetAppConfig);

app.post('/api/auth/send-otp', handleSendOtp);
app.post('/api/auth/verify-otp', handleVerifyOtp);
app.get('/api/auth/me', requireAuth, handleMe);
app.post('/api/auth/register-device', requireAuth, handleRegisterDevice);
app.patch('/api/auth/device-lock', requireAuth, handleUpdateDeviceLock);
app.patch('/api/auth/profile', requireAuth, handleUpdateProfile);
app.delete('/api/auth/account', requireAuth, handleDeleteAccount);

app.post('/api/kyc/upload', requireAuth, handleKycUpload, handleUploadDocument);
app.post('/api/kyc/submit', requireAuth, attachUserDevice, handleSubmitKyc);

app.get('/api/fund/config', requireAuth, handleGetFundConfig);
app.post('/api/fund/prepare', requireAuth, attachUserDevice, handlePrepareFund);
app.post('/api/fund/:id/wallet', requireAuth, attachUserDevice, handleFundWallet);
app.post('/api/fund/:id/aps/authorize', requireAuth, attachUserDevice, handleFundApsAuthorize);
app.post('/api/fund/:id/aps/complete', requireAuth, attachUserDevice, handleFundApsComplete);
app.post('/api/fund/:id/simulate', requireAuth, attachUserDevice, handleSimulateFund);
app.get('/api/fund/:id', requireAuth, handleGetFundingOrder);

app.get('/api/wallet', requireAuth, handleGetWallet);
app.get('/api/wallet/transactions', requireAuth, handleListWalletTransactions);

app.get('/api/card-fund/balance', requireAuth, handleGetCardFundBalance);
app.post('/api/card-fund', requireAuth, attachUserDevice, handleFundCard);
app.get('/api/card-fund/transactions', requireAuth, handleListCardFundTransactions);

app.get('/api/card-issuance/config', requireAuth, handleGetCardIssuanceConfig);
app.post('/api/card-issuance/pay', requireAuth, attachUserDevice, handlePayCardIssuance);

app.get('/api/cards', requireAuth, handleListCards);
app.get('/api/cards/:id', requireAuth, handleGetCard);
app.post('/api/cards/:id/ephemeral-key', requireAuth, handleCreateEphemeralKey);
app.patch('/api/cards/:id', requireAuth, handleUpdateCardStatus);

app.get('/api/issuing-elements', handleIssuingElementsPage);
app.get('/issuing-elements', handleIssuingElementsPage);

app.post('/api/admin/auth/send-otp', handleAdminSendOtp);
app.post('/api/admin/auth/verify-otp', handleAdminVerifyOtp);
app.post('/api/admin/auth/setup-totp', requireAdminPreAuth, handleAdminSetupTotp);
app.post('/api/admin/auth/confirm-totp', requireAdminPreAuth, handleAdminConfirmTotp);
app.post('/api/admin/auth/verify-totp', requireAdminPreAuth, handleAdminVerifyTotp);
app.get('/api/admin/auth/me', requireAdminJwt, handleAdminMe);

app.get('/api/admin/push/config', requireAdminJwt, handleAdminPushConfig);
app.post('/api/admin/push/subscribe', requireAdminJwt, handleAdminPushSubscribe);
app.post('/api/admin/push/unsubscribe', requireAdminJwt, handleAdminPushUnsubscribe);

app.get('/api/admin/roles/permissions', requireAdminAccess, adminRolesAuthorize.catalog, handleAdminPermissionsCatalog);
app.get('/api/admin/roles', requireAdminAccess, adminRolesAuthorize.list, handleListAdminRoles);
app.get('/api/admin/roles/:id', requireAdminAccess, adminRolesAuthorize.get, handleGetAdminRole);
app.post('/api/admin/roles', requireAdminAccess, adminRolesAuthorize.create, handleCreateAdminRole);
app.patch('/api/admin/roles/:id', requireAdminAccess, adminRolesAuthorize.update, handleUpdateAdminRole);
app.put('/api/admin/roles/:id/permissions', requireAdminAccess, adminRolesAuthorize.setPermissions, handleSetAdminRolePermissions);
app.delete('/api/admin/roles/:id', requireAdminAccess, adminRolesAuthorize.delete, handleDeleteAdminRole);

app.get('/api/admin/groups', requireAdminAccess, adminGroupsAuthorize.list, handleListAdminGroups);
app.get('/api/admin/groups/:id', requireAdminAccess, adminGroupsAuthorize.get, handleGetAdminGroup);
app.post('/api/admin/groups', requireAdminAccess, adminGroupsAuthorize.create, handleCreateAdminGroup);
app.patch('/api/admin/groups/:id', requireAdminAccess, adminGroupsAuthorize.update, handleUpdateAdminGroup);
app.delete('/api/admin/groups/:id', requireAdminAccess, adminGroupsAuthorize.delete, handleDeleteAdminGroup);

app.get('/api/admin/services', requireAdminAccess, adminServicesAuthorize.list, handleListAdminServices);
app.get('/api/admin/services/:id', requireAdminAccess, adminServicesAuthorize.get, handleGetAdminService);
app.post('/api/admin/services', requireAdminAccess, adminServicesAuthorize.create, handleCreateAdminService);
app.patch('/api/admin/services/:id', requireAdminAccess, adminServicesAuthorize.update, handleUpdateAdminService);
app.delete('/api/admin/services/:id', requireAdminAccess, adminServicesAuthorize.delete, handleDeleteAdminService);

app.get('/api/admin/products', requireAdminAccess, adminProductsAuthorize.list, handleListAdminProducts);
app.get('/api/admin/products/:id', requireAdminAccess, adminProductsAuthorize.get, handleGetAdminProduct);
app.post('/api/admin/products', requireAdminAccess, adminProductsAuthorize.create, handleCreateAdminProduct);
app.patch('/api/admin/products/:id', requireAdminAccess, adminProductsAuthorize.update, handleUpdateAdminProduct);
app.delete('/api/admin/products/:id', requireAdminAccess, adminProductsAuthorize.delete, handleDeleteAdminProduct);

app.get('/api/admin/ucps', requireAdminAccess, adminUcpsAuthorize.list, handleListAdminUcps);
app.get('/api/admin/ucps/:id', requireAdminAccess, adminUcpsAuthorize.get, handleGetAdminUcp);
app.post('/api/admin/ucps', requireAdminAccess, adminUcpsAuthorize.create, handleCreateAdminUcp);
app.patch('/api/admin/ucps/:id', requireAdminAccess, adminUcpsAuthorize.update, handleUpdateAdminUcp);
app.delete('/api/admin/ucps/:id', requireAdminAccess, adminUcpsAuthorize.delete, handleDeleteAdminUcp);

app.get(
  '/api/admin/settlement-requests',
  requireAdminAccess,
  adminSettlementRequestsAuthorize.list,
  handleListAdminSettlementRequests,
);
app.get(
  '/api/admin/settlement-requests/:id',
  requireAdminAccess,
  adminSettlementRequestsAuthorize.get,
  handleGetAdminSettlementRequest,
);
app.post(
  '/api/admin/settlement-requests',
  requireAdminAccess,
  adminSettlementRequestsAuthorize.create,
  handleCreateAdminSettlementRequest,
);
app.patch(
  '/api/admin/settlement-requests/:id',
  requireAdminAccess,
  adminSettlementRequestsAuthorize.update,
  handleUpdateAdminSettlementRequest,
);
app.delete(
  '/api/admin/settlement-requests/:id',
  requireAdminAccess,
  adminSettlementRequestsAuthorize.delete,
  handleDeleteAdminSettlementRequest,
);

app.get(
  '/api/admin/business-entities',
  requireAdminAccess,
  adminBusinessEntitiesAuthorize.list,
  handleListAdminBusinessEntities,
);
app.get(
  '/api/admin/business-entities/:id',
  requireAdminAccess,
  adminBusinessEntitiesAuthorize.get,
  handleGetAdminBusinessEntity,
);
app.post(
  '/api/admin/business-entities',
  requireAdminAccess,
  adminBusinessEntitiesAuthorize.create,
  handleCreateAdminBusinessEntity,
);
app.patch(
  '/api/admin/business-entities/:id',
  requireAdminAccess,
  adminBusinessEntitiesAuthorize.update,
  handleUpdateAdminBusinessEntity,
);
app.delete(
  '/api/admin/business-entities/:id',
  requireAdminAccess,
  adminBusinessEntitiesAuthorize.delete,
  handleDeleteAdminBusinessEntity,
);

app.get(
  '/api/admin/business-accounts',
  requireAdminAccess,
  adminBusinessAccountsAuthorize.list,
  handleListAdminBusinessAccounts,
);
app.get(
  '/api/admin/business-accounts/:id',
  requireAdminAccess,
  adminBusinessAccountsAuthorize.get,
  handleGetAdminBusinessAccount,
);
app.post(
  '/api/admin/business-accounts',
  requireAdminAccess,
  adminBusinessAccountsAuthorize.create,
  handleCreateAdminBusinessAccount,
);
app.patch(
  '/api/admin/business-accounts/:id',
  requireAdminAccess,
  adminBusinessAccountsAuthorize.update,
  handleUpdateAdminBusinessAccount,
);
app.delete(
  '/api/admin/business-accounts/:id',
  requireAdminAccess,
  adminBusinessAccountsAuthorize.delete,
  handleDeleteAdminBusinessAccount,
);
app.get(
  '/api/admin/business-accounts/:id/transactions',
  requireAdminAccess,
  adminBusinessAccountsAuthorize.transactions,
  handleListAdminBusinessAccountTransactions,
);

app.get(
  '/api/admin/exchange-rates/snapshots',
  requireAdminAccess,
  adminExchangeRatesAuthorize.list,
  handleAdminListExchangeRateSnapshots,
);

app.get(
  '/api/admin/exchange-rates/pulls',
  requireAdminAccess,
  adminExchangeRatesAuthorize.list,
  handleAdminListExchangeRatePulls,
);

app.get('/api/admin/operators', requireAdminAccess, adminOperatorsAuthorize.list, handleListAdminOperators);
app.get('/api/admin/operators/search', requireAdminAccess, adminOperatorsAuthorize.search, handleSearchOperatorCandidates);
app.get('/api/admin/operators/:id', requireAdminAccess, adminOperatorsAuthorize.get, handleGetAdminOperator);
app.post('/api/admin/operators', requireAdminAccess, adminOperatorsAuthorize.assign, handleAssignAdminOperator);
app.patch('/api/admin/operators/:id', requireAdminAccess, adminOperatorsAuthorize.update, handleUpdateAdminOperator);
app.post('/api/admin/operators/:id/disable', requireAdminAccess, adminOperatorsAuthorize.disable, handleDisableAdminOperator);
app.post('/api/admin/operators/:id/enable', requireAdminAccess, adminOperatorsAuthorize.enable, handleEnableAdminOperator);
app.delete('/api/admin/operators/:id', requireAdminAccess, adminOperatorsAuthorize.revoke, handleRevokeAdminOperator);

app.get('/api/admin/stats', requireAdminAccess, perm.dashboardView, handleAdminStats);
app.get('/api/admin/users', requireAdminAccess, perm.customersView, handleListAdminUsers);
app.get('/api/admin/users/lookup', requireAdminAccess, perm.customersView, handleLookupAdminUser);
app.get('/api/admin/users/:userId', requireAdminAccess, perm.customersView, handleGetAdminUser);
app.get('/api/admin/users/:userId/devices', requireAdminAccess, perm.customersView, handleAdminUserDevices);
app.post(
  '/api/admin/users/:userId/unlock-device',
  requireAdminAccess,
  perm.customersEdit,
  handleAdminUnlockUserDevice,
);

app.get('/api/admin/customer-devices', requireAdminAccess, perm.deviceInfoView, handleListCustomerDeviceGroups);
app.get(
  '/api/admin/customer-devices/:groupType/:groupKey',
  requireAdminAccess,
  perm.deviceInfoView,
  handleGetCustomerDeviceGroup,
);

app.patch('/api/admin/users/:userId/cards/:cardId', requireAdminAccess, perm.customersEdit, handleAdminUpdateCardStatus);

app.get('/api/admin/users/:userId/wallet', requireAdminAccess, perm.customersView, handleAdminUserWallet);
app.get('/api/admin/users/:userId/wallet/transactions', requireAdminAccess, perm.customersView, handleAdminUserWalletTransactions);
app.get('/api/admin/users/:userId/funding-orders', requireAdminAccess, perm.customersView, handleAdminUserFundingOrders);
app.get('/api/admin/users/:userId/card-fund/transactions', requireAdminAccess, perm.customersView, handleAdminUserCardFundTransactions);
app.get('/api/admin/activity', requireAdminAccess, perm.dashboardView, handleAdminPlatformActivity);
app.get('/api/admin/reports/wallet-transactions', requireAdminAccess, perm.reportsView, handleAdminReportWalletTransactions);
app.get('/api/admin/reports/funding-orders', requireAdminAccess, perm.reportsView, handleAdminReportFundingOrders);
app.get('/api/admin/reports/email-notifications', requireAdminAccess, perm.reportsView, handleAdminReportEmailNotifications);
app.get('/api/admin/reports/journal-entries', requireAdminAccess, perm.reportsView, handleAdminReportJournalEntries);
app.get('/api/admin/reports/journal-entries/:id', requireAdminAccess, perm.reportsView, handleAdminReportJournalEntryDetail);
app.get('/api/admin/reports/trial-balance', requireAdminAccess, perm.reportsView, handleAdminReportTrialBalance);

app.get('/api/admin/workflow/kyc/summary', requireAdminAccess, perm.workflowView, handleKycWorkflowSummary);
app.get('/api/admin/workflow/kyc/detail', requireAdminAccess, perm.workflowView, handleKycWorkflowDetail);

app.post('/api/admin/kyc/:userId/approve', requireAdminAccess, perm.kycEdit, handleApproveKyc);
app.post('/api/admin/kyc/:userId/reject', requireAdminAccess, perm.kycEdit, handleRejectKyc);
app.post('/api/admin/kyc/:userId/provision-directpay', requireAdminAccess, perm.kycEdit, handleProvisionDirectPay);
app.post('/api/admin/kyc/:userId/provision-card', requireAdminAccess, perm.kycEdit, handleProvisionCard);

const server = app.listen(port, '0.0.0.0', () => {
  log('Server started', { url: `http://localhost:${port}`, env: process.env.NODE_ENV ?? 'development' });
  void warmPlatformConfigCache().catch((err) => {
    log('Platform config cache warm failed', { error: err instanceof Error ? err.message : String(err) });
  });
  startExchangeRateSyncScheduler();
});

process.on('SIGINT', async () => {
  stopExchangeRateSyncScheduler();
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});

process.on('SIGTERM', async () => {
  stopExchangeRateSyncScheduler();
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});
