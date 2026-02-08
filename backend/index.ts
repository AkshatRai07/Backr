import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { privateKeyToAccount } from 'viem/accounts';
import { BankClient, type TransferData } from './bankClient';
import { ContractService } from './contracts';
import { supabase } from './db';
import { 
    type User, type Vouch, type Debt,
    type CreateVouchRequest, type BorrowRequest, type RepayRequest, type ConnectRequest, type UserSettings,
    CREDIT_SCORE 
} from './types';
import {
    getOrCreateUser,
    updateCreditScore,
    stripENS,
    checkOverdueDebts as checkOverdueDebtsService,
} from './services';
import 'dotenv/config';

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 8000;
const VAULT_ADDRESS = process.env.VAULT_ADDRESS;

// Warn if VAULT_ADDRESS not configured (garnishing won't work)
if (!VAULT_ADDRESS) {
    console.warn('⚠️  VAULT_ADDRESS not set - garnishing/auto-repay will be disabled');
}

// Store active agents in memory (WebSocket connections)
const activeAgents: Record<string, BankClient> = {};

// Run overdue check periodically (every hour)
setInterval(checkOverdueDebtsService, 60 * 60 * 1000);

// ============================================
// AGENT MANAGEMENT ENDPOINTS
// ============================================

/**
 * POST /connect
 * Start a Backr Agent for a specific user
 */
app.post('/connect', async (req: Request, res: Response) => {
    try {
        const { sessionPrivateKey } = req.body as ConnectRequest;

        if (!sessionPrivateKey) {
            return res.status(400).json({ error: "Missing sessionPrivateKey" });
        }

        // Derive the public address from the key
        const account = privateKeyToAccount(sessionPrivateKey as `0x${string}`);
        const userAddress = account.address.toLowerCase();

        // Check if agent is already running
        if (activeAgents[userAddress]?.isReady()) {
            console.log(`[Server] Agent already active for ${userAddress.slice(0, 8)}...`);
            return res.status(200).json({ status: "Agent already running", address: userAddress });
        }

        console.log(`[Server] Starting new Backr Agent for: ${userAddress.slice(0, 8)}...`);

        // Ensure user exists in DB
        const user = await getOrCreateUser(userAddress);
        if (!user) {
            return res.status(500).json({ error: "Failed to create user" });
        }

        // Initialize the BankClient
        const bank = new BankClient(sessionPrivateKey as `0x${string}`);
        await bank.init();

        // Define the Garnishing Logic
        bank.onTransfer(async (transfer: TransferData) => {
            console.log(`\n[${userAddress.slice(0, 8)}...] Incoming Transfer: ${transfer.amount}`);

            // Get user settings
            const { data: currentUser } = await supabase
                .from('users')
                .select('garnish_percentage, auto_repay_enabled')
                .eq('wallet_address', userAddress)
                .single();

            // Check if auto-repay is enabled
            if (!currentUser?.auto_repay_enabled) {
                console.log(`[${userAddress.slice(0, 8)}...] Auto-repay disabled. Accepting full amount.`);
                await bank.acceptTransfer(transfer);
                return;
            }

            // Check for active debts
            const { data: debts, error } = await supabase
                .from('debts')
                .select('*')
                .eq('borrower_address', userAddress)
                .in('status', ['active', 'overdue'])
                .order('due_date', { ascending: true }); // Pay oldest first

            if (error || !debts || debts.length === 0) {
                console.log(`[${userAddress.slice(0, 8)}...] No active debt. Accepting full amount.`);
                await bank.acceptTransfer(transfer);
                return;
            }

            const activeDebt = debts[0];
            const garnishPercent = currentUser?.garnish_percentage ?? 50;
            console.log(`[${userAddress.slice(0, 8)}...] OWE: ${activeDebt.amount_owed}. Garnishing ${garnishPercent}%...`);

            // Calculate Split
            const incoming = Number(transfer.amount);
            const garnishAmount = Math.min(
                Math.floor(incoming * (garnishPercent / 100)),
                Number(activeDebt.amount_owed) // Don't overpay
            );
            const remainder = incoming - garnishAmount;

            // Accept the transfer first
            await bank.acceptTransfer(transfer);

            // Pay toward debt
            if (garnishAmount > 0 && VAULT_ADDRESS) {
                console.log(`[${userAddress.slice(0, 8)}...] Sending ${garnishAmount} to Vault...`);
                
                try {
                    await bank.sendTransfer(VAULT_ADDRESS, garnishAmount);

                    // Record payment
                    await supabase
                        .from('payments')
                        .insert({
                            debt_id: activeDebt.id,
                            amount: garnishAmount,
                            payment_type: 'garnish'
                        });

                    // Update debt
                    const newDebtAmount = Math.max(0, Number(activeDebt.amount_owed) - garnishAmount);
                    
                    if (newDebtAmount === 0) {
                        // Debt fully paid
                        await supabase
                            .from('debts')
                            .update({ 
                                amount_owed: 0, 
                                status: 'paid',
                                paid_at: new Date().toISOString()
                            })
                            .eq('id', activeDebt.id);

                        // Update vouch usage
                        if (activeDebt.vouch_id) {
                            const { data: vouch } = await supabase
                                .from('vouches')
                                .select('current_usage')
                                .eq('id', activeDebt.vouch_id)
                                .single();
                            
                            if (vouch) {
                                await supabase
                                    .from('vouches')
                                    .update({ 
                                        current_usage: Math.max(0, vouch.current_usage - activeDebt.original_amount)
                                    })
                                    .eq('id', activeDebt.vouch_id);
                            }
                        }

                        // Bonus for paying off debt
                        const isOnTime = new Date(activeDebt.due_date) >= new Date();
                        if (isOnTime) {
                            await updateCreditScore(
                                userAddress,
                                CREDIT_SCORE.ON_TIME_BONUS,
                                `Paid off debt #${activeDebt.id} on time`
                            );
                        }

                        // Check if user has no more active debts - clear on-chain default
                        const { data: remainingDebts } = await supabase
                            .from('debts')
                            .select('id')
                            .eq('borrower_address', userAddress)
                            .in('status', ['active', 'overdue'])
                            .neq('id', activeDebt.id);
                        
                        if (!remainingDebts || remainingDebts.length === 0) {
                            // No more debts - clear default status
                            if (ContractService.isConfigured()) {
                                await ContractService.clearDefaultOnChain(userAddress);
                            }
                            // Also update DB
                            await supabase
                                .from('users')
                                .update({ ens_stripped: false })
                                .eq('wallet_address', userAddress);
                        }

                        console.log(`[${userAddress.slice(0, 8)}...] Debt #${activeDebt.id} FULLY PAID!`);
                    } else {
                        await supabase
                            .from('debts')
                            .update({ amount_owed: newDebtAmount })
                            .eq('id', activeDebt.id);
                    }
                } catch (transferError) {
                    console.error(`[${userAddress.slice(0, 8)}...] Transfer failed:`, transferError);
                }
            }

            console.log(`[${userAddress.slice(0, 8)}...] Process complete. Remainder: ${remainder}`);
        });

        // Store the agent
        activeAgents[userAddress] = bank;

        return res.status(200).json({ 
            success: true, 
            address: userAddress,
            credit_score: user.credit_score,
            garnish_percentage: user.garnish_percentage
        });

    } catch (e: any) {
        console.error("Error starting agent:", e);
        return res.status(500).json({ error: e.message });
    }
});

/**
 * POST /disconnect
 * Stop a user's agent
 */
app.post('/disconnect', async (req: Request, res: Response) => {
    try {
        const { wallet_address } = req.body;
        const address = wallet_address?.toLowerCase();

        if (!address || !activeAgents[address]) {
            return res.status(404).json({ error: "No active agent found" });
        }

        activeAgents[address].disconnect();
        delete activeAgents[address];

        return res.status(200).json({ success: true });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

// ============================================
// USER ENDPOINTS
// ============================================

/**
 * GET /user/:address
 * Get user profile and stats
 */
app.get('/user/:address', async (req: Request, res: Response) => {
    try {
        const address = (req.params.address as string).toLowerCase();
        
        const user = await getOrCreateUser(address);
        if (!user) {
            return res.status(500).json({ error: "Failed to get user" });
        }

        // Get total debt
        const { data: debts } = await supabase
            .from('debts')
            .select('amount_owed')
            .eq('borrower_address', address)
            .in('status', ['active', 'overdue']);

        const totalDebt = debts?.reduce((sum, d) => sum + Number(d.amount_owed), 0) || 0;

        // Get available credit (sum of vouches - current usage)
        const { data: vouches } = await supabase
            .from('vouches')
            .select('limit_amount, current_usage')
            .eq('borrower_address', address)
            .eq('is_active', true);

        const availableCredit = vouches?.reduce(
            (sum, v) => sum + (Number(v.limit_amount) - Number(v.current_usage)), 
            0
        ) || 0;

        // Get on-chain status if contracts are configured
        let onChainStatus = null;
        if (ContractService.isConfigured()) {
            onChainStatus = await ContractService.getOnChainStatus(address);
        }

        return res.json({
            ...user,
            total_debt: totalDebt,
            available_credit: availableCredit,
            agent_active: !!activeAgents[address]?.isReady(),
            on_chain: onChainStatus
        });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

/**
 * GET /user/:address/onchain
 * Get detailed on-chain status for a user
 */
app.get('/user/:address/onchain', async (req: Request, res: Response) => {
    try {
        const address = (req.params.address as string).toLowerCase();
        
        if (!ContractService.isConfigured()) {
            return res.status(400).json({ 
                error: "Smart contracts not configured",
                hint: "Set ENS_COLLATERAL_ADDRESS or ENS_REPUTATION_ADDRESS in .env"
            });
        }

        const status = await ContractService.getOnChainStatus(address);
        return res.json(status);
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

/**
 * PATCH /user/:address/settings
 * Update user settings (garnish percentage, auto-repay)
 */
app.patch('/user/:address/settings', async (req: Request, res: Response) => {
    try {
        const address = (req.params.address as string).toLowerCase();
        const settings: UserSettings = req.body;

        const updates: any = {};
        
        if (settings.garnish_percentage !== undefined) {
            if (settings.garnish_percentage < 0 || settings.garnish_percentage > 100) {
                return res.status(400).json({ error: "Garnish percentage must be 0-100" });
            }
            updates.garnish_percentage = settings.garnish_percentage;
        }
        
        if (settings.auto_repay_enabled !== undefined) {
            updates.auto_repay_enabled = settings.auto_repay_enabled;
        }

        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('wallet_address', address)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.json(data);
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

// ============================================
// VOUCH ENDPOINTS
// ============================================

/**
 * POST /vouch
 * Create a new vouch (I'm backing someone)
 */
app.post('/vouch', async (req: Request, res: Response) => {
    try {
        const { voucher_address, borrower_address, limit_amount } = req.body as CreateVouchRequest;

        if (!voucher_address || !borrower_address || !limit_amount) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const voucherAddr = voucher_address.toLowerCase();
        const borrowerAddr = borrower_address.toLowerCase();

        if (voucherAddr === borrowerAddr) {
            return res.status(400).json({ error: "Cannot vouch for yourself" });
        }

        // Ensure both users exist
        await getOrCreateUser(voucherAddr);
        await getOrCreateUser(borrowerAddr);

        // Check for existing vouch
        const { data: existing } = await supabase
            .from('vouches')
            .select('*')
            .eq('voucher_address', voucherAddr)
            .eq('borrower_address', borrowerAddr)
            .single();

        if (existing) {
            // Update existing vouch
            const { data, error } = await supabase
                .from('vouches')
                .update({ 
                    limit_amount: Number(existing.limit_amount) + limit_amount,
                    is_active: true 
                })
                .eq('id', existing.id)
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.json({ ...data, updated: true });
        }

        // Create new vouch
        const { data, error } = await supabase
            .from('vouches')
            .insert({
                voucher_address: voucherAddr,
                borrower_address: borrowerAddr,
                limit_amount,
                current_usage: 0
            })
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        console.log(`[Vouch] ${voucherAddr.slice(0, 8)}... vouched ${limit_amount} for ${borrowerAddr.slice(0, 8)}...`);
        return res.status(201).json(data);
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

/**
 * GET /vouches/:address
 * Get all vouches for/by an address
 */
app.get('/vouches/:address', async (req: Request, res: Response) => {
    try {
        const address = (req.params.address as string).toLowerCase();
        const type = req.query.type as string; // 'given' or 'received'

        let query = supabase.from('vouches').select('*');

        if (type === 'given') {
            query = query.eq('voucher_address', address);
        } else if (type === 'received') {
            query = query.eq('borrower_address', address);
        } else {
            // Return both
            query = query.or(`voucher_address.eq.${address},borrower_address.eq.${address}`);
        }

        const { data, error } = await query;

        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

/**
 * DELETE /vouch/:id
 * Deactivate a vouch (can only do if no active debt using it)
 */
app.delete('/vouch/:id', async (req: Request, res: Response) => {
    try {
        const vouchId = parseInt(req.params.id as string);

        // Check for active debts using this vouch
        const { data: activeDebts } = await supabase
            .from('debts')
            .select('id')
            .eq('vouch_id', vouchId)
            .in('status', ['active', 'overdue']);

        if (activeDebts && activeDebts.length > 0) {
            return res.status(400).json({ 
                error: "Cannot deactivate vouch with active debts" 
            });
        }

        const { error } = await supabase
            .from('vouches')
            .update({ is_active: false })
            .eq('id', vouchId);

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

// ============================================
// DEBT/BORROW ENDPOINTS
// ============================================

/**
 * POST /borrow
 * Create a new debt (borrow against vouches)
 */
app.post('/borrow', async (req: Request, res: Response) => {
    try {
        const { borrower_address, amount, repayment_days = 14 } = req.body as BorrowRequest;

        if (!borrower_address || !amount) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const borrowerAddr = borrower_address.toLowerCase();

        // Get available vouches
        const { data: vouches } = await supabase
            .from('vouches')
            .select('*')
            .eq('borrower_address', borrowerAddr)
            .eq('is_active', true)
            .order('limit_amount', { ascending: false }); // Use biggest vouch first

        if (!vouches || vouches.length === 0) {
            return res.status(400).json({ error: "No vouches available" });
        }

        // Calculate available credit
        const availableCredit = vouches.reduce(
            (sum, v) => sum + (Number(v.limit_amount) - Number(v.current_usage)), 
            0
        );

        if (amount > availableCredit) {
            return res.status(400).json({ 
                error: "Insufficient credit",
                available: availableCredit,
                requested: amount
            });
        }

        // Allocate debt across vouches
        let remainingAmount = amount;
        const debtsCreated: Debt[] = [];

        for (const vouch of vouches) {
            if (remainingAmount <= 0) break;

            const vouchAvailable = Number(vouch.limit_amount) - Number(vouch.current_usage);
            if (vouchAvailable <= 0) continue;

            const borrowFromVouch = Math.min(remainingAmount, vouchAvailable);
            remainingAmount -= borrowFromVouch;

            // Create debt record
            const dueDate = new Date();
            // Support fractional days (for demo: values < 1 are treated as fractions of a day)
            // e.g., 0.00139 ≈ 2 minutes
            const millisecondsToAdd = repayment_days * 24 * 60 * 60 * 1000;
            dueDate.setTime(dueDate.getTime() + millisecondsToAdd);

            const { data: debt, error } = await supabase
                .from('debts')
                .insert({
                    borrower_address: borrowerAddr,
                    lender_address: vouch.voucher_address,
                    vouch_id: vouch.id,
                    original_amount: borrowFromVouch,
                    amount_owed: borrowFromVouch,
                    due_date: dueDate.toISOString(),
                    repayment_days,
                    status: 'active'
                })
                .select()
                .single();

            if (error) {
                console.error('Error creating debt:', error);
                continue;
            }

            // Update vouch usage
            await supabase
                .from('vouches')
                .update({ current_usage: Number(vouch.current_usage) + borrowFromVouch })
                .eq('id', vouch.id);

            debtsCreated.push(debt);
        }

        if (debtsCreated.length === 0) {
            return res.status(500).json({ error: "Failed to create debt" });
        }

        console.log(`[Borrow] ${borrowerAddr.slice(0, 8)}... borrowed ${amount} (${debtsCreated.length} debt(s))`);

        return res.status(201).json({
            success: true,
            total_borrowed: amount,
            debts: debtsCreated
        });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

/**
 * GET /debts/:address
 * Get all debts for an address
 */
app.get('/debts/:address', async (req: Request, res: Response) => {
    try {
        const address = (req.params.address as string).toLowerCase();
        const status = req.query.status as string;

        let query = supabase
            .from('debts')
            .select('*')
            .eq('borrower_address', address)
            .order('due_date', { ascending: true });

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

/**
 * GET /debts/lender/:address
 * Get all debts where this address is the lender (voucher)
 */
app.get('/debts/lender/:address', async (req: Request, res: Response) => {
    try {
        const address = (req.params.address as string).toLowerCase();
        const status = req.query.status as string;

        let query = supabase
            .from('debts')
            .select('*')
            .eq('lender_address', address)
            .order('due_date', { ascending: true });

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

/**
 * POST /repay
 * Manually repay a debt (outside of auto-garnish)
 */
app.post('/repay', async (req: Request, res: Response) => {
    try {
        const { borrower_address, debt_id, amount } = req.body as RepayRequest;

        if (!borrower_address || !debt_id || !amount) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const borrowerAddr = borrower_address.toLowerCase();

        // Get the debt
        const { data: debt, error: debtError } = await supabase
            .from('debts')
            .select('*')
            .eq('id', debt_id)
            .eq('borrower_address', borrowerAddr)
            .single();

        if (debtError || !debt) {
            return res.status(404).json({ error: "Debt not found" });
        }

        if (debt.status === 'paid') {
            return res.status(400).json({ error: "Debt already paid" });
        }

        const paymentAmount = Math.min(amount, Number(debt.amount_owed));
        const newAmountOwed = Number(debt.amount_owed) - paymentAmount;

        // Record payment
        await supabase
            .from('payments')
            .insert({
                debt_id,
                amount: paymentAmount,
                payment_type: newAmountOwed === 0 ? 'full' : 'manual'
            });

        // Update debt
        const updates: any = { amount_owed: newAmountOwed };
        if (newAmountOwed === 0) {
            updates.status = 'paid';
            updates.paid_at = new Date().toISOString();

            // Update vouch usage
            if (debt.vouch_id) {
                const { data: vouch } = await supabase
                    .from('vouches')
                    .select('current_usage')
                    .eq('id', debt.vouch_id)
                    .single();

                if (vouch) {
                    await supabase
                        .from('vouches')
                        .update({ 
                            current_usage: Math.max(0, vouch.current_usage - debt.original_amount)
                        })
                        .eq('id', debt.vouch_id);
                }
            }

            // Credit score bonus for early/on-time payment
            const isOnTime = new Date(debt.due_date) >= new Date();
            if (isOnTime) {
                await updateCreditScore(
                    borrowerAddr,
                    CREDIT_SCORE.ON_TIME_BONUS,
                    `Paid off debt #${debt_id} on time`
                );
            }
        }

        await supabase
            .from('debts')
            .update(updates)
            .eq('id', debt_id);

        console.log(`[Repay] ${borrowerAddr.slice(0, 8)}... paid ${paymentAmount} on debt #${debt_id}`);

        return res.json({
            success: true,
            paid: paymentAmount,
            remaining: newAmountOwed,
            fully_paid: newAmountOwed === 0
        });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

// ============================================
// CREDIT SCORE ENDPOINTS
// ============================================

/**
 * GET /credit-history/:address
 * Get credit score history
 */
app.get('/credit-history/:address', async (req: Request, res: Response) => {
    try {
        const address = (req.params.address as string).toLowerCase();

        const { data, error } = await supabase
            .from('credit_history')
            .select('*')
            .eq('wallet_address', address)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

// ============================================
// STATS ENDPOINT
// ============================================

/**
 * GET /stats
 * Get platform-wide statistics
 */
app.get('/stats', async (req: Request, res: Response) => {
    try {
        // Total users
        const { count: userCount } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });

        // Total active debts
        const { data: activeDebts } = await supabase
            .from('debts')
            .select('amount_owed')
            .in('status', ['active', 'overdue']);

        const totalActiveDebt = activeDebts?.reduce((sum, d) => sum + Number(d.amount_owed), 0) || 0;

        // Total vouches
        const { data: activeVouches } = await supabase
            .from('vouches')
            .select('limit_amount, current_usage')
            .eq('is_active', true);

        const totalVouchCapacity = activeVouches?.reduce((sum, v) => sum + Number(v.limit_amount), 0) || 0;
        const totalVouchUsed = activeVouches?.reduce((sum, v) => sum + Number(v.current_usage), 0) || 0;

        // Users with stripped ENS
        const { count: strippedCount } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('ens_stripped', true);

        return res.json({
            total_users: userCount || 0,
            active_agents: Object.keys(activeAgents).length,
            total_active_debt: totalActiveDebt,
            total_vouch_capacity: totalVouchCapacity,
            total_vouch_used: totalVouchUsed,
            ens_stripped_count: strippedCount || 0
        });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req: Request, res: Response) => {
    return res.json({ 
        status: 'ok',
        active_agents: Object.keys(activeAgents).length,
        timestamp: new Date().toISOString()
    });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log(`\n🚀 Backr Backend Server running on port ${PORT}`);
    console.log(`   Vault Address: ${VAULT_ADDRESS || 'NOT SET'}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
});
