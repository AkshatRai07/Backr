// API client for Backr backend
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Types
export interface User {
  wallet_address: string;
  ens_name: string | null;
  credit_score: number;
  ens_stripped: boolean;
  garnish_percentage: number;
  auto_repay_enabled: boolean;
  total_debt?: number;
  available_credit?: number;
  agent_active?: boolean;
  on_chain?: OnChainStatus | null;
  created_at?: string;
}

export interface OnChainStatus {
  hasStakedENS: boolean;
  isRegisteredReputation: boolean;
  onChainScore: number | null;
  isDefaulted: boolean;
  canBeSlashed: boolean;
  timeUntilSlashable: number | null;
}

export interface Vouch {
  id: number;
  voucher_address: string;
  vouchee_address: string;
  borrower_address?: string; // Alias for backward compatibility
  amount: number;
  limit_amount?: number; // Alias
  utilized_amount: number;
  current_usage?: number; // Alias
  status: VouchStatus;
  is_active?: boolean;
  message?: string;
  created_at?: string;
}

export type VouchStatus = 'pending' | 'active' | 'revoked' | 'expired';

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

export interface CreditHistoryEntry {
  id: number;
  wallet_address: string;
  old_score: number;
  new_score: number;
  reason: string;
  created_at: string;
}

export interface PlatformStats {
  total_users: number;
  active_agents: number;
  total_active_debt: number;
  total_vouch_capacity: number;
  total_vouch_used: number;
  ens_stripped_count: number;
  active_vouches?: number;
  total_debt_issued?: number;
  default_rate?: number;
}

// API Functions
class BackrAPI {
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // User endpoints
  async getUser(address: string): Promise<User> {
    return this.request<User>(`/user/${address.toLowerCase()}`);
  }

  async updateSettings(
    address: string,
    settings: { garnish_percentage?: number; auto_repay_enabled?: boolean }
  ): Promise<User> {
    return this.request<User>(`/user/${address.toLowerCase()}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  }

  async getOnChainStatus(address: string): Promise<OnChainStatus> {
    return this.request<OnChainStatus>(`/user/${address.toLowerCase()}/onchain`);
  }

  // Agent endpoints
  async connectAgent(sessionPrivateKey: string): Promise<{ success: boolean; address: string; credit_score: number; garnish_percentage: number }> {
    return this.request('/connect', {
      method: 'POST',
      body: JSON.stringify({ sessionPrivateKey }),
    });
  }

  async disconnectAgent(walletAddress: string): Promise<{ success: boolean }> {
    return this.request('/disconnect', {
      method: 'POST',
      body: JSON.stringify({ wallet_address: walletAddress }),
    });
  }

  // Vouch endpoints
  async createVouch(
    voucherAddress: string,
    borrowerAddress: string,
    limitAmount: number
  ): Promise<Vouch> {
    return this.request<Vouch>('/vouch', {
      method: 'POST',
      body: JSON.stringify({
        voucher_address: voucherAddress,
        borrower_address: borrowerAddress,
        limit_amount: limitAmount,
      }),
    });
  }

  async getVouches(address: string, type?: 'given' | 'received'): Promise<Vouch[]> {
    const query = type ? `?type=${type}` : '';
    return this.request<Vouch[]>(`/vouches/${address.toLowerCase()}${query}`);
  }

  async deactivateVouch(vouchId: number): Promise<{ success: boolean }> {
    return this.request(`/vouch/${vouchId}`, {
      method: 'DELETE',
    });
  }

  // Debt endpoints
  async borrow(
    borrowerAddress: string,
    amount: number,
    repaymentDays?: number
  ): Promise<{ success: boolean; total_borrowed: number; debts: Debt[] }> {
    return this.request('/borrow', {
      method: 'POST',
      body: JSON.stringify({
        borrower_address: borrowerAddress,
        amount,
        repayment_days: repaymentDays,
      }),
    });
  }

  async getDebts(address: string, status?: string): Promise<Debt[]> {
    const query = status ? `?status=${status}` : '';
    return this.request<Debt[]>(`/debts/${address.toLowerCase()}${query}`);
  }

  async getLenderDebts(address: string): Promise<Debt[]> {
    return this.request<Debt[]>(`/debts/lender/${address.toLowerCase()}`);
  }

  async repay(
    borrowerAddress: string,
    debtId: number,
    amount: number
  ): Promise<{ success: boolean; paid: number; remaining: number; fully_paid: boolean }> {
    return this.request('/repay', {
      method: 'POST',
      body: JSON.stringify({
        borrower_address: borrowerAddress,
        debt_id: debtId,
        amount,
      }),
    });
  }

  // Credit history
  async getCreditHistory(address: string): Promise<CreditHistoryEntry[]> {
    return this.request<CreditHistoryEntry[]>(`/credit-history/${address.toLowerCase()}`);
  }

  // Stats
  async getStats(): Promise<PlatformStats> {
    return this.request<PlatformStats>('/stats');
  }

  // Health
  async healthCheck(): Promise<{ status: string; active_agents: number; timestamp: string }> {
    return this.request('/health');
  }

  // Namespaced accessors for convenience
  vouches = {
    create: async (params: { voucher_address: string; vouchee_address: string; amount: number; message?: string }) => {
      return this.createVouch(params.voucher_address, params.vouchee_address, params.amount);
    },
    activate: async (vouchId: number) => {
      // Activation is automatic in backend, but we can have a dummy call
      return { success: true, vouch_id: vouchId };
    },
    revoke: async (vouchId: number) => {
      return this.deactivateVouch(vouchId);
    },
    getByAddress: (address: string, type?: 'given' | 'received') => {
      return this.getVouches(address, type);
    },
  };

  debts = {
    create: async (params: { borrower_address: string; amount: number; repayment_days?: number }) => {
      return this.borrow(params.borrower_address, params.amount, params.repayment_days);
    },
    repay: async (debtId: number, amount: number, borrowerAddress?: string) => {
      // We need borrower address for the API, but if not provided, we'll need to handle it differently
      if (!borrowerAddress) throw new Error('Borrower address required for repay');
      return this.repay(borrowerAddress, debtId, amount);
    },
    getByAddress: (address: string, status?: string) => {
      return this.getDebts(address, status);
    },
    getLenderDebts: (address: string) => {
      return this.getLenderDebts(address);
    },
  };

  stats = {
    getPlatformStats: () => {
      return this.getStats();
    },
  };
}

export const api = new BackrAPI();
