import { ethers } from 'ethers';
import BackrENSCollateralABI from '@/abi/BackrENSCollateral.json';
import BackrENSReputationABI from '@/abi/BackrENSReputation.json';

// Contract addresses - update these after deployment
export const CONTRACTS = {
  ENS_COLLATERAL: process.env.NEXT_PUBLIC_ENS_COLLATERAL_ADDRESS || '',
  ENS_REPUTATION: process.env.NEXT_PUBLIC_ENS_REPUTATION_ADDRESS || '',
  ENS_REGISTRY: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
  ENS_REGISTRAR: '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85', // ENS BaseRegistrar
};

// Sepolia chain configuration
export const SEPOLIA_CHAIN = {
  chainId: '0xaa36a7', // 11155111 in hex
  chainName: 'Sepolia',
  nativeCurrency: {
    name: 'Sepolia ETH',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['https://rpc.sepolia.org'],
  blockExplorerUrls: ['https://sepolia.etherscan.io'],
};

// Get provider (browser or fallback)
export function getProvider(): ethers.BrowserProvider | null {
  if (typeof window !== 'undefined' && window.ethereum) {
    return new ethers.BrowserProvider(window.ethereum);
  }
  return null;
}

// Get read-only provider
export function getReadOnlyProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(
    process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.sepolia.org'
  );
}

// Contract instances (read-only)
export function getCollateralContract(
  signerOrProvider?: ethers.Signer | ethers.Provider
): ethers.Contract | null {
  if (!CONTRACTS.ENS_COLLATERAL) return null;
  const provider = signerOrProvider || getReadOnlyProvider();
  return new ethers.Contract(
    CONTRACTS.ENS_COLLATERAL,
    BackrENSCollateralABI.abi,
    provider
  );
}

export function getReputationContract(
  signerOrProvider?: ethers.Signer | ethers.Provider
): ethers.Contract | null {
  if (!CONTRACTS.ENS_REPUTATION) return null;
  const provider = signerOrProvider || getReadOnlyProvider();
  return new ethers.Contract(
    CONTRACTS.ENS_REPUTATION,
    BackrENSReputationABI.abi,
    provider
  );
}

// ENS Registrar (for staking ENS NFTs)
const ENS_REGISTRAR_ABI = [
  'function approve(address to, uint256 tokenId) external',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function getApproved(uint256 tokenId) external view returns (address)',
  'function isApprovedForAll(address owner, address operator) external view returns (bool)',
];

export function getENSRegistrarContract(
  signerOrProvider?: ethers.Signer | ethers.Provider
): ethers.Contract {
  const provider = signerOrProvider || getReadOnlyProvider();
  return new ethers.Contract(CONTRACTS.ENS_REGISTRAR, ENS_REGISTRAR_ABI, provider);
}

// ENS Registry (for reputation system approval)
const ENS_REGISTRY_ABI = [
  'function setApprovalForAll(address operator, bool approved) external',
  'function isApprovedForAll(address owner, address operator) external view returns (bool)',
  'function owner(bytes32 node) external view returns (address)',
];

export function getENSRegistryContract(
  signerOrProvider?: ethers.Signer | ethers.Provider
): ethers.Contract {
  const provider = signerOrProvider || getReadOnlyProvider();
  return new ethers.Contract(CONTRACTS.ENS_REGISTRY, ENS_REGISTRY_ABI, provider);
}

// Helper: Calculate ENS token ID (labelhash)
export function getENSTokenId(ensName: string): bigint {
  // Remove .eth suffix if present
  const label = ensName.replace('.eth', '');
  return BigInt(ethers.keccak256(ethers.toUtf8Bytes(label)));
}

// Helper: Calculate namehash for ENS
export function getNamehash(name: string): string {
  return ethers.namehash(name);
}

// Contract interaction functions
export const ContractActions = {
  // Collateral Contract
  async stakeENS(signer: ethers.Signer, tokenId: bigint): Promise<ethers.ContractTransactionResponse> {
    const contract = getCollateralContract(signer);
    if (!contract) throw new Error('Collateral contract not configured');
    return contract.stakeENS(tokenId);
  },

  async unstakeENS(signer: ethers.Signer): Promise<ethers.ContractTransactionResponse> {
    const contract = getCollateralContract(signer);
    if (!contract) throw new Error('Collateral contract not configured');
    return contract.unstakeENS();
  },

  async approveENSForCollateral(signer: ethers.Signer, tokenId: bigint): Promise<ethers.ContractTransactionResponse> {
    const ensRegistrar = getENSRegistrarContract(signer);
    return ensRegistrar.approve(CONTRACTS.ENS_COLLATERAL, tokenId);
  },

  async hasStakedENS(address: string): Promise<boolean> {
    const contract = getCollateralContract();
    if (!contract) return false;
    return contract.hasStakedENS(address);
  },

  async getStakedENSInfo(address: string): Promise<{
    owner: string;
    tokenId: bigint;
    stakedAt: bigint;
    isDefaulted: boolean;
    defaultedAt: bigint;
  } | null> {
    const contract = getCollateralContract();
    if (!contract) return null;
    const result = await contract.stakedENS(address);
    if (result.tokenId === BigInt(0)) return null;
    return {
      owner: result.owner,
      tokenId: result.tokenId,
      stakedAt: result.stakedAt,
      isDefaulted: result.isDefaulted,
      defaultedAt: result.defaultedAt,
    };
  },

  async canBeSlashed(address: string): Promise<boolean> {
    const contract = getCollateralContract();
    if (!contract) return false;
    return contract.canBeSlashed(address);
  },

  async timeUntilSlashable(address: string): Promise<bigint> {
    const contract = getCollateralContract();
    if (!contract) return BigInt(0);
    return contract.timeUntilSlashable(address);
  },

  // Reputation Contract
  async registerENS(signer: ethers.Signer, ensName: string): Promise<ethers.ContractTransactionResponse> {
    const contract = getReputationContract(signer);
    if (!contract) throw new Error('Reputation contract not configured');
    const namehash = getNamehash(ensName);
    return contract.registerENS(namehash);
  },

  async approveBackrForReputation(signer: ethers.Signer): Promise<ethers.ContractTransactionResponse> {
    const ensRegistry = getENSRegistryContract(signer);
    return ensRegistry.setApprovalForAll(CONTRACTS.ENS_REPUTATION, true);
  },

  async isRegisteredReputation(address: string): Promise<boolean> {
    const contract = getReputationContract();
    if (!contract) return false;
    return contract.isRegistered(address);
  },

  async getOnChainCreditScore(address: string): Promise<number> {
    const contract = getReputationContract();
    if (!contract) return 0;
    const score = await contract.getCreditScore(address);
    return Number(score);
  },

  async getDefaultCount(address: string): Promise<number> {
    const contract = getReputationContract();
    if (!contract) return 0;
    const count = await contract.getDefaultCount(address);
    return Number(count);
  },

  async isCurrentlyDefaulted(address: string): Promise<boolean> {
    const contract = getReputationContract();
    if (!contract) return false;
    return contract.isCurrentlyDefaulted(address);
  },
};

// Switch to Sepolia network
export async function switchToSepolia(): Promise<void> {
  if (!window.ethereum) throw new Error('No wallet found');

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: SEPOLIA_CHAIN.chainId }],
    });
  } catch (switchError: unknown) {
    // Chain not added, add it
    if ((switchError as { code: number }).code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [SEPOLIA_CHAIN],
      });
    } else {
      throw switchError;
    }
  }
}

// Declare window.ethereum type
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}
