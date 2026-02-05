-- ============================================
-- BACKR - Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. USERS TABLE
-- Stores user profiles, credit scores, and ENS info
CREATE TABLE IF NOT EXISTS users (
    wallet_address TEXT PRIMARY KEY,
    ens_name TEXT,
    credit_score INTEGER DEFAULT 650 CHECK (credit_score >= 300 AND credit_score <= 900),
    ens_stripped BOOLEAN DEFAULT FALSE,
    garnish_percentage INTEGER DEFAULT 50 CHECK (garnish_percentage >= 0 AND garnish_percentage <= 100),
    auto_repay_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. VOUCHES TABLE
-- Tracks who vouched for whom and the credit limits
CREATE TABLE IF NOT EXISTS vouches (
    id SERIAL PRIMARY KEY,
    voucher_address TEXT NOT NULL REFERENCES users(wallet_address),
    borrower_address TEXT NOT NULL REFERENCES users(wallet_address),
    limit_amount DECIMAL(18, 6) NOT NULL CHECK (limit_amount > 0),
    current_usage DECIMAL(18, 6) DEFAULT 0 CHECK (current_usage >= 0),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(voucher_address, borrower_address)
);

-- 3. DEBTS TABLE
-- Tracks individual debt records
CREATE TABLE IF NOT EXISTS debts (
    id SERIAL PRIMARY KEY,
    borrower_address TEXT NOT NULL REFERENCES users(wallet_address),
    lender_address TEXT NOT NULL REFERENCES users(wallet_address),  -- The voucher
    vouch_id INTEGER REFERENCES vouches(id),
    original_amount DECIMAL(18, 6) NOT NULL,
    amount_owed DECIMAL(18, 6) NOT NULL CHECK (amount_owed >= 0),
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    repayment_days INTEGER DEFAULT 14,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paid', 'overdue', 'defaulted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    paid_at TIMESTAMP WITH TIME ZONE
);

-- 4. PAYMENTS TABLE
-- Tracks all payment records (both manual and auto-garnished)
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    debt_id INTEGER NOT NULL REFERENCES debts(id),
    amount DECIMAL(18, 6) NOT NULL,
    payment_type TEXT DEFAULT 'garnish' CHECK (payment_type IN ('garnish', 'manual', 'full')),
    tx_hash TEXT,  -- Optional: store transaction reference
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. CREDIT_HISTORY TABLE
-- Audit trail for credit score changes
CREATE TABLE IF NOT EXISTS credit_history (
    id SERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL REFERENCES users(wallet_address),
    old_score INTEGER,
    new_score INTEGER,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_debts_borrower ON debts(borrower_address);
CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);
CREATE INDEX IF NOT EXISTS idx_vouches_voucher ON vouches(voucher_address);
CREATE INDEX IF NOT EXISTS idx_vouches_borrower ON vouches(borrower_address);
CREATE INDEX IF NOT EXISTS idx_payments_debt ON payments(debt_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update the 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vouches_updated_at ON vouches;
CREATE TRIGGER update_vouches_updated_at
    BEFORE UPDATE ON vouches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (Optional but recommended)
-- ============================================
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE vouches ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SAMPLE DATA (for testing)
-- ============================================
-- INSERT INTO users (wallet_address, ens_name, credit_score) VALUES
-- ('0x1234567890abcdef1234567890abcdef12345678', 'alice.eth', 750),
-- ('0xabcdef1234567890abcdef1234567890abcdef12', 'bob.eth', 650);
