'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { ethers } from 'ethers';
import { getProvider, switchToSepolia } from '@/lib/contracts';

interface WalletContextType {
  address: string | null;
  ensName: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  chainId: number | null;
  balance: string | null;
  signer: ethers.Signer | null;
  provider: ethers.BrowserProvider | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [ensName, setEnsName] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);

  const updateWalletState = useCallback(async () => {
    const browserProvider = getProvider();
    if (!browserProvider) return;

    setProvider(browserProvider);

    try {
      const accounts = await browserProvider.listAccounts();
      if (accounts.length > 0) {
        const account = accounts[0];
        const addr = await account.getAddress();
        setAddress(addr);
        setSigner(account);

        // Get chain ID
        const network = await browserProvider.getNetwork();
        setChainId(Number(network.chainId));

        // Get balance
        const bal = await browserProvider.getBalance(addr);
        setBalance(ethers.formatEther(bal));

        // Try to get ENS name (on mainnet)
        try {
          const mainnetProvider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
          const ens = await mainnetProvider.lookupAddress(addr);
          setEnsName(ens);
        } catch {
          setEnsName(null);
        }
      } else {
        setAddress(null);
        setSigner(null);
        setChainId(null);
        setBalance(null);
        setEnsName(null);
      }
    } catch (error) {
      console.error('Error updating wallet state:', error);
    }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask or another Web3 wallet');
      return;
    }

    setIsConnecting(true);
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      await switchToSepolia();
      await updateWalletState();
    } catch (error) {
      console.error('Error connecting wallet:', error);
    } finally {
      setIsConnecting(false);
    }
  }, [updateWalletState]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setSigner(null);
    setChainId(null);
    setBalance(null);
    setEnsName(null);
  }, []);

  const switchNetwork = useCallback(async () => {
    await switchToSepolia();
    await updateWalletState();
  }, [updateWalletState]);

  // Listen for account changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = () => {
      updateWalletState();
    };

    const handleChainChanged = () => {
      updateWalletState();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    // Check if already connected
    updateWalletState();

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [updateWalletState]);

  return (
    <WalletContext.Provider
      value={{
        address,
        ensName,
        isConnected: !!address,
        isConnecting,
        chainId,
        balance,
        signer,
        provider,
        connect,
        disconnect,
        switchNetwork,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
