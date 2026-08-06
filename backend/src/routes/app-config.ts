import type { Request, Response } from 'express';

import { getAppUpdateConfig } from '../app-update/config.js';

/** Public — no auth. Mobile clients check this before login. */
export function handleGetAppConfig(_req: Request, res: Response): void {
  res.json(getAppUpdateConfig());
}
