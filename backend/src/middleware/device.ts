import type { Response, NextFunction } from 'express';

import { resolveUserDeviceId } from '../device/service.js';
import type { AuthedRequest } from '../routes/auth.js';

export type DeviceAuthedRequest = AuthedRequest & { deviceId?: string | null };

export async function attachUserDevice(
  req: DeviceAuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers['x-device-id'];
  const deviceHeader = typeof header === 'string' ? header : undefined;

  if (!deviceHeader || !req.userId) {
    req.deviceId = null;
    next();
    return;
  }

  req.deviceId = await resolveUserDeviceId(req.userId, deviceHeader);
  next();
}
