import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
const TOKEN_TTL = '30d';
const ADMIN_TOKEN_TTL = '8h';
const PRE_AUTH_TTL = '5m';

export type TokenPayload = {
  sub: string;
  email: string;
};

export type AdminTokenPayload = TokenPayload & {
  admin: true;
  totp: true;
};

export type PreAuthTokenPayload = TokenPayload & {
  preAuth: true;
};

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function signAdminToken(payload: TokenPayload): string {
  const adminPayload: AdminTokenPayload = {
    ...payload,
    admin: true,
    totp: true,
  };
  return jwt.sign(adminPayload, JWT_SECRET, { expiresIn: ADMIN_TOKEN_TTL });
}

export function signPreAuthToken(payload: TokenPayload): string {
  const preAuthPayload: PreAuthTokenPayload = {
    ...payload,
    preAuth: true,
  };
  return jwt.sign(preAuthPayload, JWT_SECRET, { expiresIn: PRE_AUTH_TTL });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  const payload = jwt.verify(token, JWT_SECRET) as AdminTokenPayload;
  if (!payload.admin || !payload.totp) {
    throw new Error('Invalid admin token');
  }
  return payload;
}

export function verifyPreAuthToken(token: string): PreAuthTokenPayload {
  const payload = jwt.verify(token, JWT_SECRET) as PreAuthTokenPayload;
  if (!payload.preAuth) {
    throw new Error('Invalid pre-auth token');
  }
  return payload;
}
