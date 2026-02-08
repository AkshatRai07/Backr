import {
    NitroliteClient,
    WalletStateSigner,
    createECDSAMessageSigner,
    createEIP712AuthMessageSigner,
    createAuthRequestMessage,
    createAuthVerifyMessageFromChallenge,
    createTransferMessage,
    createGetLedgerBalancesMessage,
} from '@erc7824/nitrolite';
import { createPublicClient, createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import WebSocket from 'ws';
import 'dotenv/config';

export interface TransferData {
    id: string;
    amount: bigint;
    asset: string;
    sender?: string;
    raw: any;
}

export class BankClient {
    private ws: WebSocket | null = null;
    private client: NitroliteClient;
    private sessionSigner: ReturnType<typeof createECDSAMessageSigner>;
    private sessionPrivateKey: `0x${string}`;
    private walletClient: any;
    private account: ReturnType<typeof privateKeyToAccount>;
    private publicClient: any;
    private isAuthenticated = false;
    private transferCallback: ((transfer: TransferData) => Promise<void>) | null = null;
    private authParams: any;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 3000;

    constructor(sessionPrivateKey: `0x${string}`) {
        this.sessionPrivateKey = sessionPrivateKey;
        this.account = privateKeyToAccount(sessionPrivateKey);
        
        // Base Sepolia RPC for Yellow Nitrolite settlement
        const BASE_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

        this.publicClient = createPublicClient({ chain: baseSepolia, transport: http(BASE_RPC_URL) });
        this.walletClient = createWalletClient({ 
            chain: baseSepolia, 
            transport: http(BASE_RPC_URL), 
            account: this.account 
        });

        this.client = new NitroliteClient({
            publicClient: this.publicClient,
            walletClient: this.walletClient,
            stateSigner: new WalletStateSigner(this.walletClient),
            addresses: {
                custody: process.env.YELLOW_CUSTODY_ADDRESS as `0x${string}` || '0x019B65A265EB3363822f2752141b3dF16131b262',
                adjudicator: process.env.YELLOW_ADJUDICATOR_ADDRESS as `0x${string}`|| '0x7c7ccbc98469190849BCC6c926307794fDfB11F2',
            },
            chainId: baseSepolia.id,
            challengeDuration: 3600n,
        });

        this.sessionSigner = createECDSAMessageSigner(sessionPrivateKey);
        
        // Pre-calculate auth params (consistent across auth flow)
        this.authParams = {
            session_key: this.account.address,
            allowances: [{ asset: 'ytest.usd', amount: '1000000000' }],
            expires_at: BigInt(Math.floor(Date.now() / 1000) + 86400), // 24 hours
            scope: 'backr.app',
        };
    }

    get address(): string {
        return this.account.address;
    }

    /**
     * Initializes connection, runs the Auth Handshake, and starts listening.
     */
    async init(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.ws = new WebSocket('wss://clearnet-sandbox.yellow.com/ws');
            
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 30000);

            this.ws.on('open', async () => {
                console.log(`✓ [${this.account.address.slice(0, 8)}...] Connected to Yellow Network`);
                try {
                    await this.startAuthFlow();
                } catch (err) {
                    clearTimeout(timeout);
                    reject(err);
                }
            });

            this.ws.on('message', async (data) => {
                try {
                    const wasAuthenticated = this.isAuthenticated;
                    await this.handleMessage(data);
                    
                    // Resolve once authenticated
                    if (!wasAuthenticated && this.isAuthenticated) {
                        clearTimeout(timeout);
                        resolve();
                    }
                } catch (err) {
                    console.error(`[${this.account.address.slice(0, 8)}...] Message handling error:`, err);
                }
            });

            this.ws.on('error', (err) => {
                console.error(`[${this.account.address.slice(0, 8)}...] WebSocket error:`, err);
                clearTimeout(timeout);
                reject(err);
            });

            this.ws.on('close', () => {
                console.log(`[${this.account.address.slice(0, 8)}...] WebSocket closed`);
                this.isAuthenticated = false;
                this.attemptReconnect();
            });
        });
    }

    /**
     * Attempt to reconnect with exponential backoff
     */
    private async attemptReconnect(): Promise<void> {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error(`[${this.account.address.slice(0, 8)}...] Max reconnect attempts reached`);
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        
        console.log(`[${this.account.address.slice(0, 8)}...] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        await new Promise(r => setTimeout(r, delay));
        
        try {
            await this.init();
            this.reconnectAttempts = 0; // Reset on successful reconnect
            console.log(`✓ [${this.account.address.slice(0, 8)}...] Reconnected successfully`);
        } catch (err) {
            console.error(`[${this.account.address.slice(0, 8)}...] Reconnect failed:`, err);
        }
    }

    /**
     * Disconnect and cleanup
     */
    disconnect(): void {
        this.maxReconnectAttempts = 0; // Prevent reconnection
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isAuthenticated = false;
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
        if (!this.isAuthenticated) throw new Error("Client not authenticated");
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error("WebSocket not connected");
        }

        console.log(`[${this.account.address.slice(0, 8)}...] Sending ${amount} USDC to ${recipient.slice(0, 8)}...`);

        const transferMsg = await createTransferMessage(
            this.sessionSigner,
            {
                destination: recipient as `0x${string}`,
                allocations: [{
                    asset: 'ytest.usd',
                    amount: amount.toString()
                }]
            },
            Date.now()
        );
        this.ws.send(transferMsg);
    }

    /**
     * Accepts an incoming transfer (Acknowledges the state update).
     */
    async acceptTransfer(transferData: TransferData): Promise<boolean> {
        console.log(`✓ [${this.account.address.slice(0, 8)}...] Accepting transfer ID: ${transferData.id}`);
        // In Nitrolite's state channel model, receiving is handled by state sync.
        // The callback being called means we've received the state update.
        // Additional acknowledgment could be added here if the protocol requires it.
        return true;
    }

    /**
     * Get current balance (query ledger)
     */
    async getBalance(): Promise<void> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error("WebSocket not connected");
        }
        
        const ledgerMsg = await createGetLedgerBalancesMessage(
            this.sessionSigner,
            this.account.address,
            Date.now()
        );
        this.ws.send(ledgerMsg);
    }

    /**
     * Check if client is connected and authenticated
     */
    isReady(): boolean {
        return this.isAuthenticated && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }

    /**
     * Internal: Handles the complex Auth Loop (Request -> Challenge -> Verify)
     */
    private async startAuthFlow(): Promise<void> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error("WebSocket not connected");
        }

        const authRequestMsg = await createAuthRequestMessage({
            address: this.account.address,
            application: 'Backr',
            ...this.authParams
        });

        this.ws.send(authRequestMsg);
    }

    /**
     * Internal: Message Router
     */
    private async handleMessage(data: any): Promise<void> {
        const response = JSON.parse(data.toString());

        if (response.error) {
            console.error(`[${this.account.address.slice(0, 8)}...] RPC Error:`, response.error);
            return;
        }

        if (!response.res) return;

        const type = response.res[1];
        const payload = response.res[2];

        // 1. Auth Challenge -> Verify
        if (type === 'auth_challenge') {
            const challenge = payload.challenge_message;
            
            // Use same authParams for consistency
            const signer = createEIP712AuthMessageSigner(
                this.walletClient, 
                this.authParams, 
                { name: 'Backr' }
            );
            const verifyMsg = await createAuthVerifyMessageFromChallenge(signer, challenge);
            this.ws!.send(verifyMsg);
        }

        // 2. Auth Success
        if (type === 'auth_verify') {
            console.log(`✓ [${this.account.address.slice(0, 8)}...] Authenticated successfully`);
            this.isAuthenticated = true;
            
            // Sync Initial State
            const ledgerMsg = await createGetLedgerBalancesMessage(
                this.sessionSigner,
                this.account.address,
                Date.now()
            );
            this.ws!.send(ledgerMsg);
        }

        // 3. Ledger Balances Response
        if (type === 'get_ledger_balances' || type === 'ledger_balances') {
            console.log(`[${this.account.address.slice(0, 8)}...] Ledger balances:`, JSON.stringify(payload, null, 2));
        }

        // 4. Incoming Transfer Listener
        if (type === 'transfer' || type === 'update_channel' || type === 'channel_update') {
            // Check if WE are the receiver
            const allocations = payload.allocations || payload.state?.allocations || [];
            const isIncoming = allocations.some((a: any) => 
                a.destination?.toLowerCase() === this.account.address.toLowerCase()
            );
            
            if (isIncoming && this.transferCallback) {
                const incomingAlloc = allocations.find((a: any) => 
                    a.destination?.toLowerCase() === this.account.address.toLowerCase()
                );
                
                const transferData: TransferData = {
                    id: payload.channel_id || payload.id || `tx_${Date.now()}`,
                    amount: BigInt(incomingAlloc?.amount || 0),
                    asset: incomingAlloc?.asset || 'ytest.usd',
                    sender: payload.sender || payload.source,
                    raw: payload
                };
                
                await this.transferCallback(transferData);
            }
        }

        // 5. Transfer confirmation (outgoing)
        if (type === 'transfer' && payload.status === 'success') {
            console.log(`✓ [${this.account.address.slice(0, 8)}...] Transfer confirmed`);
        }
    }
}
