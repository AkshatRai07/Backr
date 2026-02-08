/**
 * Backr Core Business Logic
 * 
 * This file exports all the core functions that can be used by both
 * the API server (index.ts) and test scripts.
 */

import { supabase } from './db';
import { ContractService } from './contracts';
import { 
    type User, type Vouch, type Debt,
    CREDIT_SCORE 
} from './types';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import 'dotenv/config';

// ENS Client (Mainnet for ENS resolution)
const ensClient = createPublicClient({
    chain: mainnet,
    transport: http(process.env.MAINNET_RPC_URL || 'https://eth.llamarpc.com'),
});

// ============================================
// ENS FUNCTIONS
// ============================================

/**
 * Lookup ENS name for an address (from mainnet)
 */
export async function lookupENS(address: string): Promise<string | null> {
    try {
        const ensName = await ensClient.getEnsName({
            address: address as `0x${string}`
        });
        return ensName;
    } catch (e) {
        console.error('ENS lookup failed:', e);
        return null;
    }
}

/**
 * Strip ENS from a user - marks in DB AND triggers on-chain default
 */
export async function stripENS(walletAddress: string): Promise<void> {
    const address = walletAddress.toLowerCase();
    const { data: user } = await supabase
        .from('users')
        .select('ens_name, ens_stripped')
        .eq('wallet_address', address)
        .single();
    
    if (user && !user.ens_stripped) {
        // Mark in database
        await supabase
            .from('users')
            .update({ ens_stripped: true })
            .eq('wallet_address', address);
        
        console.log(`[ENS] Stripped ENS for ${address.slice(0, 8)}... (${user.ens_name || 'no ENS'})`);
        
        // Trigger on-chain default marking (updates ENS text records / locks collateral)
        if (ContractService.isConfigured()) {
            const results = await ContractService.markDefaultOnChain(address);
            if (results.collateral) {
                console.log(`[Contract] ENS collateral marked as defaulted`);
            }
            if (results.reputation) {
                console.log(`[Contract] ENS reputation text records updated to DEFAULTED`);
            }
        }
    }
}

// ============================================
// USER FUNCTIONS
// ============================================

/**
 * Get or create a user in the database
 */
export async function getOrCreateUser(walletAddress: string, skipENSLookup = false): Promise<User | null> {
    const address = walletAddress.toLowerCase();
    
    // Try to get existing user
    const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', address)
        .single();
    
    if (existingUser) return existingUser;
    
    // Lookup ENS for new user (can be skipped for tests)
    const ensName = skipENSLookup ? null : await lookupENS(address);
    
    // Create new user
    const { data: newUser, error } = await supabase
        .from('users')
        .insert({ 
            wallet_address: address,
            ens_name: ensName,
            credit_score: CREDIT_SCORE.DEFAULT,
            garnish_percentage: 50,
            auto_repay_enabled: true
        })
        .select()
        .single();
    
    if (error) {
        console.error('Error creating user:', error);
        return null;
    }
    
    return newUser;
}

/**
 * Get a user from the database
 */
export async function getUser(walletAddress: string): Promise<User | null> {
    const address = walletAddress.toLowerCase();
    
    const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', address)
        .single();
    
    return user;
}

/**
 * Update user settings
 */
export async function updateUserSettings(
    walletAddress: string, 
    settings: { garnish_percentage?: number; auto_repay_enabled?: boolean }
): Promise<User | null> {
    const address = walletAddress.toLowerCase();
    
    const { data, error } = await supabase
        .from('users')
        .update(settings)
        .eq('wallet_address', address)
        .select()
        .single();

    if (error) {
        console.error('Error updating user settings:', error);
        return null;
    }
    
    return data;
}

// ============================================
// CREDIT SCORE FUNCTIONS
// ============================================

/**
 * Update user's credit score with history tracking
 */
export async function updateCreditScore(
    walletAddress: string, 
    change: number, 
    reason: string
): Promise<number> {
    const address = walletAddress.toLowerCase();
    
    // Get current score
    const { data: user } = await supabase
        .from('users')
        .select('credit_score')
        .eq('wallet_address', address)
        .single();
    
    if (!user) return CREDIT_SCORE.DEFAULT;
    
    const oldScore = user.credit_score;
    const newScore = Math.max(CREDIT_SCORE.MIN, Math.min(CREDIT_SCORE.MAX, oldScore + change));
    
    // Update score in database
    await supabase
        .from('users')
        .update({ credit_score: newScore })
        .eq('wallet_address', address);
    
    // Log history
    await supabase
        .from('credit_history')
        .insert({
            wallet_address: address,
            old_score: oldScore,
            new_score: newScore,
            reason
        });
    
    // Sync credit score on-chain (if user is registered)
    if (ContractService.isConfigured()) {
        await ContractService.updateCreditScoreOnChain(address, newScore);
    }
    
    // Check if ENS should be stripped (triggers on-chain default)
    if (newScore < CREDIT_SCORE.ENS_STRIP_THRESHOLD) {
        await stripENS(address);
    }
    
    console.log(`[Credit] ${address.slice(0, 8)}... score: ${oldScore} -> ${newScore} (${reason})`);
    
    return newScore;
}

/**
 * Get credit history for a user
 */
export async function getCreditHistory(walletAddress: string, limit = 50) {
    const address = walletAddress.toLowerCase();

    const { data, error } = await supabase
        .from('credit_history')
        .select('*')
        .eq('wallet_address', address)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error getting credit history:', error);
        return [];
    }
    
    return data || [];
}

// ============================================
// VOUCH FUNCTIONS
// ============================================

/**
 * Create a new vouch (or update existing one)
 */
export async function createVouch(
    voucherAddress: string, 
    borrowerAddress: string, 
    limitAmount: number
): Promise<Vouch | null> {
    const voucherAddr = voucherAddress.toLowerCase();
    const borrowerAddr = borrowerAddress.toLowerCase();

    if (voucherAddr === borrowerAddr) {
        console.error('Cannot vouch for yourself');
        return null;
    }

    // Ensure both users exist
    await getOrCreateUser(voucherAddr, true);
    await getOrCreateUser(borrowerAddr, true);

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
                limit_amount: Number(existing.limit_amount) + limitAmount,
                is_active: true 
            })
            .eq('id', existing.id)
            .select()
            .single();

        if (error) {
            console.error('Error updating vouch:', error);
            return null;
        }
        console.log(`[Vouch] Updated: ${voucherAddr.slice(0, 8)}... vouched ${data.limit_amount} for ${borrowerAddr.slice(0, 8)}...`);
        return data;
    }

    // Create new vouch
    const { data, error } = await supabase
        .from('vouches')
        .insert({
            voucher_address: voucherAddr,
            borrower_address: borrowerAddr,
            limit_amount: limitAmount,
            current_usage: 0
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating vouch:', error);
        return null;
    }

    console.log(`[Vouch] ${voucherAddr.slice(0, 8)}... vouched ${limitAmount} for ${borrowerAddr.slice(0, 8)}...`);
    return data;
}

/**
 * Get vouches for a borrower
 */
export async function getVouchesForBorrower(borrowerAddress: string, activeOnly = true): Promise<Vouch[]> {
    const address = borrowerAddress.toLowerCase();
    
    let query = supabase
        .from('vouches')
        .select('*')
        .eq('borrower_address', address);
    
    if (activeOnly) {
        query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error getting vouches:', error);
        return [];
    }
    
    return data || [];
}

/**
 * Get vouches given by a voucher
 */
export async function getVouchesGiven(voucherAddress: string, activeOnly = true): Promise<Vouch[]> {
    const address = voucherAddress.toLowerCase();
    
    let query = supabase
        .from('vouches')
        .select('*')
        .eq('voucher_address', address);
    
    if (activeOnly) {
        query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error getting vouches:', error);
        return [];
    }
    
    return data || [];
}

/**
 * Calculate available credit for a borrower
 */
export async function getAvailableCredit(borrowerAddress: string): Promise<number> {
    const vouches = await getVouchesForBorrower(borrowerAddress);
    return vouches.reduce(
        (sum, v) => sum + (Number(v.limit_amount) - Number(v.current_usage)), 
        0
    );
}

/**
 * Deactivate a vouch
 */
export async function deactivateVouch(vouchId: number): Promise<boolean> {
    // Check for active debts using this vouch
    const { data: activeDebts } = await supabase
        .from('debts')
        .select('id')
        .eq('vouch_id', vouchId)
        .in('status', ['active', 'overdue']);

    if (activeDebts && activeDebts.length > 0) {
        console.error('Cannot deactivate vouch with active debts');
        return false;
    }

    const { error } = await supabase
        .from('vouches')
        .update({ is_active: false })
        .eq('id', vouchId);

    if (error) {
        console.error('Error deactivating vouch:', error);
        return false;
    }
    
    return true;
}

// ============================================
// DEBT/BORROW FUNCTIONS
// ============================================

/**
 * Borrow against available vouches
 */
export async function borrow(
    borrowerAddress: string, 
    amount: number, 
    repaymentDays = 14
): Promise<{ success: boolean; debts: Debt[]; error?: string }> {
    const borrowerAddr = borrowerAddress.toLowerCase();

    // Get available vouches
    const { data: vouches } = await supabase
        .from('vouches')
        .select('*')
        .eq('borrower_address', borrowerAddr)
        .eq('is_active', true)
        .order('limit_amount', { ascending: false }); // Use biggest vouch first

    if (!vouches || vouches.length === 0) {
        return { success: false, debts: [], error: "No vouches available" };
    }

    // Calculate available credit
    const availableCredit = vouches.reduce(
        (sum, v) => sum + (Number(v.limit_amount) - Number(v.current_usage)), 
        0
    );

    if (amount > availableCredit) {
        return { 
            success: false, 
            debts: [], 
            error: `Insufficient credit. Available: ${availableCredit}, Requested: ${amount}` 
        };
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
        const millisecondsToAdd = repaymentDays * 24 * 60 * 60 * 1000;
        dueDate.setTime(dueDate.getTime() + millisecondsToAdd);

        // Store repayment_days as integer in DB (round up for display, but due_date is accurate)
        const repaymentDaysInt = Math.max(1, Math.ceil(repaymentDays));

        const { data: debt, error } = await supabase
            .from('debts')
            .insert({
                borrower_address: borrowerAddr,
                lender_address: vouch.voucher_address,
                vouch_id: vouch.id,
                original_amount: borrowFromVouch,
                amount_owed: borrowFromVouch,
                due_date: dueDate.toISOString(),
                repayment_days: repaymentDaysInt,
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
        return { success: false, debts: [], error: "Failed to create debt" };
    }

    console.log(`[Borrow] ${borrowerAddr.slice(0, 8)}... borrowed ${amount} (${debtsCreated.length} debt(s))`);

    return { success: true, debts: debtsCreated };
}

/**
 * Get active debts for a borrower
 */
export async function getDebtsForBorrower(
    borrowerAddress: string, 
    statusFilter?: 'active' | 'paid' | 'overdue' | 'defaulted'
): Promise<Debt[]> {
    const address = borrowerAddress.toLowerCase();

    let query = supabase
        .from('debts')
        .select('*')
        .eq('borrower_address', address)
        .order('due_date', { ascending: true });

    if (statusFilter) {
        query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error getting debts:', error);
        return [];
    }
    
    return data || [];
}

/**
 * Get debts where user is the lender
 */
export async function getDebtsAsLender(
    lenderAddress: string,
    statusFilter?: 'active' | 'paid' | 'overdue' | 'defaulted'
): Promise<Debt[]> {
    const address = lenderAddress.toLowerCase();

    let query = supabase
        .from('debts')
        .select('*')
        .eq('lender_address', address)
        .order('due_date', { ascending: true });

    if (statusFilter) {
        query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error getting debts:', error);
        return [];
    }
    
    return data || [];
}

/**
 * Calculate total debt for a borrower
 */
export async function getTotalDebt(borrowerAddress: string): Promise<number> {
    const { data: debts } = await supabase
        .from('debts')
        .select('amount_owed')
        .eq('borrower_address', borrowerAddress.toLowerCase())
        .in('status', ['active', 'overdue']);

    return debts?.reduce((sum, d) => sum + Number(d.amount_owed), 0) || 0;
}

/**
 * Manually repay a debt
 */
export async function repayDebt(
    borrowerAddress: string,
    debtId: number,
    amount: number
): Promise<{ success: boolean; paid: number; remaining: number; fullyPaid: boolean; error?: string }> {
    const borrowerAddr = borrowerAddress.toLowerCase();

    // Get the debt
    const { data: debt, error: debtError } = await supabase
        .from('debts')
        .select('*')
        .eq('id', debtId)
        .eq('borrower_address', borrowerAddr)
        .single();

    if (debtError || !debt) {
        return { success: false, paid: 0, remaining: 0, fullyPaid: false, error: "Debt not found" };
    }

    if (debt.status === 'paid') {
        return { success: false, paid: 0, remaining: 0, fullyPaid: true, error: "Debt already paid" };
    }

    const paymentAmount = Math.min(amount, Number(debt.amount_owed));
    const newAmountOwed = Number(debt.amount_owed) - paymentAmount;

    // Record payment
    await supabase
        .from('payments')
        .insert({
            debt_id: debtId,
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
                `Paid off debt #${debtId} on time`
            );
        }
    }

    await supabase
        .from('debts')
        .update(updates)
        .eq('id', debtId);

    console.log(`[Repay] ${borrowerAddr.slice(0, 8)}... paid ${paymentAmount} on debt #${debtId}`);

    return {
        success: true,
        paid: paymentAmount,
        remaining: newAmountOwed,
        fullyPaid: newAmountOwed === 0
    };
}

// ============================================
// OVERDUE/DEFAULT FUNCTIONS
// ============================================

/**
 * Check and mark overdue debts
 */
export async function checkOverdueDebts(): Promise<number> {
    const now = new Date().toISOString();
    let overdueCount = 0;
    
    // Find overdue debts
    const { data: overdueDebts } = await supabase
        .from('debts')
        .select('*')
        .eq('status', 'active')
        .lt('due_date', now);
    
    if (!overdueDebts || overdueDebts.length === 0) return 0;
    
    for (const debt of overdueDebts) {
        // Mark as overdue
        await supabase
            .from('debts')
            .update({ status: 'overdue' })
            .eq('id', debt.id);
        
        // Penalize credit score
        await updateCreditScore(
            debt.borrower_address,
            -CREDIT_SCORE.LATE_PAYMENT_PENALTY,
            `Late payment on debt #${debt.id}`
        );
        
        overdueCount++;
    }
    
    return overdueCount;
}

/**
 * Mark a debt as defaulted (after grace period)
 */
export async function markDebtDefaulted(debtId: number): Promise<boolean> {
    const { data: debt, error } = await supabase
        .from('debts')
        .select('*')
        .eq('id', debtId)
        .single();

    if (error || !debt) {
        console.error('Debt not found:', debtId);
        return false;
    }

    if (debt.status === 'defaulted' || debt.status === 'paid') {
        return false;
    }

    // Mark as defaulted
    await supabase
        .from('debts')
        .update({ status: 'defaulted' })
        .eq('id', debtId);

    // Apply default penalty
    await updateCreditScore(
        debt.borrower_address,
        -CREDIT_SCORE.DEFAULT_PENALTY,
        `Defaulted on debt #${debtId}`
    );

    console.log(`[Default] Debt #${debtId} marked as defaulted for ${debt.borrower_address.slice(0, 8)}...`);

    return true;
}

// ============================================
// STATS FUNCTIONS
// ============================================

/**
 * Get platform statistics
 */
export async function getPlatformStats() {
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

    return {
        total_users: userCount || 0,
        total_active_debt: totalActiveDebt,
        total_vouch_capacity: totalVouchCapacity,
        total_vouch_used: totalVouchUsed
    };
}

/**
 * Get user status summary
 */
export async function getUserStatus(walletAddress: string) {
    const address = walletAddress.toLowerCase();
    
    const user = await getUser(address);
    if (!user) return null;

    const totalDebt = await getTotalDebt(address);
    const availableCredit = await getAvailableCredit(address);
    const activeDebts = await getDebtsForBorrower(address, 'active');

    return {
        ...user,
        total_debt: totalDebt,
        available_credit: availableCredit,
        active_debts_count: activeDebts.length
    };
}
