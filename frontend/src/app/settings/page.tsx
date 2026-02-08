'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Input, Label, Badge } from '@/components/ui';
import { useWallet, useUser } from '@/hooks';
import { ContractActions, getENSTokenId } from '@/lib/contracts';
import { formatAddress } from '@/lib/utils';

export default function SettingsPage() {
  const { isConnected, address, signer } = useWallet();
  const { user, mutate } = useUser();
  const [ensName, setEnsName] = useState('');
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);

  const handleStakeENS = async () => {
    if (!signer || !ensName) return;
    setIsStaking(true);
    try {
      // Convert ENS name to token ID
      const tokenId = getENSTokenId(ensName);
      // First approve the collateral contract
      const approveTx = await ContractActions.approveENSForCollateral(signer, tokenId);
      await approveTx.wait();
      // Then stake
      const tx = await ContractActions.stakeENS(signer, tokenId);
      await tx.wait();
      mutate();
      setEnsName('');
      alert('ENS domain staked successfully!');
    } catch (error) {
      console.error('Failed to stake ENS:', error);
      alert('Failed to stake ENS. Make sure you own this domain.');
    } finally {
      setIsStaking(false);
    }
  };

  const handleUnstakeENS = async () => {
    if (!signer || !user?.ens_name) return;
    setIsUnstaking(true);
    try {
      const tx = await ContractActions.unstakeENS(signer);
      await tx.wait();
      mutate();
      alert('ENS domain unstaked successfully!');
    } catch (error) {
      console.error('Failed to unstake ENS:', error);
      alert('Failed to unstake ENS. You may have outstanding obligations.');
    } finally {
      setIsUnstaking(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Connect to Access Settings</h1>
          <p className="text-slate-400 mb-6">
            Connect your wallet to manage your account settings.
          </p>
          <Button size="lg">Connect Wallet</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-slate-400">
          Manage your account and reputation settings
        </p>
      </div>

      <div className="space-y-6">
        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Your wallet and account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/30">
              <div>
                <p className="text-sm text-slate-400 mb-1">Connected Wallet</p>
                <p className="text-white font-mono">{address}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigator.clipboard.writeText(address!)}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-800/30">
                <p className="text-sm text-slate-400 mb-1">Credit Score</p>
                <p className="text-2xl font-bold text-cyan-400">{user?.credit_score ?? 300}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/30">
                <p className="text-sm text-slate-400 mb-1">Member Since</p>
                <p className="text-lg text-white">
                  {user?.created_at 
                    ? new Date(user.created_at).toLocaleDateString() 
                    : 'New User'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ENS Reputation */}
        <Card variant="gradient">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>ENS Reputation Staking</CardTitle>
                <CardDescription>
                  Stake your ENS domain to boost your reputation
                </CardDescription>
              </div>
              {user?.ens_name && (
                <Badge variant="success">ENS Staked</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {user?.ens_name ? (
              <div className="space-y-4">
                {/* Currently staked ENS */}
                <div className="flex items-center gap-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="w-12 h-12 rounded-full bg-linear-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                    <span className="text-white font-bold">
                      {user.ens_name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">{user.ens_name}</p>
                    <p className="text-sm text-emerald-400">Currently staked for reputation</p>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleUnstakeENS}
                    isLoading={isUnstaking}
                  >
                    Unstake
                  </Button>
                </div>

                {/* Benefits */}
                <div className="p-4 rounded-xl bg-slate-800/30">
                  <h4 className="text-white font-medium mb-3">Staking Benefits</h4>
                  <ul className="space-y-2 text-sm text-slate-400">
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Higher trust score for vouching
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Increased credit limit potential
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Verified identity marker
                    </li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Stake form */}
                <div className="space-y-2">
                  <Label htmlFor="ensName">ENS Domain Name</Label>
                  <div className="flex gap-3">
                    <Input
                      id="ensName"
                      type="text"
                      placeholder="yourname.eth"
                      value={ensName}
                      onChange={(e) => setEnsName(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleStakeENS}
                      isLoading={isStaking}
                      disabled={!ensName || !ensName.endsWith('.eth')}
                    >
                      Stake ENS
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Enter your ENS domain (e.g., yourname.eth)
                  </p>
                </div>

                {/* Info box */}
                <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm">
                      <p className="text-cyan-400 font-medium mb-1">Why stake your ENS?</p>
                      <p className="text-slate-400">
                        Staking your ENS domain proves ownership and adds a layer of trust to your profile. 
                        If you default on loans, your ENS could be subject to slashing based on reputation rules.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Network Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Network</CardTitle>
            <CardDescription>Current blockchain network settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/30">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <div>
                  <p className="text-white font-medium">Sepolia Testnet</p>
                  <p className="text-sm text-slate-500">Chain ID: 11155111</p>
                </div>
              </div>
              <Badge variant="success">Connected</Badge>
            </div>

            <div className="mt-4 p-4 rounded-xl bg-slate-800/30">
              <h4 className="text-white font-medium mb-3">Contract Addresses</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Collateral Contract</span>
                  <span className="text-slate-300 font-mono text-xs">
                    {formatAddress(process.env.NEXT_PUBLIC_COLLATERAL_CONTRACT || '0x...')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Reputation Contract</span>
                  <span className="text-slate-300 font-mono text-xs">
                    {formatAddress(process.env.NEXT_PUBLIC_REPUTATION_CONTRACT || '0x...')}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
