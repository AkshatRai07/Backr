import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import 'dotenv/config';

// ============================================
// Contract ABIs (minimal)
// ============================================

const ENS_COLLATERAL_ABI = parseAbi([
    'function markDefault(address user) external',
    'function clearDefault(address user) external',
    'function hasStakedENS(address user) external view returns (bool)',
    'function isInDefault(address user) external view returns (bool)',
    'function canBeSlashed(address user) external view returns (bool)',
    'function timeUntilSlashable(address user) external view returns (uint256)',
]);

const ENS_REPUTATION_ABI = parseAbi([
    'function markDefault(address user) external',
    'function clearDefault(address user) external',
    'function updateCreditScore(address user, uint256 newScore) external',
    'function isRegistered(address user) external view returns (bool)',
    'function getCreditScore(address user) external view returns (uint256)',
    'function getDefaultCount(address user) external view returns (uint256)',
    'function isCurrentlyDefaulted(address user) external view returns (bool)',
]);

// ============================================
// Configuration
// ============================================

const ENS_COLLATERAL_ADDRESS = process.env.ENS_COLLATERAL_ADDRESS as `0x${string}` | undefined;
const ENS_REPUTATION_ADDRESS = process.env.ENS_REPUTATION_ADDRESS as `0x${string}` | undefined;
const ORACLE_PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY as `0x${string}` | undefined;

// Create clients
const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(process.env.ALCHEMY_RPC_URL || 'https://1rpc.io/sepolia'),
});

let walletClient: ReturnType<typeof createWalletClient> | null = null;
let oracleAccount: ReturnType<typeof privateKeyToAccount> | null = null;

if (ORACLE_PRIVATE_KEY) {
    oracleAccount = privateKeyToAccount(ORACLE_PRIVATE_KEY);
    walletClient = createWalletClient({
        account: oracleAccount,
        chain: sepolia,
        transport: http(process.env.ALCHEMY_RPC_URL || 'https://1rpc.io/sepolia'),
    });
}

// ============================================
// Contract Service Class
// ============================================

export class ContractService {
    /**
     * Check if contracts are configured
     */
    static isConfigured(): boolean {
        return !!(ENS_COLLATERAL_ADDRESS || ENS_REPUTATION_ADDRESS) && !!walletClient;
    }

    /**
     * Check if user has staked ENS (hard collateral)
     */
    static async hasStakedENS(userAddress: string): Promise<boolean> {
        if (!ENS_COLLATERAL_ADDRESS) return false;
        
        try {
            const result = await publicClient.readContract({
                address: ENS_COLLATERAL_ADDRESS,
                abi: ENS_COLLATERAL_ABI,
                functionName: 'hasStakedENS',
                args: [userAddress as `0x${string}`],
            });
            return result as boolean;
        } catch (e) {
            console.error('Error checking staked ENS:', e);
            return false;
        }
    }

    /**
     * Check if user is registered in reputation system
     */
    static async isRegisteredReputation(userAddress: string): Promise<boolean> {
        if (!ENS_REPUTATION_ADDRESS) return false;
        
        try {
            const result = await publicClient.readContract({
                address: ENS_REPUTATION_ADDRESS,
                abi: ENS_REPUTATION_ABI,
                functionName: 'isRegistered',
                args: [userAddress as `0x${string}`],
            });
            return result as boolean;
        } catch (e) {
            console.error('Error checking reputation registration:', e);
            return false;
        }
    }

    /**
     * Get on-chain credit score from reputation contract
     */
    static async getOnChainCreditScore(userAddress: string): Promise<number | null> {
        if (!ENS_REPUTATION_ADDRESS) return null;
        
        try {
            const result = await publicClient.readContract({
                address: ENS_REPUTATION_ADDRESS,
                abi: ENS_REPUTATION_ABI,
                functionName: 'getCreditScore',
                args: [userAddress as `0x${string}`],
            });
            return Number(result);
        } catch (e) {
            console.error('Error getting on-chain credit score:', e);
            return null;
        }
    }

    /**
     * Mark a user as defaulted on-chain (updates ENS text records or locks collateral)
     */
    static async markDefaultOnChain(userAddress: string): Promise<{ collateral: boolean; reputation: boolean }> {
        const results = { collateral: false, reputation: false };
        
        if (!walletClient) {
            console.warn('No wallet client configured for contract interactions');
            return results;
        }

        // Mark default on collateral contract
        if (ENS_COLLATERAL_ADDRESS && oracleAccount) {
            try {
                const hasStaked = await this.hasStakedENS(userAddress);
                if (hasStaked) {
                    const hash = await walletClient.writeContract({
                        account: oracleAccount,
                        chain: sepolia,
                        address: ENS_COLLATERAL_ADDRESS,
                        abi: ENS_COLLATERAL_ABI,
                        functionName: 'markDefault',
                        args: [userAddress as `0x${string}`],
                    });
                    await publicClient.waitForTransactionReceipt({ hash });
                    results.collateral = true;
                    console.log(`[Contract] Marked default on collateral for ${userAddress.slice(0, 8)}...`);
                }
            } catch (e) {
                console.error('Error marking default on collateral:', e);
            }
        }

        // Mark default on reputation contract
        if (ENS_REPUTATION_ADDRESS && oracleAccount) {
            try {
                const isRegistered = await this.isRegisteredReputation(userAddress);
                if (isRegistered) {
                    const hash = await walletClient.writeContract({
                        account: oracleAccount,
                        chain: sepolia,
                        address: ENS_REPUTATION_ADDRESS,
                        abi: ENS_REPUTATION_ABI,
                        functionName: 'markDefault',
                        args: [userAddress as `0x${string}`],
                    });
                    await publicClient.waitForTransactionReceipt({ hash });
                    results.reputation = true;
                    console.log(`[Contract] Marked default on reputation for ${userAddress.slice(0, 8)}...`);
                }
            } catch (e) {
                console.error('Error marking default on reputation:', e);
            }
        }

        return results;
    }

    /**
     * Clear a user's default status on-chain (after repayment)
     */
    static async clearDefaultOnChain(userAddress: string): Promise<{ collateral: boolean; reputation: boolean }> {
        const results = { collateral: false, reputation: false };
        
        if (!walletClient || !oracleAccount) return results;

        // Clear on collateral contract
        if (ENS_COLLATERAL_ADDRESS) {
            try {
                const hash = await walletClient.writeContract({
                    account: oracleAccount,
                    chain: sepolia,
                    address: ENS_COLLATERAL_ADDRESS,
                    abi: ENS_COLLATERAL_ABI,
                    functionName: 'clearDefault',
                    args: [userAddress as `0x${string}`],
                });
                await publicClient.waitForTransactionReceipt({ hash });
                results.collateral = true;
                console.log(`[Contract] Cleared default on collateral for ${userAddress.slice(0, 8)}...`);
            } catch (e) {
                // May fail if not staked or not defaulted - that's ok
            }
        }

        // Clear on reputation contract
        if (ENS_REPUTATION_ADDRESS) {
            try {
                const hash = await walletClient.writeContract({
                    account: oracleAccount,
                    chain: sepolia,
                    address: ENS_REPUTATION_ADDRESS,
                    abi: ENS_REPUTATION_ABI,
                    functionName: 'clearDefault',
                    args: [userAddress as `0x${string}`],
                });
                await publicClient.waitForTransactionReceipt({ hash });
                results.reputation = true;
                console.log(`[Contract] Cleared default on reputation for ${userAddress.slice(0, 8)}...`);
            } catch (e) {
                // May fail if not registered or not defaulted - that's ok
            }
        }

        return results;
    }

    /**
     * Update credit score on-chain (reputation contract)
     */
    static async updateCreditScoreOnChain(userAddress: string, newScore: number): Promise<boolean> {
        if (!ENS_REPUTATION_ADDRESS || !walletClient || !oracleAccount) return false;

        try {
            const isRegistered = await this.isRegisteredReputation(userAddress);
            if (!isRegistered) return false;

            const hash = await walletClient.writeContract({
                account: oracleAccount,
                chain: sepolia,
                address: ENS_REPUTATION_ADDRESS,
                abi: ENS_REPUTATION_ABI,
                functionName: 'updateCreditScore',
                args: [userAddress as `0x${string}`, BigInt(newScore)],
            });
            await publicClient.waitForTransactionReceipt({ hash });
            console.log(`[Contract] Updated on-chain credit score for ${userAddress.slice(0, 8)}... to ${newScore}`);
            return true;
        } catch (e) {
            console.error('Error updating on-chain credit score:', e);
            return false;
        }
    }

    /**
     * Get full on-chain status for a user
     */
    static async getOnChainStatus(userAddress: string): Promise<{
        hasStakedENS: boolean;
        isRegisteredReputation: boolean;
        onChainScore: number | null;
        isDefaulted: boolean;
        canBeSlashed: boolean;
        timeUntilSlashable: number | null;
    }> {
        const status = {
            hasStakedENS: false,
            isRegisteredReputation: false,
            onChainScore: null as number | null,
            isDefaulted: false,
            canBeSlashed: false,
            timeUntilSlashable: null as number | null,
        };

        // Check collateral status
        if (ENS_COLLATERAL_ADDRESS) {
            try {
                status.hasStakedENS = await this.hasStakedENS(userAddress);
                if (status.hasStakedENS) {
                    const isDefault = await publicClient.readContract({
                        address: ENS_COLLATERAL_ADDRESS,
                        abi: ENS_COLLATERAL_ABI,
                        functionName: 'isInDefault',
                        args: [userAddress as `0x${string}`],
                    });
                    status.isDefaulted = isDefault as boolean;

                    const canSlash = await publicClient.readContract({
                        address: ENS_COLLATERAL_ADDRESS,
                        abi: ENS_COLLATERAL_ABI,
                        functionName: 'canBeSlashed',
                        args: [userAddress as `0x${string}`],
                    });
                    status.canBeSlashed = canSlash as boolean;

                    const timeUntil = await publicClient.readContract({
                        address: ENS_COLLATERAL_ADDRESS,
                        abi: ENS_COLLATERAL_ABI,
                        functionName: 'timeUntilSlashable',
                        args: [userAddress as `0x${string}`],
                    });
                    status.timeUntilSlashable = Number(timeUntil);
                }
            } catch (e) {
                console.error('Error getting collateral status:', e);
            }
        }

        // Check reputation status
        if (ENS_REPUTATION_ADDRESS) {
            try {
                status.isRegisteredReputation = await this.isRegisteredReputation(userAddress);
                if (status.isRegisteredReputation) {
                    status.onChainScore = await this.getOnChainCreditScore(userAddress);
                    
                    const isDefault = await publicClient.readContract({
                        address: ENS_REPUTATION_ADDRESS,
                        abi: ENS_REPUTATION_ABI,
                        functionName: 'isCurrentlyDefaulted',
                        args: [userAddress as `0x${string}`],
                    });
                    if (!status.isDefaulted) {
                        status.isDefaulted = isDefault as boolean;
                    }
                }
            } catch (e) {
                console.error('Error getting reputation status:', e);
            }
        }

        return status;
    }
}
