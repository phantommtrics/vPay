import { useAppLock } from '@/contexts/AppLockContext';
import { AppLockScreen } from '@/components/AppLockScreen';

export function AppLockGate({ children }: { children: React.ReactNode }) {
  const { isLocked } = useAppLock();

  return (
    <>
      {children}
      {isLocked ? <AppLockScreen /> : null}
    </>
  );
}
