import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { ArrowRight, RefreshCw, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Calculator({ onTransferStart }: { onTransferStart: (id: number) => void }) {
  const [source, setSource] = useState('USD');
  const [target, setTarget] = useState('EUR');
  const [amount, setAmount] = useState('1000');
  const [timeLeft, setTimeLeft] = useState<number>(0);
  
  const queryClient = useQueryClient();

  const { data: quote, isLoading, isError, refetch } = useQuery({
    queryKey: ['quote', source, target, amount],
    queryFn: () => api.getQuote(source, target, parseFloat(amount || '0')),
    enabled: parseFloat(amount) > 0,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (quote?.expires_at) {
      const interval = setInterval(() => {
        const expStr = quote.expires_at.endsWith('Z') ? quote.expires_at : quote.expires_at + 'Z';
        const diff = new Date(expStr).getTime() - Date.now();
        setTimeLeft(Math.max(0, Math.floor(diff / 1000)));
        if (diff <= 0) refetch();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [quote, refetch]);

  const transferMutation = useMutation({
    mutationFn: async () => {
      const idempotencyKey = crypto.randomUUID();
      return api.transfer({
        from_account_id: 1,
        to_account_id: 2,
        amount: parseFloat(amount),
        currency: source,
        description: `Transfer ${source} to ${target}`,
        idempotency_key: idempotencyKey,
      });
    },
    onSuccess: (data) => {
      onTransferStart(data.transaction_id);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    }
  });

  return (
    <div className="glass-panel p-6 sm:p-8 flex flex-col gap-6 relative overflow-hidden">
      <h2 className="text-xl font-bold flex items-center gap-2">Send Money</h2>
      
      <div className="flex flex-col gap-4 relative">
        <div className="flex gap-4">
          <input 
            type="number" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)}
            className="input-field text-2xl font-semibold flex-1"
          />
          <select value={source} onChange={(e) => setSource(e.target.value)} className="input-field w-32 font-bold bg-slate-50">
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-2 shadow border border-slate-100 z-10">
          <ArrowRight className="w-5 h-5 text-wise rotate-90" />
        </div>

        <div className="flex gap-4">
          <input 
            type="text" 
            readOnly 
            value={quote ? parseFloat(quote.target_amount).toFixed(2) : '0.00'} 
            className="input-field text-2xl font-semibold flex-1 bg-slate-50 cursor-not-allowed text-slate-500"
          />
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="input-field w-32 font-bold bg-slate-50">
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </select>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center py-4">
            <RefreshCw className="animate-spin w-6 h-6 text-slate-400" />
          </motion.div>
        ) : isError ? (
          <motion.div key="error" className="text-red-500 text-sm py-4">Failed to get quote for this currency pair.</motion.div>
        ) : quote ? (
          <motion.div key="quote" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
            <div className="flex justify-between text-sm text-slate-600 border-t border-slate-100 pt-4 mt-2">
              <span>Exchange Rate</span>
              <span className="font-semibold text-slate-900">1 {source} = {parseFloat(quote.rate).toFixed(5)} {target}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600 items-center">
              <span>Guaranteed Rate</span>
              <span className="flex items-center gap-1 font-medium text-wise">
                <Clock className="w-4 h-4" /> {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </span>
            </div>
            
            <button 
              onClick={() => transferMutation.mutate()} 
              disabled={transferMutation.isPending}
              className="btn-primary mt-4 flex justify-center items-center gap-2"
            >
              {transferMutation.isPending ? <RefreshCw className="animate-spin w-5 h-5" /> : 'Continue to Payment'}
            </button>
            {transferMutation.isError && (
              <span className="text-red-500 text-sm text-center">Failed to initiate transfer.</span>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
