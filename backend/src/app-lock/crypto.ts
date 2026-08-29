import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

function pepper(): string {
  return process.env.APP_LOCK_PEPPER || process.env.JWT_SECRET || 'vpay-app-lock';
}

export async function hashAppLockSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scryptAsync(`${pepper()}:${secret}`, salt, 32)) as Buffer;
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}

export async function verifyAppLockSecret(secret: string, stored: string): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(':');
  if (!saltHex || !keyHex) return false;

  try {
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(keyHex, 'hex');
    const key = (await scryptAsync(`${pepper()}:${secret}`, salt, 32)) as Buffer;
    if (key.length !== expected.length) return false;
    return timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}
