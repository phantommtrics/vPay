import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import * as api from '@/lib/api';
import { clearToken, getToken, setToken } from '@/lib/auth-storage';
import { collectDeviceInfo } from '@/lib/device-info';
import { clearRegisteredDeviceId, setRegisteredDeviceId } from '@/lib/device-storage';
import { markSkipNextAppLock } from '@/lib/app-lock-storage';
import type { KycSubmitPayload, ProfileUpdate, User } from '@/lib/types';

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: (confirmation: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (fields: ProfileUpdate) => Promise<void>;
  uploadKycDocument: (side: 'front' | 'back' | 'selfie', uri: string, mimeType?: string | null) => Promise<void>;
  submitKyc: (payload: KycSubmitPayload) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function syncRegisteredDevice(): Promise<void> {
  const token = await getToken();
  if (!token) {
    return;
  }

  try {
    const deviceInfo = await collectDeviceInfo();
    const { device } = await api.registerDevice(deviceInfo);
    await setRegisteredDeviceId(device.id);
  } catch (error) {
    console.warn('Failed to register device', error);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setUser(null);
      return;
    }

    try {
      const me = await api.fetchMe();
      setUser(me);
      await syncRegisteredDevice();
    } catch {
      await clearToken();
      await clearRegisteredDeviceId();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        await refreshUser();
      } catch (error) {
        console.warn('Failed to restore session', error);
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  const signIn = useCallback(async (email: string, code: string) => {
    const deviceInfo = await collectDeviceInfo();
    const { token, user: signedInUser, device } = await api.verifyOtp(email, code, deviceInfo);
    await setToken(token);
    if (device?.id) {
      await setRegisteredDeviceId(device.id);
    }
    markSkipNextAppLock();
    setUser(signedInUser);
  }, []);

  const signOut = useCallback(async () => {
    await clearToken();
    await clearRegisteredDeviceId();
    setUser(null);
  }, []);

  const deleteAccount = useCallback(
    async (confirmation: string) => {
      await api.deleteAccount(confirmation);
      await clearToken();
      await clearRegisteredDeviceId();
      setUser(null);
    },
    [],
  );

  const updateProfile = useCallback(async (fields: ProfileUpdate) => {
    const updated = await api.updateProfile(fields);
    setUser(updated);
  }, []);

  const uploadKycDocument = useCallback(async (side: 'front' | 'back' | 'selfie', uri: string, mimeType?: string | null) => {
    const updated = await api.uploadKycDocument(side, uri, mimeType);
    setUser(updated);
  }, []);

  const submitKyc = useCallback(async (payload: KycSubmitPayload) => {
    const updated = await api.submitKyc(payload);
    setUser(updated);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      signIn,
      signOut,
      deleteAccount,
      refreshUser,
      updateProfile,
      uploadKycDocument,
      submitKyc,
    }),
    [
      user,
      isLoading,
      signIn,
      signOut,
      deleteAccount,
      refreshUser,
      updateProfile,
      uploadKycDocument,
      submitKyc,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
