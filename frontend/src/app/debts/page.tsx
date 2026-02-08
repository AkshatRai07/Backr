'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Modal, Input, Label } from '@/components/ui';
import { DebtCard } from '@/components/DebtCard';
import { useWallet, useDebts } from '@/hooks';
import { api, Debt } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

type TabType = 'owed' | 'given';

export default function DebtsPage() {
  const { isConnected, address } = useWallet();
  const { debtsOwed, debtsGiven, isLoading, mutate } = useDebts();
  const [activeTab, setActiveTab] = useState<TabType>('owed');
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [repayAmount, setRepayAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRepay = async () => {
    if (!selectedDebt || !repayAmount || !address) return;
    
    const amount = parseFloat(repayAmount);
    if (isNaN(amount) || amount <= 0 || amount > selectedDebt.amount_owed) {
      alert('Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    try {
      // Pass borrower address (the connected wallet repaying their debt)
      await api.debts.repay(selectedDebt.id, amount, address);
      mutate();
      setShowRepayModal(false);
      setSelectedDebt(null);
      setRepayAmount('');
    } catch (error) {
      console.error('Failed to repay:', error);
      alert('Failed to process repayment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openRepayModal = (debt: Debt) => {
    setSelectedDebt(debt);
    setRepayAmount(debt.amount_owed.toString());
    setShowRepayModal(true);
  };

  if (!isConnected) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Connect to View Debts</h1>
          <p className="text-slate-400 mb-6">
            Connect your wallet to manage your loans and repayments.
          </p>
          <Button size="lg">Connect Wallet</Button>
        </div>
      </div>
    );
  }

  // Calculate stats
  const activeDebtsOwed = debtsOwed.filter(d => d.status !== 'paid');
  const totalOwed = activeDebtsOwed.reduce((sum, d) => sum + d.amount_owed, 0);
  const overdueDebts = debtsOwed.filter(d => d.status === 'overdue');
  
  const activeDebtsGiven = debtsGiven.filter(d => d.status !== 'paid');
  const totalToReceive = activeDebtsGiven.reduce((sum, d) => sum + d.amount_owed, 0);

  const paidDebts = debtsOwed.filter(d => d.status === 'paid');
  const totalPaid = paidDebts.reduce((sum, d) => sum + d.original_amount, 0);

  const tabs = [
    { id: 'owed' as TabType, label: 'My Debts', count: activeDebtsOwed.length },
    { id: 'given' as TabType, label: 'Loans Given', count: activeDebtsGiven.length },
  ];

  return (
    <div className="px-4 py-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Debts & Loans</h1>
        <p className="text-slate-400">
          Track and manage your borrowings and loans
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-400">{formatCurrency(totalOwed)}</p>
            <p className="text-xs text-slate-500">Total Owed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{overdueDebts.length}</p>
            <p className="text-xs text-slate-500">Overdue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-cyan-400">{formatCurrency(totalToReceive)}</p>
            <p className="text-xs text-slate-500">To Receive</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalPaid)}</p>
            <p className="text-xs text-slate-500">Total Repaid</p>
          </CardContent>
        </Card>
      </div>

      {/* Overdue warning */}
      {overdueDebts.length > 0 && (
        <Card className="mb-6 border-red-500/30 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h4 className="text-red-400 font-semibold mb-1">
                  {overdueDebts.length} Overdue Payment{overdueDebts.length > 1 ? 's' : ''}
                </h4>
                <p className="text-sm text-slate-400 mb-3">
                  You have overdue payments totaling {formatCurrency(overdueDebts.reduce((s, d) => s + d.amount_owed, 0))}. 
                  Late payments affect your credit score.
                </p>
                <Button 
                  variant="danger" 
                  size="sm"
                  onClick={() => openRepayModal(overdueDebts[0])}
                >
                  Pay Now
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-800 pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            {tab.label}
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
              activeTab === tab.id ? 'bg-cyan-500/30' : 'bg-slate-700'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 rounded-2xl skeleton" />
          ))}
        </div>
      ) : activeTab === 'owed' ? (
        debtsOwed.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {debtsOwed.map(debt => (
              <DebtCard
                key={debt.id}
                debt={debt}
                isLender={false}
                onRepay={debt.status !== 'paid' ? openRepayModal : undefined}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No Active Debts</h3>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">
                You don't have any outstanding loans. Great job staying debt-free!
              </p>
            </CardContent>
          </Card>
        )
      ) : (
        debtsGiven.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {debtsGiven.map(debt => (
              <DebtCard
                key={debt.id}
                debt={debt}
                isLender={true}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No Loans Given</h3>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">
                You haven't lent any funds yet. When someone borrows against your vouch, it will appear here.
              </p>
            </CardContent>
          </Card>
        )
      )}

      {/* Repay Modal */}
      <Modal
        isOpen={showRepayModal}
        onClose={() => {
          setShowRepayModal(false);
          setSelectedDebt(null);
          setRepayAmount('');
        }}
        title="Make a Repayment"
      >
        {selectedDebt && (
          <div className="space-y-4">
            {/* Debt summary */}
            <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
              <div className="flex justify-between mb-2">
                <span className="text-slate-400 text-sm">Outstanding</span>
                <span className="text-white font-semibold">{formatCurrency(selectedDebt.amount_owed)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-sm">Original Amount</span>
                <span className="text-slate-300">{formatCurrency(selectedDebt.original_amount)}</span>
              </div>
            </div>

            {/* Amount input */}
            <div className="space-y-2">
              <Label htmlFor="repayAmount">Repayment Amount</Label>
              <Input
                id="repayAmount"
                type="number"
                value={repayAmount}
                onChange={(e) => setRepayAmount(e.target.value)}
                placeholder="0.00"
                min={0}
                max={selectedDebt.amount_owed}
                step="0.01"
              />
              {/* Quick amount buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setRepayAmount((selectedDebt.amount_owed * 0.25).toFixed(2))}
                  className="px-3 py-1 text-xs rounded-lg bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
                >
                  25%
                </button>
                <button
                  onClick={() => setRepayAmount((selectedDebt.amount_owed * 0.5).toFixed(2))}
                  className="px-3 py-1 text-xs rounded-lg bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
                >
                  50%
                </button>
                <button
                  onClick={() => setRepayAmount((selectedDebt.amount_owed * 0.75).toFixed(2))}
                  className="px-3 py-1 text-xs rounded-lg bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
                >
                  75%
                </button>
                <button
                  onClick={() => setRepayAmount(selectedDebt.amount_owed.toString())}
                  className="px-3 py-1 text-xs rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
                >
                  Full
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-4">
              <Button 
                variant="ghost" 
                onClick={() => {
                  setShowRepayModal(false);
                  setSelectedDebt(null);
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleRepay} 
                isLoading={isSubmitting}
                disabled={!repayAmount || parseFloat(repayAmount) <= 0}
              >
                Pay {repayAmount ? formatCurrency(parseFloat(repayAmount)) : '$0.00'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
