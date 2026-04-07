const BASE_URL = 'http://127.0.0.1:8000';

export interface Quote {
    quote_id: number;
    source_currency: string;
    target_currency: string;
    source_amount: string;
    target_amount: string;
    rate: string;
    expires_at: string;
}

export interface Transaction {
    id: number;
    description: string;
    status: string;
    category: string | null;
    created_at: string;
}

export interface Account {
    id: number;
    name: string;
    currency: string;
    balance: string;
    account_type: string;
    parent_account_id: number | null;
    jar_name: string | null;
}

export interface BudgetStatus {
    category: string;
    spent: string;
    limit: string;
    remaining: string;
}

export interface Asset {
    symbol: string;
    name: string;
    current_price: string;
}

export interface Portfolio {
    holdings: {
        symbol: string;
        name: string;
        units: string;
        cost_basis: string;
        current_price: string;
        market_value: string;
        gain_loss: string;
        gain_pct: string;
    }[];
    total_value: string;
    total_cost: string;
    total_gain: string;
}

export interface ReconException {
    id: number;
    transaction_id: number | null;
    bank_reference: string | null;
    mismatch_type: string;
    resolved: string;
}

export interface ReconReport {
    id: number;
    report_date: string;
    total_drift: string;
    status: string;
    exceptions: ReconException[];
}

export const api = {
  requestOtp: async (identifier: string) => {
    const res = await fetch(`${BASE_URL}/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });
    if (!res.ok) { let err = await res.json().catch(()=>null); throw new Error(err?.detail || 'Failed to request OTP'); }
    return res.json();
  },
  
  verifyOtp: async (identifier: string, otp: string) => {
    const res = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, otp }),
    });
    if (!res.ok) { let err = await res.json().catch(()=>null); throw new Error(err?.detail || 'Invalid OTP'); }
    return res.json();
  },

  getQuote: async (source: string, target: string, amount: number): Promise<Quote> => {
    const res = await fetch(`${BASE_URL}/quote?sourceCurrency=${source}&targetCurrency=${target}&amount=${amount}`);
    if (!res.ok) throw new Error('Failed to fetch quote');
    return res.json();
  },
  
  transfer: async (req: { from_account_id: number; to_account_id: number; amount: number; currency: string; description: string; idempotency_key: string }) => {
    const { idempotency_key, ...body } = req;
    const res = await fetch(`${BASE_URL}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': idempotency_key },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
        let err = await res.json().catch(() => null);
        throw new Error(err?.detail || 'Transfer failed');
    }
    return res.json();
  },
  
  getTransaction: async (id: number): Promise<Transaction> => {
    const res = await fetch(`${BASE_URL}/transactions/${id}`);
    if (!res.ok) throw new Error('Failed to fetch transaction');
    return res.json();
  },
  
  getTransactions: async (): Promise<Transaction[]> => {
    const res = await fetch(`${BASE_URL}/transactions`);
    if (!res.ok) throw new Error('Failed to fetch transactions');
    return res.json();
  },

  // ── Phase 6 Jars ──
  getAccounts: async (): Promise<Account[]> => {
    const res = await fetch(`${BASE_URL}/accounts`);
    if (!res.ok) throw new Error('Failed to fetch accounts');
    return res.json();
  },
  createJar: async (parent_account_id: number, jar_name: string, currency: string = "USD") => {
    const res = await fetch(`${BASE_URL}/jars`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_account_id, jar_name, currency }),
    });
    if (!res.ok) { let err = await res.json().catch(()=>null); throw new Error(err?.detail || 'Failed'); }
    return res.json();
  },
  moveJar: async (checking_account_id: number, jar_account_id: number, amount: number, direction: 'to_jar' | 'from_jar') => {
    const res = await fetch(`${BASE_URL}/jars/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checking_account_id, jar_account_id, amount, direction }),
    });
    if (!res.ok) { let err = await res.json().catch(()=>null); throw new Error(err?.detail || 'Failed'); }
    return res.json();
  },
  getJars: async (account_id: number): Promise<Account[]> => {
    const res = await fetch(`${BASE_URL}/accounts/${account_id}/jars`);
    if (!res.ok) throw new Error('Failed to fetch jars');
    return res.json();
  },

  // ── Phase 7 Budgets ──
  getBudgetStatus: async (account_id: number): Promise<BudgetStatus[]> => {
    const res = await fetch(`${BASE_URL}/budgets/status?account_id=${account_id}`);
    if (!res.ok) throw new Error('Failed to fetch budgets');
    return res.json();
  },
  setBudget: async (account_id: number, category_name: string, monthly_limit: number) => {
    const res = await fetch(`${BASE_URL}/budgets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id, category_name, monthly_limit }),
    });
    if (!res.ok) throw new Error('Failed');
    return res.json();
  },

  // ── Phase 8 Assets ──
  getAssets: async (): Promise<Asset[]> => {
    const res = await fetch(`${BASE_URL}/assets`);
    if (!res.ok) throw new Error('Failed to fetch assets');
    return res.json();
  },
  buyAsset: async (checking_account_id: number, symbol: string, amount: number) => {
    const res = await fetch(`${BASE_URL}/assets/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checking_account_id, symbol, amount }),
    });
    if (!res.ok) { let err = await res.json().catch(()=>null); throw new Error(err?.detail || 'Failed to buy'); }
    return res.json();
  },
  getPortfolio: async (account_id: number): Promise<Portfolio> => {
    const res = await fetch(`${BASE_URL}/portfolio?account_id=${account_id}`);
    if (!res.ok) throw new Error('Failed to fetch portfolio');
    return res.json();
  },

  // ── Phase 9 Reconciliation ──
  runReconciliation: async () => {
    const res = await fetch(`${BASE_URL}/reconcile/run`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to run reconciliation');
    return res.json();
  },
  getReconReports: async (): Promise<ReconReport[]> => {
    const res = await fetch(`${BASE_URL}/reconcile/reports`);
    if (!res.ok) throw new Error('Failed to fetch reports');
    return res.json();
  },
  forceReconcile: async (exception_id: number, checking_account_id: number) => {
    const res = await fetch(`${BASE_URL}/reconcile/force`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exception_id, checking_account_id }),
    });
    if (!res.ok) { let err = await res.json().catch(()=>null); throw new Error(err?.detail || 'Failed'); }
    return res.json();
  }
};
