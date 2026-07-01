import type { Response } from 'express';
import { z } from 'zod';

import {
  getKycReviewSummary,
  listKycReviewAudits,
  utcDateString,
} from '../kyc/audit.js';
import type { AdminAuthedRequest } from '../middleware/admin-auth.js';
import { authorize } from '../middleware/admin-authorize.js';

const dateQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  search: z.string().optional(),
});

const detailQuerySchema = dateQuerySchema.extend({
  action: z.enum(['approved', 'rejected']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function handleKycWorkflowSummary(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const parsed = dateQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid query' });
    return;
  }

  try {
    const summary = await getKycReviewSummary({
      date: parsed.data.date ?? utcDateString(),
      search: parsed.data.search,
    });
    res.json(summary);
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Failed to load workflow summary',
    });
  }
}

export async function handleKycWorkflowDetail(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const parsed = detailQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid query' });
    return;
  }

  try {
    const detail = await listKycReviewAudits({
      date: parsed.data.date ?? utcDateString(),
      search: parsed.data.search,
      action: parsed.data.action,
      cursor: parsed.data.cursor,
      limit: parsed.data.limit,
    });
    res.json(detail);
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Failed to load workflow detail',
    });
  }
}

export const adminWorkflowAuthorize = {
  view: authorize('workflow', 'view'),
};
