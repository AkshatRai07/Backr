'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { BorrowForm } from '@/components/BorrowForm';
import { StatCard } from '@/components/StatCard';
import { useWallet, useUser, useVouches } from '@/hooks';
import { api } from '@/lib/api';
import { formatCurrency, getCreditScoreLabel } from '@/lib/utils';

export default function BorrowPage() {
  const { isConnected, address } = useWallet();
  const { user } = useUser();
  const { vouchesReceived } = useVouches();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Calculate available credit
  const activeVouches = vouchesReceived.filter(v => v.status === 'active');
  const totalCreditAvailable = activeVouches.reduce(
    (sum, v) => sum + (v.amount - v.utilized_amount), 0
  );

  const handleBorrow = async (data: {
    lenderAddress: string;
    amount: number;
    durationDays: number;
  }) => {
    if (!address) return;
    setIsSubmitting(true);
    try {
      await api.debts.create({
        borrower_address: address,
        amount: data.amount,
        repayment_days: data.durationDays,
      });
      
      setSuccess(true);
    } catch (error) {
      console.error('Failed to create loan:', error);
      alert('Failed to create loan request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Connect to Borrow</h1>
          <p className="text-slate-400 mb-6">
            Connect your wallet to borrow against your vouches.
          </p>
          <Button size="lg">Connect Wallet</Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Loan Request Submitted!</h1>
          <p className="text-slate-400 mb-6">
            Your loan has been processed. The funds will be available in your account shortly.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/debts">
              <Button>View My Debts</Button>
            </Link>
            <Button variant="ghost" onClick={() => setSuccess(false)}>
              Borrow More
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Borrow</h1>
        <p className="text-slate-400">
          Access credit backed by your vouches
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Stats & Info */}
        <div className="space-y-6">
          {/* Credit Overview */}
          <Card variant="gradient">
            <CardHeader>
              <CardTitle>Your Credit Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Credit Score</span>
                <div className="text-right">
                  <span className="text-2xl font-bold text-white">{user?.credit_score ?? 300}</span>
                  <p className="text-xs text-slate-500">{getCreditScoreLabel(user?.credit_score ?? 300)}</p>
                </div>
              </div>
              <div className="h-px bg-slate-700/50" />
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Available Credit</span>
                <span className="text-xl font-bold text-emerald-400">{formatCurrency(totalCreditAvailable)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Active Vouches</span>
                <span className="text-white font-medium">{activeVouches.length}</span>
              </div>
            </CardContent>
          </Card>

          {/* No vouches warning */}
          {activeVouches.length === 0 && (
            <Card className="border-orange-500/30">
              <CardContent className="p-5">
                <div className="flex gap-3">
                  <svg className="w-6 h-6 text-orange-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <h4 className="text-white font-medium mb-1">No Active Vouches</h4>
                    <p className="text-sm text-slate-400 mb-3">
                      You need at least one active vouch to borrow. Ask trusted contacts to vouch for you.
                    </p>
                    <Link href="/vouch">
                      <Button variant="secondary" size="sm">
                        View Vouches
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* How it works */}
          <Card>
            <CardHeader>
              <CardTitle>How Borrowing Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0">
                  <span className="text-cyan-400 font-bold text-sm">1</span>
                </div>
                <div>
                  <p className="text-white font-medium">Select a Vouch</p>
                  <p className="text-sm text-slate-400">Choose which vouch to borrow against</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0">
                  <span className="text-cyan-400 font-bold text-sm">2</span>
                </div>
                <div>
                  <p className="text-white font-medium">Enter Amount</p>
                  <p className="text-sm text-slate-400">Up to the available credit limit</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0">
                  <span className="text-cyan-400 font-bold text-sm">3</span>
                </div>
                <div>
                  <p className="text-white font-medium">Set Duration</p>
                  <p className="text-sm text-slate-400">Choose your repayment timeline</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-medium">Receive Funds</p>
                  <p className="text-sm text-slate-400">Instant transfer via payment channel</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Borrow Form */}
        <div className="lg:col-span-2">
          <BorrowForm
            availableVouches={vouchesReceived}
            maxBorrowAmount={totalCreditAvailable}
            onSubmit={handleBorrow}
            isLoading={isSubmitting}
          />
        </div>
      </div>
    </div>
  );
}
