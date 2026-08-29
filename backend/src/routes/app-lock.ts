import type { Response } from 'express';
import { z } from 'zod';

import type { AuthedRequest } from './auth.js';
import { formatZodError } from '../zod-utils.js';
import {
  AppLockError,
  clearUserAppLock,
  setUserAppLock,
  verifyUserAppLock,
} from '../app-lock/service.js';

const PIN_RE = /^\d{4}$/;
const PASSWORD_MIN_LENGTH = 8;

const setSchema = z
  .object({
    type: z.enum(['pin', 'password']),
    secret: z.string().min(1).max(128),
    currentSecret: z.string().min(1).max(128).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'pin' && !PIN_RE.test(value.secret)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'PIN must be exactly 4 digits' });
    }
    if (value.type === 'password' && value.secret.length < PASSWORD_MIN_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      });
    }
  });

const verifySchema = z.object({
  secret: z.string().min(1).max(128),
});

function sendAppLockError(res: Response, error: unknown): boolean {
  if (error instanceof AppLockError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return true;
  }
  return false;
}

export async function handleSetAppLock(req: AuthedRequest, res: Response): Promise<void> {
  const parsed = setSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  try {
    const type = await setUserAppLock(
      req.userId!,
      parsed.data.type,
      parsed.data.secret,
      parsed.data.currentSecret,
    );
    res.json({ ok: true, type });
  } catch (error) {
    if (sendAppLockError(res, error)) return;
    throw error;
  }
}

export async function handleClearAppLock(req: AuthedRequest, res: Response): Promise<void> {
  await clearUserAppLock(req.userId!);
  res.json({ ok: true });
}

export async function handleVerifyAppLock(req: AuthedRequest, res: Response): Promise<void> {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  try {
    await verifyUserAppLock(req.userId!, parsed.data.secret);
    res.json({ ok: true });
  } catch (error) {
    if (sendAppLockError(res, error)) return;
    throw error;
  }
}
