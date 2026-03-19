import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { FileText, Clock, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function TransactionHistory() {
  const { data: transactions, isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: api.getTransactions,
    refetchInterval: 3000,
  });

  return (
    <div className="glass-panel p-6 sm:p-8 flex flex-col gap-4">
      <h3 className="text-lg font-bold">Recent Transactions</h3>
      
      {isLoading ? (
        <div className="animate-pulse flex flex-col gap-3 mt-4">
          <div className="h-16 bg-slate-100 rounded-xl w-full"></div>
          <div className="h-16 bg-slate-100 rounded-xl w-full"></div>
        </div>
      ) : transactions?.length === 0 ? (
        <p className="text-slate-500 text-center py-6">No previous transfers.</p>
      ) : (
        <div className="flex flex-col gap-3 mt-2 max-h-[400px] overflow-y-auto pr-2">
          {transactions?.map((tx, i) => (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              key={tx.id} 
              className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100">
                  <FileText className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{tx.description}</p>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">Ref: TX-{tx.id.toString().padStart(8, '0')}</p>
                </div>
              </div>
              
              <div className="flex flex-col items-end">
                {tx.status === 'COMPLETED' ? (
                  <span className="flex items-center gap-1 text-xs sm:text-sm font-medium text-wise-green bg-green-50 px-2 py-1 rounded-md">
                    <CheckCircle2 className="w-4 h-4" /> Completed
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs sm:text-sm font-medium text-amber-500 bg-amber-50 px-2 py-1 rounded-md">
                    <Clock className="w-4 h-4" /> Pending
                  </span>
                )}
                {tx.created_at && (
                  <span className="text-xs text-slate-400 mt-1 whitespace-nowrap">
                    {new Date(tx.created_at.includes('Z') ? tx.created_at : tx.created_at + 'Z').toLocaleString()}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
