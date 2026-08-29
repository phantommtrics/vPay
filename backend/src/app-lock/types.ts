export type AppLockType = 'pin' | 'password';

export function toPublicAppLockType(type: string | null | undefined): AppLockType | null {
  if (type === 'PIN') return 'pin';
  if (type === 'PASSWORD') return 'password';
  return null;
}

export function toDbAppLockType(type: AppLockType): 'PIN' | 'PASSWORD' {
  return type === 'pin' ? 'PIN' : 'PASSWORD';
}
