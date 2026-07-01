import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = path.dirname(fileURLToPath(import.meta.url));

/** Canonical upload directory: backend/uploads */
export const UPLOADS_DIR = path.join(srcDir, '..', 'uploads');

/** Legacy path used before uploads dir was unified (backend/src/uploads) */
export const LEGACY_UPLOADS_DIR = path.join(srcDir, 'uploads');
