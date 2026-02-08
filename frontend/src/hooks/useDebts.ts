'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, Debt } from '@/lib/api';
import { useWallet } from './useWallet';

export function useDebts() {
  const { address, isConnected } = useWallet();
  const [debtsOwed, setDebtsOwed] = useState<Debt[]>([]);
  const [debtsGiven, setDebtsGiven] = useState<Debt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDebts = useCallback(async () => {
    if (!address) {
      setDebtsOwed([]);
      setDebtsGiven([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [myDebts, debtsAsLender] = await Promise.all([
        api.getDebts(address),
        api.getLenderDebts(address),
      ]);
      setDebtsOwed(myDebts);
      setDebtsGiven(debtsAsLender);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch debts');
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  const borrow = useCallback(
    async (amount: number, repaymentDays?: number) => {
      if (!address) throw new Error('Not connected');

      const result = await api.borrow(address, amount, repaymentDays);
      await fetchDebts();
      return result;
    },
    [address, fetchDebts]
  );

  const repay = useCallback(
    async (debtId: number, amount: number) => {
      if (!address) throw new Error('Not connected');

      const result = await api.repay(address, debtId, amount);
      await fetchDebts();
      return result;
    },
    [address, fetchDebts]
  );

  const mutate = useCallback(() => {
    fetchDebts();
  }, [fetchDebts]);

  useEffect(() => {
    if (isConnected && address) {
      fetchDebts();
    } else {
      setDebtsOwed([]);
      setDebtsGiven([]);
    }
  }, [isConnected, address, fetchDebts]);

  // Calculate totals
  const totalDebt = debtsOwed
    .filter(d => d.status === 'active' || d.status === 'overdue')
    .reduce((sum, d) => sum + d.amount_owed, 0);

  const activeDebts = debtsOwed.filter(d => d.status === 'active' || d.status === 'overdue');
  const paidDebts = debtsOwed.filter(d => d.status === 'paid');
  const overdueDebts = debtsOwed.filter(d => d.status === 'overdue');

  return {
    debtsOwed,
    debtsGiven,
    isLoading,
    error,
    mutate,
    borrow,
    repay,
    totalDebt,
    activeDebts,
    paidDebts,
    overdueDebts,
  };
}
