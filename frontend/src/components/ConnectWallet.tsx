'use client';

import { useWallet } from '@/hooks';
import { Button } from '@/components/ui';
import { formatAddress } from '@/lib/utils';

export function ConnectWallet() {
  const { 
    address, 
    ensName, 
    isConnected, 
    isConnecting, 
    balance, 
    connect, 
    disconnect,
  } = useWallet();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        {/* Balance */}
        <div className="hidden sm:flex items-center px-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <span className="text-sm text-slate-400">
            {balance ? `${parseFloat(balance).toFixed(4)} ETH` : '...'}
          </span>
        </div>

        {/* Address Button */}
        <button
          onClick={disconnect}
          className="
            flex items-center gap-2 px-4 py-2 rounded-xl
            bg-linear-to-r from-slate-800/80 to-slate-700/80
            border border-slate-600/50
            hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/10
            transition-all duration-300
          "
        >
          {/* Avatar */}
          <div
            className="w-6 h-6 rounded-full"
            style={{
              background: `linear-gradient(135deg, 
                hsl(${parseInt(address.slice(2, 6), 16) % 360}, 70%, 50%),
                hsl(${(parseInt(address.slice(2, 6), 16) + 60) % 360}, 70%, 50%)
              )`,
            }}
          />
          
          {/* Name/Address */}
          <span className="text-sm font-medium text-white">
            {ensName || formatAddress(address)}
          </span>

          {/* Disconnect icon */}
          <svg
            className="w-4 h-4 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <Button
      onClick={() => connect()}
      isLoading={isConnecting}
      className="gap-2"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
      Connect Wallet
    </Button>
  );
}
