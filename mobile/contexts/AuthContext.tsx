import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import * as api from '@/lib/api';
import { clearToken, getToken, setToken } from '@/lib/auth-storage';
import { markSkipNextAppLock } from '@/lib/app-lock-storage';
import type { KycSubmitPayload, ProfileUpdate, User } from '@/lib/types';

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (fields: ProfileUpdate) => Promise<void>;
  uploadKycDocument: (side: 'front' | 'back', uri: string) => Promise<void>;
  submitKyc: (payload: KycSubmitPayload) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

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
    } catch {
      await clearToken();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  const signIn = useCallback(async (email: string, code: string) => {
    const { token, user: signedInUser } = await api.verifyOtp(email, code);
    await setToken(token);
    markSkipNextAppLock();
    setUser(signedInUser);
  }, []);

  const signOut = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (fields: ProfileUpdate) => {
    const updated = await api.updateProfile(fields);
    setUser(updated);
  }, []);

  const uploadKycDocument = useCallback(async (side: 'front' | 'back', uri: string) => {
    const updated = await api.uploadKycDocument(side, uri);
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
      refreshUser,
      updateProfile,
      uploadKycDocument,
      submitKyc,
    }),
    [user, isLoading, signIn, signOut, refreshUser, updateProfile, uploadKycDocument, submitKyc],
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
