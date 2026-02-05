export interface User {
  wallet_address: string;
  ens_name: string | null;
  credit_score: number;
}

export interface VouchRelationship {
  id: number;
  voucher_address: string;
  borrower_address: string;
  limit_amount: number;
  current_usage: number;
}

export interface Debt {
  id: number;
  borrower_address: string;
  amount_owed: number;
  due_date: string;
}
