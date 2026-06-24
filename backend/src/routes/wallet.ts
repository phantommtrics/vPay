import type { Response } from 'express';

import { findUserById } from '../db.js';
import {
  ensureWalletForUser,
  getWalletBalance,
  listWalletTransactions,
  WalletNotFoundError,
  WalletPhoneConflictError,
} from '../wallet/service.js';
import { PhoneAlreadyInUseError } from '../phone.js';
import type { AuthedRequest } from './auth.js';

export async function handleGetWallet(req: AuthedRequest, res: Response): Promise<void> {
  try {
    const user = await findUserById(req.userId!);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (user.phone?.trim()) {
      try {
        await ensureWalletForUser(user);
      } catch (e) {
        if (e instanceof PhoneAlreadyInUseError || e instanceof WalletPhoneConflictError) {
          res.status(409).json({ error: e.message });
          return;
        }
      }
    }
    const balance = await getWalletBalance(req.userId!);
    res.json({ wallet: balance });
  } catch (e: unknown) {
    if (e instanceof WalletNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    const msg = e instanceof Error ? e.message : 'Failed to load wallet';
    res.status(500).json({ error: msg });
  }
}

export async function handleListWalletTransactions(
  req: AuthedRequest,
  res: Response,
): Promise<void> {
  try {
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const limit =
      typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : undefined;

    const result = await listWalletTransactions(req.userId!, { cursor, limit });
    res.json(result);
  } catch (e: unknown) {
    if (e instanceof WalletNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    const msg = e instanceof Error ? e.message : 'Failed to load wallet transactions';
    res.status(500).json({ error: msg });
  }
}
