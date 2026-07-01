import type { NextFunction, Response } from 'express';

import { hasPermission } from '../admin/permissions.js';
import type { AdminAuthedRequest } from './admin-auth.js';
import { isAdminApiKeyValid } from './admin-auth.js';

export function authorize(moduleKey: string, actionKey: string) {
  return (req: AdminAuthedRequest, res: Response, next: NextFunction): void => {
    if (isAdminApiKeyValid(req)) {
      next();
      return;
    }

    const permissions = req.adminPermissions;
    if (!permissions) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (hasPermission(permissions, moduleKey, actionKey)) {
      next();
      return;
    }

    res.status(403).json({ error: 'Forbidden' });
  };
}

export function authorizeAny(
  checks: ReadonlyArray<readonly [moduleKey: string, actionKey: string]>,
) {
  return (req: AdminAuthedRequest, res: Response, next: NextFunction): void => {
    if (isAdminApiKeyValid(req)) {
      next();
      return;
    }

    const permissions = req.adminPermissions;
    if (!permissions) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (checks.some(([moduleKey, actionKey]) => hasPermission(permissions, moduleKey, actionKey))) {
      next();
      return;
    }

    res.status(403).json({ error: 'Forbidden' });
  };
}
