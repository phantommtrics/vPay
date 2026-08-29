import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import type { AppLockCredentialType } from '@/lib/app-lock-credential';
import { hasCredentialReauth, isCredentialFlowComplete, reauthNextForSetScreen } from '@/lib/credential-setup';

export function useCredentialSetGuard(screen: AppLockCredentialType, mode?: string): boolean {
  const { user } = useAuth();
  const currentType = user?.appLockType ?? null;
  const [allowed, setAllowed] = useState(() => !currentType || hasCredentialReauth());

  useFocusEffect(
    useCallback(() => {
      if (!currentType || isCredentialFlowComplete()) {
        setAllowed(true);
        return;
      }
      if (hasCredentialReauth()) {
        setAllowed(true);
        return;
      }
      setAllowed(false);
      router.replace({
        pathname: '/verify-credential',
        params: { next: reauthNextForSetScreen(screen, mode, currentType) },
      });
    }, [currentType, mode, screen]),
  );

  return allowed;
}
