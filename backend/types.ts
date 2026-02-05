export interface User {
  wallet_address: string;
  ens_name: string | null;
  credit_score: number;
  ens_stripped: boolean;
  garnish_percentage: number;
  auto_repay_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Vouch {
  id: number;
  voucher_address: string;
  borrower_address: string;
  limit_amount: number;
  current_usage: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Debt {
  id: number;
  borrower_address: string;
  lender_address: string;
  vouch_id: number | null;
  original_amount: number;
  amount_owed: number;
  due_date: string;
  repayment_days: number;
  status: 'active' | 'paid' | 'overdue' | 'defaulted';
  created_at?: string;
  paid_at?: string | null;
}

export interface Payment {
  id: number;
  debt_id: number;
  amount: number;
  payment_type: 'garnish' | 'manual' | 'full';
  tx_hash?: string;
  created_at?: string;
}

export interface CreditHistory {
  id: number;
  wallet_address: string;
  old_score: number;
  new_score: number;
  reason: string;
  created_at?: string;
}

// API Request/Response types
export interface CreateVouchRequest {
  voucher_address: string;
  borrower_address: string;
  limit_amount: number;
}

export interface BorrowRequest {
  borrower_address: string;
  amount: number;
  repayment_days?: number; // defaults to 14
}

export interface RepayRequest {
  borrower_address: string;
  debt_id: number;
  amount: number;
}

export interface ConnectRequest {
  sessionPrivateKey: string;
}

export interface UserSettings {
  garnish_percentage?: number;
  auto_repay_enabled?: boolean;
}

// Credit score thresholds
export const CREDIT_SCORE = {
  MIN: 300,
  MAX: 900,
  DEFAULT: 650,
  ENS_STRIP_THRESHOLD: 400, // Below this, ENS gets stripped
  LATE_PAYMENT_PENALTY: 25,
  DEFAULT_PENALTY: 50,
  ON_TIME_BONUS: 10,
} as const;
