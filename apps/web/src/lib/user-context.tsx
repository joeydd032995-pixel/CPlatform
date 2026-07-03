'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getMe } from './api-client';

const STORAGE_KEY = 'cplatform:userId';

function readOrCreateUserId(): string {
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, created);
  return created;
}

export type UserContextValue = {
  // null until mounted client-side (SSR-safe placeholder).
  userId: string | null;
  balance: number | null;
  refreshBalance: () => Promise<void>;
  newIdentity: () => void;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    setUserId(readOrCreateUserId());
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!userId) return;
    try {
      const me = await getMe(userId);
      setBalance(me.balance);
    } catch {
      // Tolerate failure -- Header shows "--" while balance is null.
      setBalance(null);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      void refreshBalance();
    }
  }, [userId, refreshBalance]);

  const newIdentity = useCallback(() => {
    const created = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, created);
    setBalance(null);
    setUserId(created);
  }, []);

  const value = useMemo<UserContextValue>(
    () => ({ userId, balance, refreshBalance, newIdentity }),
    [userId, balance, refreshBalance, newIdentity]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within a UserProvider');
  return ctx;
}
