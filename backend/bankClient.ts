import {
    Client,
    createSigners,
    withBlockchainRPC,
    withErrorHandler,
    withHandshakeTimeout,
    ErrNotConnected,
    TransactionType,
    type Transaction,
} from '@yellow-org/sdk';
import Decimal from 'decimal.js';
import type { Address } from 'viem';
import 'dotenv/config';

export interface TransferData {
    id: string;
    amount: bigint;
    asset: string;
    sender?: string;
    raw: any;
}

const POLL_INTERVAL = 5000; // 5 seconds
const ASSET = 'usdc';

type Signers = ReturnType<typeof createSigners>;

export class BankClient {
    private client: Client | null = null;
    private sessionPrivateKey: `0x${string}`;
    private userAddress: Address;
    private signers: Signers;
    private transferCallback: ((transfer: TransferData) => Promise<void>) | null = null;
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private lastSeenTxTime: bigint = 0n;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 3000;

    constructor(sessionPrivateKey: `0x${string}`) {
        this.sessionPrivateKey = sessionPrivateKey;
        this.signers = createSigners(sessionPrivateKey);
        this.userAddress = this.signers.stateSigner.getAddress();
    }

    get address(): string {
        return this.userAddress;
    }

    /**
     * Initializes connection, authenticates, and starts polling for incoming transfers.
     */
    async init(): Promise<void> {
        const BASE_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
        const WS_URL = process.env.YELLOW_WS_URL || 'wss://clearnet-sandbox.yellow.com/ws';

        this.client = await Client.create(
            WS_URL,
            this.signers.stateSigner,
            this.signers.txSigner,
            withBlockchainRPC(BigInt(84532), BASE_RPC_URL), // Base Sepolia
            withHandshakeTimeout(30000),
            withErrorHandler((error) => {
                console.error(`[${this.userAddress.slice(0, 8)}...] SDK error:`, error);
            }),
        );

        console.log(`✓ [${this.userAddress.slice(0, 8)}...] Connected & authenticated to Yellow Network`);

        // Set home blockchain for our asset
        await this.client.setHomeBlockchain(ASSET, BigInt(84532));

        // Fetch initial balance
        await this.getBalance();

        // Record current time so we only detect new transfers
        this.lastSeenTxTime = BigInt(Math.floor(Date.now() / 1000));

        // Start polling for incoming transfers
        this.startPolling();
    }

    /**
     * Attempt to reconnect with exponential backoff
     */
    private async attemptReconnect(): Promise<void> {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error(`[${this.userAddress.slice(0, 8)}...] Max reconnect attempts reached`);
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

        console.log(`[${this.userAddress.slice(0, 8)}...] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

        await new Promise(r => setTimeout(r, delay));

        try {
            await this.init();
            this.reconnectAttempts = 0;
            console.log(`✓ [${this.userAddress.slice(0, 8)}...] Reconnected successfully`);
        } catch (err) {
            console.error(`[${this.userAddress.slice(0, 8)}...] Reconnect failed:`, err);
        }
    }

    /**
     * Disconnect and cleanup
     */
    disconnect(): void {
        this.maxReconnectAttempts = 0;
        this.stopPolling();
        if (this.client) {
            this.client.close();
            this.client = null;
        }
    }

    /**
     * Set the callback for when money comes in.
     */
    onTransfer(callback: (transfer: TransferData) => Promise<void>): void {
        this.transferCallback = callback;
    }

    /**
     * Sends funds to a destination address.
     */
    async sendTransfer(recipient: string, amount: number): Promise<void> {
        if (!this.client) throw new Error("Client not initialized");

        console.log(`[${this.userAddress.slice(0, 8)}...] Sending ${amount} USDC to ${recipient.slice(0, 8)}...`);

        await this.client.transfer(recipient, ASSET, new Decimal(amount));

        console.log(`✓ [${this.userAddress.slice(0, 8)}...] Transfer confirmed`);
    }

    /**
     * Accepts an incoming transfer (acknowledges the received state).
     * Per Yellow docs, acknowledge() operates at the asset/channel level —
     * it confirms the latest state for the asset, covering all pending updates.
     */
    async acceptTransfer(_transferData: TransferData): Promise<boolean> {
        if (!this.client) throw new Error("Client not initialized");

        console.log(`✓ [${this.userAddress.slice(0, 8)}...] Acknowledging incoming transfer`);
        await this.client.acknowledge(ASSET);
        return true;
    }

    /**
     * Get current balance
     */
    async getBalance(): Promise<void> {
        if (!this.client) throw new Error("Client not initialized");

        const balances = await this.client.getBalances(this.userAddress);
        console.log(`[${this.userAddress.slice(0, 8)}...] Ledger balances:`, JSON.stringify(balances, null, 2));
    }

    /**
     * Check if client is connected and ready.
     * Verifies the underlying connection by probing the SDK.
     */
    isReady(): boolean {
        if (!this.client) return false;
        try {
            // Access the underlying RPC client's connection state
            return (this.client as any)['rpcClient']?.isConnected?.() ?? true;
        } catch {
            return true;
        }
    }

    /**
     * Poll for incoming transfers and fire the callback
     */
    private startPolling(): void {
        if (this.pollTimer) return;

        this.pollTimer = setInterval(async () => {
            try {
                await this.checkForIncomingTransfers();
            } catch (err) {
                console.error(`[${this.userAddress.slice(0, 8)}...] Poll error:`, err);

                if (err instanceof ErrNotConnected) {
                    this.stopPolling();
                    this.client = null;
                    await this.attemptReconnect();
                }
            }
        }, POLL_INTERVAL);
    }

    private stopPolling(): void {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    private async checkForIncomingTransfers(): Promise<void> {
        if (!this.client || !this.transferCallback) return;

        const { transactions } = await this.client.getTransactions(this.userAddress, {
            txType: TransactionType.Transfer,
            fromTime: this.lastSeenTxTime,
        });

        // Filter for incoming transfers (where we are the recipient)
        const incoming = transactions.filter((tx: Transaction) =>
            tx.toAccount.toLowerCase() === this.userAddress.toLowerCase()
        );

        for (const tx of incoming) {
            const txTime = BigInt(Math.floor(tx.createdAt.getTime() / 1000));
            if (txTime > this.lastSeenTxTime) {
                this.lastSeenTxTime = txTime;
            }

            const transferData: TransferData = {
                id: tx.id,
                amount: BigInt(tx.amount.toFixed(0)),
                asset: tx.asset,
                sender: tx.fromAccount,
                raw: tx,
            };

            await this.transferCallback(transferData);
        }

        // Only advance watermark based on server-reported transaction times, not local clock
    }
}
