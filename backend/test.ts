/**
 * Backr Integration Test Script
 * 
 * This script tests the complete Backr flow using the actual backend services:
 * 1. Creates 4 test wallets (3 lenders + 1 borrower)
 * 2. Lenders vouch for borrower
 * 3. Borrower takes a loan
 * 4. Tests repayment flow
 * 5. Tests credit score decrease on default
 * 
 * REQUIRES: Supabase configured in .env
 * 
 * Run: bun run test:flow
 */

import { Wallet } from 'ethers';
import {
    getOrCreateUser,
    getUserStatus,
    createVouch,
    getAvailableCredit,
    borrow,
    getDebtsForBorrower,
    repayDebt,
    checkOverdueDebts,
    markDebtDefaulted,
    getPlatformStats,
} from './services';
import { CREDIT_SCORE } from './types';
import { supabase } from './db';

// ============================================
// HELPER FUNCTIONS
// ============================================

function log(category: string, message: string, data?: any) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`\n[${timestamp}] 📋 ${category.toUpperCase()}`);
    console.log(`   ${message}`);
    if (data) {
        console.log(`   ${JSON.stringify(data, null, 2).split('\n').join('\n   ')}`);
    }
}

function logSection(title: string) {
    console.log('\n' + '='.repeat(60));
    console.log(`🔷 ${title}`);
    console.log('='.repeat(60));
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatAddress(addr: string): string {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

async function printUserStatus(address: string, label: string): Promise<void> {
    const status = await getUserStatus(address);
    if (!status) {
        console.log(`\n   👤 ${label}: NOT FOUND`);
        return;
    }

    console.log(`\n   👤 ${label} (${formatAddress(address)})`);
    console.log(`      📊 Credit Score: ${status.credit_score}`);
    console.log(`      💳 Active Debt: $${status.total_debt.toFixed(2)}`);
    console.log(`      🤝 Available Credit: $${status.available_credit.toFixed(2)}`);
    console.log(`      🔄 Auto-Repay: ${status.auto_repay_enabled ? 'ON' : 'OFF'} (${status.garnish_percentage}%)`);
}

async function printAllBalances(wallets: { label: string; wallet: Wallet }[]): Promise<void> {
    console.log('\n' + '-'.repeat(50));
    console.log('📊 CURRENT STATUS');
    console.log('-'.repeat(50));
    
    for (const { label, wallet } of wallets) {
        await printUserStatus(wallet.address, label);
    }
}

// ============================================
// CLEANUP FUNCTION
// ============================================

async function cleanupTestData(addresses: string[]): Promise<void> {
    log('Cleanup', 'Removing test data from database...');
    
    const lowerAddresses = addresses.map(a => a.toLowerCase());
    
    // Delete in order due to foreign key constraints
    // 1. Delete payments first
    const { data: debts } = await supabase
        .from('debts')
        .select('id')
        .in('borrower_address', lowerAddresses);
    
    if (debts && debts.length > 0) {
        const debtIds = debts.map(d => d.id);
        await supabase.from('payments').delete().in('debt_id', debtIds);
    }
    
    // 2. Delete debts
    await supabase.from('debts').delete().in('borrower_address', lowerAddresses);
    await supabase.from('debts').delete().in('lender_address', lowerAddresses);
    
    // 3. Delete vouches
    await supabase.from('vouches').delete().in('voucher_address', lowerAddresses);
    await supabase.from('vouches').delete().in('borrower_address', lowerAddresses);
    
    // 4. Delete credit history
    await supabase.from('credit_history').delete().in('wallet_address', lowerAddresses);
    
    // 5. Delete users
    await supabase.from('users').delete().in('wallet_address', lowerAddresses);
    
    log('Cleanup', 'Test data removed');
}

// ============================================
// MAIN TEST SCRIPT
// ============================================

async function runTest() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║           🚀 BACKR INTEGRATION TEST SCRIPT 🚀              ║');
    console.log('║         Using Real Backend Services + Supabase             ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    // ============================================
    // STEP 1: Create 4 test wallets
    // ============================================
    logSection('STEP 1: Creating Test Wallets');

    const lender1Wallet = Wallet.createRandom();
    const lender2Wallet = Wallet.createRandom();
    const lender3Wallet = Wallet.createRandom();
    const borrowerWallet = Wallet.createRandom();

    const wallets = [
        { label: 'Lender 1', wallet: lender1Wallet },
        { label: 'Lender 2', wallet: lender2Wallet },
        { label: 'Lender 3', wallet: lender3Wallet },
        { label: 'Borrower', wallet: borrowerWallet },
    ];

    const allAddresses = wallets.map(w => w.wallet.address);

    log('Wallets', 'Created 4 test wallets:');
    wallets.forEach(({ label, wallet }) => {
        console.log(`   ${label}: ${formatAddress(wallet.address)}`);
    });

    // ============================================
    // STEP 2: Register users in Supabase (skip ENS lookup)
    // ============================================
    logSection('STEP 2: Registering Users in Database');

    // Use getOrCreateUser with skipENSLookup=true for tests
    const lender1 = await getOrCreateUser(lender1Wallet.address, true);
    const lender2 = await getOrCreateUser(lender2Wallet.address, true);
    const lender3 = await getOrCreateUser(lender3Wallet.address, true);
    const borrower = await getOrCreateUser(borrowerWallet.address, true);

    if (!lender1 || !lender2 || !lender3 || !borrower) {
        console.error('❌ Failed to create users. Check Supabase connection.');
        return;
    }

    log('Users', 'All 4 users registered with default credit score:', { 
        default_score: CREDIT_SCORE.DEFAULT 
    });

    // ============================================
    // STEP 3: Lenders vouch for borrower
    // ============================================
    logSection('STEP 3: Lenders Vouch for Borrower');

    const vouch1 = await createVouch(lender1Wallet.address, borrowerWallet.address, 2000);
    log('Vouch 1', `Lender 1 vouched $2,000 for Borrower`, { vouch_id: vouch1?.id });

    const vouch2 = await createVouch(lender2Wallet.address, borrowerWallet.address, 1500);
    log('Vouch 2', `Lender 2 vouched $1,500 for Borrower`, { vouch_id: vouch2?.id });

    const vouch3 = await createVouch(lender3Wallet.address, borrowerWallet.address, 1000);
    log('Vouch 3', `Lender 3 vouched $1,000 for Borrower`, { vouch_id: vouch3?.id });

    const availableCredit = await getAvailableCredit(borrowerWallet.address);
    log('Credit', `Borrower now has $${availableCredit} available credit`);

    await printAllBalances(wallets);

    // ============================================
    // STEP 4: Borrower takes a loan
    // ============================================
    logSection('STEP 4: Borrower Takes a $3,000 Loan');

    const loanAmount = 3000;
    // Short repayment period for demo: ~10 seconds (0.000116 days)
    const repaymentDays = 0.000116; // ~10 seconds

    log('Borrow', `Requesting $${loanAmount} with ${(repaymentDays * 24 * 60 * 60).toFixed(0)} second repayment...`);

    const borrowResult = await borrow(borrowerWallet.address, loanAmount, repaymentDays);

    if (!borrowResult.success) {
        console.error('❌ Borrow failed:', borrowResult.error);
        await cleanupTestData(allAddresses);
        return;
    }

    log('Debts Created', `${borrowResult.debts.length} debt(s) created:`);
    for (const debt of borrowResult.debts) {
        console.log(`   Debt #${debt.id}: $${debt.original_amount} to ${formatAddress(debt.lender_address)}`);
        console.log(`      Due: ${new Date(debt.due_date).toLocaleTimeString()}`);
    }

    await printAllBalances(wallets);

    // ============================================
    // STEP 5: Test partial repayment
    // ============================================
    logSection('STEP 5: Test Partial Repayment');

    const firstDebt = borrowResult.debts[0];
    const repayAmount = 500;

    log('Repay', `Repaying $${repayAmount} on debt #${firstDebt.id}...`);

    const repayResult = await repayDebt(borrowerWallet.address, firstDebt.id, repayAmount);

    if (repayResult.success) {
        log('Payment', `Paid $${repayResult.paid}, Remaining: $${repayResult.remaining}`, {
            fully_paid: repayResult.fullyPaid
        });
    } else {
        log('Payment', `Failed: ${repayResult.error}`);
    }

    await printAllBalances(wallets);

    // ============================================
    // STEP 6: Wait for debts to become overdue
    // ============================================
    logSection('STEP 6: Waiting for Debts to Become Overdue...');

    log('Wait', 'Waiting 12 seconds for loan deadline to pass...');
    
    // Progress indicator
    for (let i = 0; i < 12; i++) {
        await sleep(1000);
        process.stdout.write('.');
    }
    console.log(' Done!');

    // ============================================
    // STEP 7: Check and process overdue debts
    // ============================================
    logSection('STEP 7: Processing Overdue Debts');

    const overdueCount = await checkOverdueDebts();
    log('Overdue', `${overdueCount} debt(s) marked as overdue`);

    // Get user's current credit score
    const borrowerStatus = await getUserStatus(borrowerWallet.address);
    log('Credit Impact', `Borrower credit score after overdue: ${borrowerStatus?.credit_score}`);

    // ============================================
    // STEP 8: Mark debts as defaulted
    // ============================================
    logSection('STEP 8: Marking Debts as Defaulted');

    const activeDebts = await getDebtsForBorrower(borrowerWallet.address);
    const unpaidDebts = activeDebts.filter(d => d.status === 'overdue');

    log('Defaults', `Marking ${unpaidDebts.length} overdue debt(s) as defaulted...`);

    for (const debt of unpaidDebts) {
        await markDebtDefaulted(debt.id);
    }

    await printAllBalances(wallets);

    // ============================================
    // STEP 9: Final Summary
    // ============================================
    logSection('STEP 9: Final Summary');

    const finalBorrowerStatus = await getUserStatus(borrowerWallet.address);
    const platformStats = await getPlatformStats();

    console.log('\n📊 BORROWER FINAL STATUS:');
    console.log(`   Credit Score: ${CREDIT_SCORE.DEFAULT} → ${finalBorrowerStatus?.credit_score}`);
    console.log(`   Total Debt: $${finalBorrowerStatus?.total_debt}`);
    console.log(`   Available Credit: $${finalBorrowerStatus?.available_credit}`);

    console.log('\n📈 PLATFORM STATS:');
    console.log(`   Total Users: ${platformStats.total_users}`);
    console.log(`   Total Active Debt: $${platformStats.total_active_debt}`);
    console.log(`   Total Vouch Capacity: $${platformStats.total_vouch_capacity}`);
    console.log(`   Total Vouch Used: $${platformStats.total_vouch_used}`);

    // ============================================
    // CLEANUP
    // ============================================
    logSection('CLEANUP');

    log('Cleanup', 'Removing test data from Supabase...');
    await cleanupTestData(allAddresses);

    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║              ✅ TEST COMPLETED SUCCESSFULLY! ✅             ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('\n');
}

// Run the test
runTest().catch(err => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
});
