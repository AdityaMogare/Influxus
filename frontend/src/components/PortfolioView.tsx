import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { TrendingUp, RefreshCw, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PortfolioView({ accountId = 1 }: { accountId?: number }) {
  const queryClient = useQueryClient();
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
  const [buyAmount, setBuyAmount] = useState('100');
  
  const { data: assets } = useQuery({
    queryKey: ['assets'],
    queryFn: api.getAssets,
  });

  const { data: portfolio, isLoading: portfolioLoading } = useQuery({
    queryKey: ['portfolio', accountId],
    queryFn: () => api.getPortfolio(accountId),
    refetchInterval: 5000, // Poll every 5s for live price updates from backend
  });

  const buyAsset = useMutation({
    mutationFn: () => api.buyAsset(accountId, selectedSymbol, parseFloat(buyAmount)),
    onSuccess: () => {
      setBuyAmount('100');
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    }
  });

  const totalValue = parseFloat(portfolio?.total_value || '0');
  const totalGain = parseFloat(portfolio?.total_gain || '0');
  const isPositive = totalGain >= 0;

  return (
    <div className="glass-panel p-6 sm:p-8 flex flex-col gap-6 relative overflow-hidden">
      <div className="flex justify-between items-start">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-wise" /> 
          Investments
        </h2>
        <div className="text-right">
          <p className="text-sm text-slate-500 font-medium">Portfolio Value</p>
          {portfolioLoading ? (
             <div className="h-8 w-24 bg-slate-100 animate-pulse rounded-md mt-1" />
          ) : (
            <>
              <p className="text-2xl font-bold text-slate-900">${totalValue.toFixed(2)}</p>
              <p className={`text-sm font-medium ${isPositive ? 'text-wise-green' : 'text-red-500'}`}>
                {isPositive ? '+' : ''}{totalGain.toFixed(2)}
              </p>
            </>
          )}
        </div>
      </div>
      
      {/* Buy Asset Form */}
      <div className="flex flex-col sm:flex-row gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
        <select 
            className="input-field flex-1 font-semibold"
            value={selectedSymbol}
            onChange={e => setSelectedSymbol(e.target.value)}
        >
          {assets?.map(a => (
            <option key={a.symbol} value={a.symbol}>{a.symbol} - ${parseFloat(a.current_price).toFixed(2)}</option>
          ))}
        </select>
        <div className="flex gap-2 flex-1">
          <input 
            type="number" 
            placeholder="Buy Amount ($)" 
            className="input-field w-full"
            value={buyAmount}
            onChange={e => setBuyAmount(e.target.value)}
          />
          <button 
            onClick={() => buyAsset.mutate()}
            disabled={!buyAmount || buyAsset.isPending}
            className="btn-primary py-2 px-6 rounded-xl flex items-center justify-center min-w-[100px]"
          >
            {buyAsset.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buy'}
          </button>
        </div>
      </div>
      
      {buyAsset.isError && <p className="text-red-500 text-sm">{buyAsset.error.message}</p>}

      {/* Holdings List */}
      <div className="flex flex-col gap-3 mt-2">
        {portfolio?.holdings?.length === 0 ? (
          <p className="text-slate-500 text-center py-6 text-sm">No assets currently held.</p>
        ) : portfolio?.holdings.map((h, i) => {
           const gain = parseFloat(h.gain_loss);
           const mvtVal = parseFloat(h.market_value);
           return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              key={h.symbol} 
              className="flex justify-between items-center p-4 rounded-xl border border-slate-100 hover:border-slate-200 bg-white transition-colors"
            >
              <div>
                <p className="font-semibold text-slate-900">{h.symbol}</p>
                <p className="text-xs text-slate-500 mt-0.5">{parseFloat(h.units).toFixed(4)} Units @ ${parseFloat(h.current_price).toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-slate-900">${mvtVal.toFixed(2)}</p>
                <p className={`text-xs font-medium flex items-center justify-end gap-1 ${gain >= 0 ? 'text-wise-green' : 'text-red-500'}`}>
                  {gain >= 0 ? '+' : ''}{gain.toFixed(2)} 
                  <span className="opacity-70">({parseFloat(h.gain_pct).toFixed(2)}%)</span>
                </p>
              </div>
            </motion.div>
          )
        })}
      </div>
      
      {/* Loading Indicator for Polling */}
      {portfolioLoading && (portfolio as any)?.total_value && (
        <div className="absolute top-6 right-6">
          <RefreshCw className="w-4 h-4 text-slate-300 animate-spin" />
        </div>
      )}
    </div>
  );
}
