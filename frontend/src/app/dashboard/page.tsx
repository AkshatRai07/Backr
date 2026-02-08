'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui';
import { CreditScoreCard } from '@/components/CreditScoreCard';
import { StatCard, StatsRow } from '@/components/StatCard';
import { VouchListItem } from '@/components/VouchCard';
import { DebtListItem } from '@/components/DebtCard';
import { useWallet, useUser, useVouches, useDebts } from '@/hooks';
import { formatCurrency, formatAddress } from '@/lib/utils';
import { api, PlatformStats } from '@/lib/api';

export default function DashboardPage() {
  const { isConnected, address } = useWallet();
  const { user, isLoading: userLoading, mutate: mutateUser } = useUser();
  const { vouchesReceived, vouchesGiven, isLoading: vouchesLoading } = useVouches();
  const { debtsOwed, debtsGiven, isLoading: debtsLoading } = useDebts();
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    api.stats.getPlatformStats().then(setStats).catch(console.error);
  }, []);

  // Calculate user stats - handle both is_active (boolean) and status (string) field formats
  const activeVouchesReceived = vouchesReceived.filter(v => v.is_active === true || v.status === 'active');
  const totalCreditAvailable = activeVouchesReceived.reduce(
    (sum, v) => sum + ((v.amount || v.limit_amount || 0) - (v.utilized_amount || v.current_usage || 0)), 0
  );
  const activeDebts = debtsOwed.filter(d => d.status !== 'paid');
  const totalDebtOwed = activeDebts.reduce((sum, d) => sum + d.amount_owed, 0);
  
  // Calculate vouches given stats
  const activeVouchesGiven = vouchesGiven.filter(v => v.is_active === true || v.status === 'active');
  const totalVouchesGivenAmount = activeVouchesGiven.reduce((s, v) => s + (v.amount || v.limit_amount || 0), 0);

  if (!isConnected) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Connect Your Wallet</h1>
          <p className="text-slate-400 mb-6">
            Connect your wallet to view your dashboard, manage vouches, and access credit.
          </p>
          <Button size="lg">Connect Wallet</Button>
        </div>
      </div>
    );
  }

  const isLoading = userLoading || vouchesLoading || debtsLoading;

  return (
    <div className="px-4 py-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-slate-400">
          Welcome back, {formatAddress(address!)}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger-children">
        <StatCard
          title="Credit Score"
          value={user?.credit_score ?? 300}
          subtitle="Based on your history"
          color="cyan"
          variant="gradient"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <StatCard
          title="Available Credit"
          value={formatCurrency(totalCreditAvailable)}
          subtitle={`${activeVouchesReceived.length} active vouches`}
          color="emerald"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          title="Outstanding Debt"
          value={formatCurrency(totalDebtOwed)}
          subtitle={`${activeDebts.length} active loans`}
          color="orange"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
        <StatCard
          title="Vouches Given"
          value={activeVouchesGiven.length}
          subtitle={`${formatCurrency(totalVouchesGivenAmount)} total`}
          color="violet"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column - Credit Score & Quick Actions */}
        <div className="space-y-6">
          <CreditScoreCard score={user?.credit_score ?? 300} />
          
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/vouch" className="block">
                <Button variant="secondary" className="w-full justify-start">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Create a Vouch
                </Button>
              </Link>
              <Link href="/borrow" className="block">
                <Button variant="secondary" className="w-full justify-start">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Borrow Funds
                </Button>
              </Link>
              <Link href="/debts" className="block">
                <Button variant="secondary" className="w-full justify-start">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Repay Debt
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* ENS Status */}
          <Card>
            <CardHeader>
              <CardTitle>ENS Reputation</CardTitle>
            </CardHeader>
            <CardContent>
              {user?.ens_name ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">
                        {user.ens_name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-white font-medium">{user.ens_name}</p>
                      <p className="text-xs text-slate-500">Staked for reputation</p>
                    </div>
                  </div>
                  <Badge variant="success">ENS Verified</Badge>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-slate-400 text-sm mb-4">
                    Stake your ENS domain for enhanced reputation
                  </p>
                  <Link href="/settings">
                    <Button variant="secondary" size="sm">
                      Stake ENS
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Middle column - Vouches */}
        <div className="space-y-6">
          {/* Vouches Received */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Vouches Received</CardTitle>
              <Badge variant="info">{activeVouchesReceived.length} active</Badge>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 rounded-xl skeleton" />
                  ))}
                </div>
              ) : vouchesReceived.length > 0 ? (
                <div className="space-y-3">
                  {vouchesReceived.slice(0, 4).map(vouch => (
                    <VouchListItem key={vouch.id} vouch={vouch} isGiven={false} />
                  ))}
                  {vouchesReceived.length > 4 && (
                    <Link href="/vouch" className="block">
                      <Button variant="ghost" size="sm" className="w-full">
                        View all {vouchesReceived.length} vouches
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-500 text-sm">No vouches received yet</p>
                  <p className="text-slate-600 text-xs mt-1">
                    Ask trusted contacts to vouch for you
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vouches Given */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Vouches Given</CardTitle>
              <Link href="/vouch">
                <Button variant="ghost" size="sm">Create</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <div key={i} className="h-16 rounded-xl skeleton" />
                  ))}
                </div>
              ) : vouchesGiven.length > 0 ? (
                <div className="space-y-3">
                  {vouchesGiven.slice(0, 3).map(vouch => (
                    <VouchListItem key={vouch.id} vouch={vouch} isGiven={true} />
                  ))}
                  {vouchesGiven.length > 3 && (
                    <Link href="/vouch" className="block">
                      <Button variant="ghost" size="sm" className="w-full">
                        View all {vouchesGiven.length} vouches
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-slate-500 text-sm">No vouches given yet</p>
                  <Link href="/vouch">
                    <Button variant="secondary" size="sm" className="mt-3">
                      Vouch for someone
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column - Debts & Activity */}
        <div className="space-y-6">
          {/* Active Debts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Active Loans</CardTitle>
              <Link href="/borrow">
                <Button variant="ghost" size="sm">Borrow</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <div key={i} className="h-16 rounded-xl skeleton" />
                  ))}
                </div>
              ) : activeDebts.length > 0 ? (
                <div className="space-y-3">
                  {activeDebts.slice(0, 3).map(debt => (
                    <DebtListItem key={debt.id} debt={debt} isLender={false} />
                  ))}
                  {activeDebts.length > 3 && (
                    <Link href="/debts" className="block">
                      <Button variant="ghost" size="sm" className="w-full">
                        View all {activeDebts.length} loans
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-slate-500 text-sm">No active loans</p>
                  <Link href="/borrow">
                    <Button variant="secondary" size="sm" className="mt-3">
                      Get a loan
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Loans Given (as lender) */}
          {debtsGiven.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Loans Given</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {debtsGiven.slice(0, 3).map(debt => (
                    <DebtListItem key={debt.id} debt={debt} isLender={true} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Platform Stats */}
          {stats && (
            <Card>
              <CardHeader>
                <CardTitle>Platform Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Total Users</span>
                  <span className="text-white font-medium">{stats.total_users.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Active Vouches</span>
                  <span className="text-white font-medium">{(stats.active_vouches ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Total Loaned</span>
                  <span className="text-white font-medium">{formatCurrency(stats.total_debt_issued ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Default Rate</span>
                  <span className="text-emerald-400 font-medium">{(stats.default_rate ?? 0).toFixed(2)}%</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
