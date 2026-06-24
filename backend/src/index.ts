import 'dotenv/config';

import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { prisma } from './db.js';
import { log } from './logger.js';
import { handleApproveKyc, handleProvisionDirectPay, handleRejectKyc } from './routes/admin.js';
import {
  handleMe,
  handleSendOtp,
  handleUpdateProfile,
  handleVerifyOtp,
  requireAuth,
} from './routes/auth.js';
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
  handleFundApsAuthorize,
  handleFundApsComplete,
  handleFundWallet,
  handleGetFundConfig,
  handleGetFundingOrder,
  handlePrepareFund,
  handleSimulateFund,
} from './routes/fund.js';
import {
  handleSubmitKyc,
  handleUploadDocument,
  upload,
} from './routes/kyc.js';
import { handleIssuingElementsPage } from './routes/issuing-elements.js';
import { handleDirectPayWebhook } from './routes/directpay-webhook.js';
import { handleGetWallet, handleListWalletTransactions } from './routes/wallet.js';
import { handleStripeWebhook } from './routes/webhooks.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors());

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
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

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

app.post('/api/auth/send-otp', handleSendOtp);
app.post('/api/auth/verify-otp', handleVerifyOtp);
app.get('/api/auth/me', requireAuth, handleMe);
app.patch('/api/auth/profile', requireAuth, handleUpdateProfile);

app.post('/api/kyc/upload', requireAuth, upload.single('file'), handleUploadDocument);
app.post('/api/kyc/submit', requireAuth, handleSubmitKyc);

app.get('/api/fund/config', requireAuth, handleGetFundConfig);
app.post('/api/fund/prepare', requireAuth, handlePrepareFund);
app.post('/api/fund/:id/wallet', requireAuth, handleFundWallet);
app.post('/api/fund/:id/aps/authorize', requireAuth, handleFundApsAuthorize);
app.post('/api/fund/:id/aps/complete', requireAuth, handleFundApsComplete);
app.post('/api/fund/:id/simulate', requireAuth, handleSimulateFund);
app.get('/api/fund/:id', requireAuth, handleGetFundingOrder);

app.get('/api/wallet', requireAuth, handleGetWallet);
app.get('/api/wallet/transactions', requireAuth, handleListWalletTransactions);

app.get('/api/card-fund/balance', requireAuth, handleGetCardFundBalance);
app.post('/api/card-fund', requireAuth, handleFundCard);
app.get('/api/card-fund/transactions', requireAuth, handleListCardFundTransactions);

app.get('/api/cards', requireAuth, handleListCards);
app.get('/api/cards/:id', requireAuth, handleGetCard);
app.post('/api/cards/:id/ephemeral-key', requireAuth, handleCreateEphemeralKey);
app.patch('/api/cards/:id', requireAuth, handleUpdateCardStatus);

app.get('/issuing-elements', handleIssuingElementsPage);

app.post('/api/admin/kyc/:userId/approve', handleApproveKyc);
app.post('/api/admin/kyc/:userId/reject', handleRejectKyc);
app.post('/api/admin/kyc/:userId/provision-directpay', handleProvisionDirectPay);

const server = app.listen(port, '0.0.0.0', () => {
  log('Server started', { url: `http://localhost:${port}`, env: process.env.NODE_ENV ?? 'development' });
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});
