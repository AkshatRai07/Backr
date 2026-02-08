'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, Vouch } from '@/lib/api';
import { useWallet } from './useWallet';

export function useVouches() {
  const { address, isConnected } = useWallet();
  const [vouchesGiven, setVouchesGiven] = useState<Vouch[]>([]);
  const [vouchesReceived, setVouchesReceived] = useState<Vouch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVouches = useCallback(async () => {
    if (!address) {
      setVouchesGiven([]);
      setVouchesReceived([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [given, received] = await Promise.all([
        api.getVouches(address, 'given'),
        api.getVouches(address, 'received'),
      ]);
      setVouchesGiven(given);
      setVouchesReceived(received);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch vouches');
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  const createVouch = useCallback(
    async (borrowerAddress: string, limitAmount: number) => {
      if (!address) throw new Error('Not connected');

      const vouch = await api.createVouch(address, borrowerAddress, limitAmount);
      await fetchVouches();
      return vouch;
    },
    [address, fetchVouches]
  );

  const deactivateVouch = useCallback(
    async (vouchId: number) => {
      await api.deactivateVouch(vouchId);
      await fetchVouches();
    },
    [fetchVouches]
  );

  const mutate = useCallback(() => {
    fetchVouches();
  }, [fetchVouches]);

  useEffect(() => {
    if (isConnected && address) {
      fetchVouches();
    } else {
      setVouchesGiven([]);
      setVouchesReceived([]);
    }
  }, [isConnected, address, fetchVouches]);

  // Calculate totals
  const totalVouchedAmount = vouchesGiven.reduce((sum, v) => sum + (v.amount || 0), 0);
  const totalAvailableCredit = vouchesReceived
    .filter(v => v.status === 'active')
    .reduce((sum, v) => sum + ((v.amount || 0) - (v.utilized_amount || 0)), 0);

  return {
    vouchesGiven,
    vouchesReceived,
    isLoading,
    error,
    mutate,
    createVouch,
    deactivateVouch,
    totalVouchedAmount,
    totalAvailableCredit,
  };
}
