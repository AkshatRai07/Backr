'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { ethers } from 'ethers';
import { switchToSepolia } from '@/lib/contracts';

interface WalletContextType {
  address: string | null;
  ensName: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  isInitialized: boolean;
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
  const [isInitialized, setIsInitialized] = useState(false);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);

  // Initialize provider and check for existing connection
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setIsInitialized(true);
      return;
    }

    const _provider = new ethers.BrowserProvider(window.ethereum);
    setProvider(_provider);

    const hasConnectedBefore = localStorage.getItem('backr_wallet_connected') === 'true';

    if (hasConnectedBefore) {
      _provider.listAccounts().then(async (accounts) => {
        if (accounts.length > 0) {
          const account = accounts[0];
          const addr = await account.getAddress();
          setAddress(addr);
          setSigner(account);

          // Get chain and balance
          const network = await _provider.getNetwork();
          setChainId(Number(network.chainId));
          const bal = await _provider.getBalance(addr);
          setBalance(ethers.formatEther(bal));
        }
        setIsInitialized(true);
      }).catch(() => {
        setIsInitialized(true);
      });
    } else {
      setIsInitialized(true);
    }

    // Listen for account changes
    const handleAccountsChanged = async (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (accounts && accounts.length > 0) {
        const newAddr = accounts[0];
        setAddress(newAddr);
        localStorage.setItem('backr_wallet_connected', 'true');

        // Update signer and balance
        if (_provider) {
          try {
            const newSigner = await _provider.getSigner();
            setSigner(newSigner);
            const bal = await _provider.getBalance(newAddr);
            setBalance(ethers.formatEther(bal));
          } catch (e) {
            console.error('Error updating account:', e);
          }
        }
      } else {
        setAddress(null);
        setSigner(null);
        setBalance(null);
        localStorage.removeItem('backr_wallet_connected');
      }
    };

    const handleChainChanged = async () => {
      // Reload provider on chain change
      const newProvider = new ethers.BrowserProvider(window.ethereum!);
      setProvider(newProvider);
      
      const network = await newProvider.getNetwork();
      setChainId(Number(network.chainId));

      if (address) {
        const bal = await newProvider.getBalance(address);
        setBalance(ethers.formatEther(bal));
        const newSigner = await newProvider.getSigner();
        setSigner(newSigner);
      }
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [address]);

  const connect = useCallback(async () => {
    if (!provider || !window.ethereum) {
      alert('Please install MetaMask or another Web3 wallet');
      return;
    }

    setIsConnecting(true);
    try {
      // This opens the account selection dialog in MetaMask
      await provider.send('wallet_requestPermissions', [{ eth_accounts: {} }]);

      // Get the selected account
      const signer = await provider.getSigner();
      const selectedAddress = await signer.getAddress();

      setAddress(selectedAddress);
      setSigner(signer);
      localStorage.setItem('backr_wallet_connected', 'true');

      // Switch to Sepolia
      await switchToSepolia(window.ethereum);

      // Update chain and balance
      const network = await provider.getNetwork();
      setChainId(Number(network.chainId));
      const bal = await provider.getBalance(selectedAddress);
      setBalance(ethers.formatEther(bal));

    } catch (error: any) {
      if (error.code === 4001) {
        console.log('User rejected account selection');
      } else {
        console.error('Connection failed:', error);
      }
    } finally {
      setIsConnecting(false);
    }
  }, [provider]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setSigner(null);
    setChainId(null);
    setBalance(null);
    setEnsName(null);
    localStorage.removeItem('backr_wallet_connected');
  }, []);

  const switchNetwork = useCallback(async () => {
    if (!window.ethereum) return;
    await switchToSepolia(window.ethereum);
    
    if (provider && address) {
      const network = await provider.getNetwork();
      setChainId(Number(network.chainId));
    }
  }, [provider, address]);

  return (
    <WalletContext.Provider
      value={{
        address,
        ensName,
        isConnected: !!address,
        isConnecting,
        isInitialized,
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
