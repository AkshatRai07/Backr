'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, User } from '@/lib/api';
import { useWallet } from './useWallet';

export function useUser() {
  const { address, isConnected } = useWallet();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    if (!address) {
      setUser(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const userData = await api.getUser(address);
      setUser(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  const updateSettings = useCallback(
    async (settings: { garnish_percentage?: number; auto_repay_enabled?: boolean }) => {
      if (!address) return;

      try {
        const updatedUser = await api.updateSettings(address, settings);
        setUser(updatedUser);
        return updatedUser;
      } catch (err) {
        throw err;
      }
    },
    [address]
  );

  const mutate = useCallback(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (isConnected && address) {
      fetchUser();
    } else {
      setUser(null);
    }
  }, [isConnected, address, fetchUser]);

  return {
    user,
    isLoading,
    error,
    mutate,
    updateSettings,
  };
}
