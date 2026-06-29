import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import {
  consumeSkipNextAppLock,
  getAppLockEnabled,
  setAppLockEnabled as persistAppLockEnabled,
} from '@/lib/app-lock-storage';
import {
  authenticateWithBiometrics,
  resolveBiometricMethod,
  waitForAppActive,
  type BiometricMethod,
} from '@/lib/biometrics';

/** Lock only after the app has been in the background this long (ms). */
const BACKGROUND_LOCK_DELAY_MS = 60_000;

type AppLockContextValue = {
  isLocked: boolean;
  isChecking: boolean;
  biometricsAvailable: boolean;
  biometricMethod: BiometricMethod;
  appLockEnabled: boolean;
  setAppLockEnabled: (enabled: boolean) => Promise<void>;
  unlock: () => Promise<boolean>;
  lock: () => void;
  runWithLockDeferred: <T>(fn: () => Promise<T>) => Promise<T>;
};

const AppLockContext = createContext<AppLockContextValue | null>(null);

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [biometricMethod, setBiometricMethod] = useState<BiometricMethod>('none');
  const [appLockEnabled, setAppLockEnabledState] = useState(true);
  const [biometricsReady, setBiometricsReady] = useState(false);
  const isAuthenticating = useRef(false);
  const autoPromptCancelled = useRef(false);
  const isUnlockedRef = useRef(isUnlocked);
  const backgroundSince = useRef<number | null>(null);
  const deferLockCount = useRef(0);
  const sessionLockInitialized = useRef(false);

  useEffect(() => {
    isUnlockedRef.current = isUnlocked;
  }, [isUnlocked]);

  const biometricsAvailable = biometricMethod !== 'none';
  const lockRequired = Boolean(user) && !authLoading && appLockEnabled;

  const lock = useCallback(() => {
    setIsUnlocked(false);
    autoPromptCancelled.current = false;
  }, []);

  const beginDeferLock = useCallback(() => {
    deferLockCount.current += 1;
    backgroundSince.current = null;
  }, []);

  const endDeferLock = useCallback(() => {
    deferLockCount.current = Math.max(0, deferLockCount.current - 1);
  }, []);

  const runWithLockDeferred = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      beginDeferLock();
      try {
        return await fn();
      } finally {
        endDeferLock();
      }
    },
    [beginDeferLock, endDeferLock],
  );

  const setAppLockEnabled = useCallback(
    async (enabled: boolean) => {
      await persistAppLockEnabled(enabled);
      setAppLockEnabledState(enabled);

      if (!enabled) {
        setIsUnlocked(true);
        autoPromptCancelled.current = true;
        return;
      }

      if (user) {
        lock();
      }
    },
    [user, lock],
  );

  const refreshBiometrics = useCallback(async () => {
    const method = await resolveBiometricMethod();
    setBiometricMethod(method);
    setBiometricsReady(true);
    return method;
  }, []);

  const unlock = useCallback(async (): Promise<boolean> => {
    if (!lockRequired) {
      setIsUnlocked(true);
      return true;
    }

    if (!biometricsAvailable) {
      return false;
    }

    if (isAuthenticating.current) return false;

    isAuthenticating.current = true;
    setIsChecking(true);

    try {
      const result = await authenticateWithBiometrics(biometricMethod);

      if (result.success) {
        setIsUnlocked(true);
        return true;
      }

      setIsUnlocked(false);
      return false;
    } finally {
      isAuthenticating.current = false;
      setIsChecking(false);
    }
  }, [lockRequired, biometricsAvailable, biometricMethod]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const [method, enabled] = await Promise.all([
          resolveBiometricMethod(),
          getAppLockEnabled(),
        ]);

        if (cancelled) return;

        setBiometricMethod(method);
        setBiometricsReady(true);
        setAppLockEnabledState(enabled);

        if (!user || authLoading) {
          if (!user) {
            sessionLockInitialized.current = false;
          }
          setIsUnlocked(true);
          setIsChecking(false);
          return;
        }

        if (!enabled) {
          setIsUnlocked(true);
          setIsChecking(false);
          sessionLockInitialized.current = true;
          return;
        }

        if (sessionLockInitialized.current) {
          setIsChecking(false);
          return;
        }

        sessionLockInitialized.current = true;

        if (consumeSkipNextAppLock()) {
          setIsUnlocked(true);
          setIsChecking(false);
          return;
        }

        setIsUnlocked(false);
        setIsChecking(false);
      } catch (error) {
        console.warn('App lock init failed', error);
        if (!cancelled) {
          setIsUnlocked(true);
          setIsChecking(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  useEffect(() => {
    if (!lockRequired || isUnlocked || !biometricsReady || !biometricsAvailable) return;

    autoPromptCancelled.current = false;

    async function autoPrompt() {
      await waitForAppActive();
      if (autoPromptCancelled.current || isUnlockedRef.current) return;

      await unlock();
    }

    autoPrompt();

    return () => {
      autoPromptCancelled.current = true;
    };
  }, [lockRequired, isUnlocked, biometricsReady, biometricsAvailable, unlock]);

  useEffect(() => {
    if (!lockRequired) return;

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background') {
        if (deferLockCount.current > 0) return;
        backgroundSince.current = Date.now();
        return;
      }

      if (nextAppState === 'active') {
        refreshBiometrics();

        if (deferLockCount.current > 0) {
          backgroundSince.current = null;
          return;
        }

        if (backgroundSince.current === null) return;

        const elapsed = Date.now() - backgroundSince.current;
        backgroundSince.current = null;

        if (elapsed >= BACKGROUND_LOCK_DELAY_MS) {
          lock();
        }
      }
    });

    return () => subscription.remove();
  }, [lockRequired, lock, refreshBiometrics]);

  useEffect(() => {
    if (!user) {
      setIsUnlocked(true);
      autoPromptCancelled.current = false;
      sessionLockInitialized.current = false;
    }
  }, [user]);

  const isLocked = lockRequired && !isUnlocked;

  const value = useMemo(
    () => ({
      isLocked,
      isChecking: isChecking && lockRequired && biometricsAvailable,
      biometricsAvailable,
      biometricMethod,
      appLockEnabled,
      setAppLockEnabled,
      unlock,
      lock,
      runWithLockDeferred,
    }),
    [
      isLocked,
      isChecking,
      lockRequired,
      biometricsAvailable,
      biometricMethod,
      appLockEnabled,
      setAppLockEnabled,
      unlock,
      lock,
      runWithLockDeferred,
    ],
  );

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock(): AppLockContextValue {
  const context = useContext(AppLockContext);
  if (!context) {
    throw new Error('useAppLock must be used within AppLockProvider');
  }
  return context;
}
