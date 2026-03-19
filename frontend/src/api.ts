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
    created_at: string;
}

export const api = {
  getQuote: async (source: string, target: string, amount: number): Promise<Quote> => {
    const res = await fetch(`${BASE_URL}/quote?sourceCurrency=${source}&targetCurrency=${target}&amount=${amount}`);
    if (!res.ok) throw new Error('Failed to fetch quote');
    return res.json();
  },
  
  transfer: async (req: { 
    from_account_id: number; 
    to_account_id: number; 
    amount: number; 
    currency: string; 
    description: string; 
    idempotency_key: string 
  }) => {
    const { idempotency_key, ...body } = req;
    const res = await fetch(`${BASE_URL}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': idempotency_key },
      body: JSON.stringify(body),
    });
    
    // We can also check if res.ok is false, but fastapi might return 400 with a detail
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
  }
};
