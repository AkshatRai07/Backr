'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Modal } from '@/components/ui';
import { VouchForm } from '@/components/VouchForm';
import { VouchCard } from '@/components/VouchCard';
import { useWallet, useVouches } from '@/hooks';
import { api, Vouch } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

type TabType = 'received' | 'given' | 'create';

export default function VouchPage() {
  const { isConnected, address } = useWallet();
  const { vouchesReceived, vouchesGiven, isLoading, mutate } = useVouches();
  const [activeTab, setActiveTab] = useState<TabType>('received');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedVouch, setSelectedVouch] = useState<Vouch | null>(null);
  const [showRevokeModal, setShowRevokeModal] = useState(false);

  const handleCreateVouch = async (data: {
    voucheeAddress: string;
    amount: number;
    message?: string;
  }) => {
    if (!address) return;
    setIsSubmitting(true);
    try {
      await api.vouches.create({
        voucher_address: address,
        vouchee_address: data.voucheeAddress,
        amount: data.amount,
        message: data.message,
      });
      mutate();
      setActiveTab('given');
    } catch (error) {
      console.error('Failed to create vouch:', error);
      alert('Failed to create vouch. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivateVouch = async (vouch: Vouch) => {
    try {
      await api.vouches.activate(vouch.id);
      mutate();
    } catch (error) {
      console.error('Failed to activate vouch:', error);
      alert('Failed to activate vouch. Please try again.');
    }
  };

  const handleRevokeVouch = async () => {
    if (!selectedVouch) return;
    try {
      await api.vouches.revoke(selectedVouch.id);
      mutate();
      setShowRevokeModal(false);
      setSelectedVouch(null);
    } catch (error) {
      console.error('Failed to revoke vouch:', error);
      alert('Failed to revoke vouch. Please try again.');
    }
  };

  const openRevokeModal = (vouch: Vouch) => {
    setSelectedVouch(vouch);
    setShowRevokeModal(true);
  };

  if (!isConnected) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Connect to Manage Vouches</h1>
          <p className="text-slate-400 mb-6">
            Connect your wallet to view and create vouches.
          </p>
          <Button size="lg">Connect Wallet</Button>
        </div>
      </div>
    );
  }

  // Calculate stats
  const activeReceived = vouchesReceived.filter(v => v.status === 'active');
  const totalReceivedAmount = activeReceived.reduce((sum, v) => sum + v.amount, 0);
  const activeGiven = vouchesGiven.filter(v => v.status === 'active');
  const totalGivenAmount = activeGiven.reduce((sum, v) => sum + v.amount, 0);

  const tabs = [
    { id: 'received' as TabType, label: 'Received', count: vouchesReceived.length },
    { id: 'given' as TabType, label: 'Given', count: vouchesGiven.length },
    { id: 'create' as TabType, label: 'Create New', count: null },
  ];

  return (
    <div className="px-4 py-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Vouches</h1>
        <p className="text-slate-400">
          Manage your trust network and credit relationships
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-cyan-400">{activeReceived.length}</p>
            <p className="text-xs text-slate-500">Vouches Received</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalReceivedAmount)}</p>
            <p className="text-xs text-slate-500">Credit Available</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-violet-400">{activeGiven.length}</p>
            <p className="text-xs text-slate-500">Vouches Given</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-400">{formatCurrency(totalGivenAmount)}</p>
            <p className="text-xs text-slate-500">Credit Extended</p>
          </CardContent>
        </Card>
      </div>

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
            {tab.count !== null && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? 'bg-cyan-500/30' : 'bg-slate-700'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'create' ? (
        <div className="max-w-lg">
          <VouchForm onSubmit={handleCreateVouch} isLoading={isSubmitting} />
        </div>
      ) : (
        <div>
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-64 rounded-2xl skeleton" />
              ))}
            </div>
          ) : activeTab === 'received' ? (
            vouchesReceived.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vouchesReceived.map(vouch => (
                  <VouchCard
                    key={vouch.id}
                    vouch={vouch}
                    isGiven={false}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">No vouches received yet</h3>
                  <p className="text-slate-500 text-sm max-w-sm mx-auto">
                    Share your wallet address with trusted contacts and ask them to vouch for you to start building credit.
                  </p>
                </CardContent>
              </Card>
            )
          ) : (
            vouchesGiven.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vouchesGiven.map(vouch => (
                  <VouchCard
                    key={vouch.id}
                    vouch={vouch}
                    isGiven={true}
                    onActivate={vouch.status === 'pending' ? handleActivateVouch : undefined}
                    onRevoke={vouch.status === 'active' ? openRevokeModal : undefined}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">No vouches given yet</h3>
                  <p className="text-slate-500 text-sm max-w-sm mx-auto mb-4">
                    Help someone build their credit by vouching for them.
                  </p>
                  <Button onClick={() => setActiveTab('create')}>
                    Create Your First Vouch
                  </Button>
                </CardContent>
              </Card>
            )
          )}
        </div>
      )}

      {/* Revoke Confirmation Modal */}
      <Modal
        isOpen={showRevokeModal}
        onClose={() => {
          setShowRevokeModal(false);
          setSelectedVouch(null);
        }}
        title="Revoke Vouch"
      >
        <div className="space-y-4">
          <p className="text-slate-400">
            Are you sure you want to revoke this vouch? This action cannot be undone.
          </p>
          {selectedVouch && (
            <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
              <p className="text-sm text-slate-400">Amount: <span className="text-white">{formatCurrency(selectedVouch.amount)}</span></p>
              <p className="text-sm text-slate-400">To: <span className="text-white font-mono">{selectedVouch.vouchee_address.slice(0, 10)}...{selectedVouch.vouchee_address.slice(-8)}</span></p>
              {selectedVouch.utilized_amount > 0 && (
                <p className="text-sm text-orange-400 mt-2">
                  Note: {formatCurrency(selectedVouch.utilized_amount)} is currently utilized
                </p>
              )}
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setShowRevokeModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleRevokeVouch}>
              Revoke Vouch
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
