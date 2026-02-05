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
import { sepolia } from 'viem/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import WebSocket from 'ws';
import 'dotenv/config';

export class BankClient {
    private ws: WebSocket;
    private client: NitroliteClient;
    private sessionSigner: any;
    private walletClient: any;
    private account: any;
    private publicClient: any;
    private isAuthenticated = false;
    private transferCallback: ((transfer: any) => Promise<void>) | null = null;

    constructor() {
        const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
        if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY required in .env');

        this.account = privateKeyToAccount(PRIVATE_KEY);
        const RPC_URL = process.env.ALCHEMY_RPC_URL || 'https://1rpc.io/sepolia';

        this.publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
        this.walletClient = createWalletClient({ chain: sepolia, transport: http(RPC_URL), account: this.account });

        this.client = new NitroliteClient({
            publicClient: this.publicClient,
            walletClient: this.walletClient,
            stateSigner: new WalletStateSigner(this.walletClient),
            addresses: {
                custody: '0x019B65A265EB3363822f2752141b3dF16131b262',
                adjudicator: '0x7c7ccbc98469190849BCC6c926307794fDfB11F2',
            },
            chainId: sepolia.id,
            challengeDuration: 3600n,
        });

        this.ws = new WebSocket('wss://clearnet-sandbox.yellow.com/ws');
        
        // Session Key Generation (Per your sample)
        const sessionPrivateKey = generatePrivateKey();
        this.sessionSigner = createECDSAMessageSigner(sessionPrivateKey);
    }

    /**
     * Initializes connection, runs the Auth Handshake, and starts listening.
     */
    async init() {
        return new Promise<void>((resolve, reject) => {
            this.ws.on('open', async () => {
                console.log('✓ Connected to Yellow Network');
                await this.startAuthFlow();
            });

            this.ws.on('message', async (data) => {
                await this.handleMessage(data);
                // If we are authenticated and ready, resolve the init promise
                if (this.isAuthenticated) resolve(); 
            });

            this.ws.on('error', (err) => reject(err));
        });
    }

    /**
     * Set the callback for when money comes in.
     */
    onTransfer(callback: (transfer: any) => Promise<void>) {
        this.transferCallback = callback;
    }

    /**
     * Sends funds to a destination address.
     */
    async sendTransfer(recipient: string, amount: number) {
        if (!this.isAuthenticated) throw new Error("Client not authenticated");

        console.log(`Sending ${amount} USDC to ${recipient}...`);

        const transferMsg = await createTransferMessage(
            this.sessionSigner,
            {
                destination: recipient as `0x${string}`,
                allocations: [{
                    asset: 'ytest.usd', // Defaulting to test asset
                    amount: amount.toString()
                }]
            },
            Date.now()
        );
        this.ws.send(transferMsg);
    }

    /**
     * Accepts an incoming transfer (Acknowledges the state update).
     * In Nitrolite, receiving is often automatic via state sync, 
     * but we can explicitly log or verify here.
     */
    async acceptTransfer(transferData: any) {
        console.log(`✓ Accepting transfer ID: ${transferData.id}`);
        // In a real channel implementation, you might countersign the new state here.
        // For this hackathon scope, we treat the 'receipt' as acceptance.
        return true;
    }

    /**
     * Internal: Handles the complex Auth Loop (Request -> Challenge -> Verify)
     */
    private async startAuthFlow() {
        const sessionAccount = privateKeyToAccount(this.sessionSigner.privateKey);
        
        const authParams = {
            session_key: sessionAccount.address,
            allowances: [{ asset: 'ytest.usd', amount: '1000000000' }],
            expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600),
            scope: 'test.app',
        };

        const authRequestMsg = await createAuthRequestMessage({
            address: this.account.address,
            application: 'Test app',
            ...authParams
        });

        this.ws.send(authRequestMsg);
    }

    /**
     * Internal: Message Router
     */
    private async handleMessage(data: any) {
        const response = JSON.parse(data.toString());

        if (response.error) {
            console.error('RPC Error:', response.error);
            return;
        }

        if (!response.res) return;

        const type = response.res[1];
        const payload = response.res[2];

        // 1. Auth Challenge -> Verify
        if (type === 'auth_challenge') {
            const challenge = payload.challenge_message;
            // Re-create auth params to sign (Must match startAuthFlow)
            const sessionAccount = privateKeyToAccount(this.sessionSigner.privateKey);
            const authParams = {
                session_key: sessionAccount.address,
                allowances: [{ asset: 'ytest.usd', amount: '1000000000' }],
                expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600),
                scope: 'test.app',
            };
            
            const signer = createEIP712AuthMessageSigner(this.walletClient, authParams, { name: 'Test app' });
            const verifyMsg = await createAuthVerifyMessageFromChallenge(signer, challenge);
            this.ws.send(verifyMsg);
        }

        // 2. Auth Success
        if (type === 'auth_verify') {
            console.log('✓ Authenticated successfully');
            this.isAuthenticated = true;
            
            // Sync Initial State
            const ledgerMsg = await createGetLedgerBalancesMessage(
                this.sessionSigner,
                this.account.address,
                Date.now()
            );
            this.ws.send(ledgerMsg);
        }

        // 3. Incoming Transfer Listener
        // Note: Nitrolite messages vary. We look for 'transfer' or 'update_channel' where we are the destination.
        if (type === 'transfer' || type === 'update_channel') {
            // Check if WE are the receiver
            const isIncoming = payload.allocations?.some((a: any) => a.destination === this.account.address);
            
            if (isIncoming && this.transferCallback) {
                const incomingAmount = payload.allocations.find((a: any) => a.destination === this.account.address)?.amount;
                
                await this.transferCallback({
                    id: payload.channel_id || `tx_${Date.now()}`,
                    amount: BigInt(incomingAmount || 0),
                    asset: 'ytest.usd',
                    raw: payload
                });
            }
        }
    }
}
