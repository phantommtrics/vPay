import type { Response } from 'express';
import { z } from 'zod';

import {
  getCustomerDeviceGroupDetail,
  listCustomerDeviceGroups,
} from '../device/admin-queries.js';
import type { AdminAuthedRequest } from '../middleware/admin-auth.js';

const listQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const groupTypeSchema = z.enum(['hardware', 'device']);

export async function handleListCustomerDeviceGroups(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid query' });
    return;
  }

  const result = await listCustomerDeviceGroups(parsed.data);
  res.json(result);
}

export async function handleGetCustomerDeviceGroup(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const groupTypeParsed = groupTypeSchema.safeParse(req.params.groupType);
  if (!groupTypeParsed.success) {
    res.status(400).json({ error: 'Invalid device group type' });
    return;
  }

  const groupKey = String(req.params.groupKey ?? '').trim();
  if (!groupKey) {
    res.status(400).json({ error: 'Device group key is required' });
    return;
  }

  const detail = await getCustomerDeviceGroupDetail(groupTypeParsed.data, groupKey);
  if (!detail) {
    res.status(404).json({ error: 'Device group not found' });
    return;
  }

  res.json({ group: detail });
}
