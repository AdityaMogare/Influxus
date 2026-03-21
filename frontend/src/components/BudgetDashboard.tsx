import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { PieChart, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function BudgetDashboard({ accountId = 1 }: { accountId?: number }) {
  const queryClient = useQueryClient();
  const [catName, setCatName] = useState('Food');
  const [limit, setLimit] = useState('');
  
  const { data: budgets, isLoading } = useQuery({
    queryKey: ['budgets', accountId],
    queryFn: () => api.getBudgetStatus(accountId),
    refetchInterval: 5000,
  });

  const setBudget = useMutation({
    mutationFn: () => api.setBudget(accountId, catName, parseFloat(limit)),
    onSuccess: () => {
      setLimit('');
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    }
  });

  return (
    <div className="glass-panel p-6 sm:p-8 flex flex-col gap-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <PieChart className="w-6 h-6 text-wise" /> 
        Monthly Budget
      </h2>
      
      <div className="flex gap-3">
        <select className="input-field flex-1" value={catName} onChange={e => setCatName(e.target.value)}>
          <option value="Food">Food</option>
          <option value="Transport">Transport</option>
          <option value="Entertainment">Entertainment</option>
          <option value="Shopping">Shopping</option>
          <option value="Utilities">Utilities</option>
        </select>
        <input 
          type="number" 
          placeholder="New Limit ($)" 
          className="input-field w-32"
          value={limit}
          onChange={e => setLimit(e.target.value)}
        />
        <button 
          onClick={() => setBudget.mutate()}
          disabled={!limit || setBudget.isPending}
          className="btn-primary py-2 px-4 rounded-xl"
        >
          {setBudget.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Set'}
        </button>
      </div>
      
      <div className="flex flex-col gap-5 mt-4">
        {isLoading ? (
            <div className="animate-pulse h-16 bg-slate-100 rounded-xl" />
        ) : budgets?.length === 0 ? (
            <p className="text-slate-500 text-sm">No limits set. Add a budget limit above.</p>
        ) : budgets?.map((b, i) => {
          const spent = parseFloat(b.spent);
          const lim = parseFloat(b.limit);
          const percent = Math.min(100, Math.max(0, (spent / lim) * 100));
          const isOver = spent > lim;
          
          return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              key={b.category} 
              className="flex flex-col gap-2"
            >
              <div className="flex justify-between items-end">
                <span className="font-semibold text-slate-900">{b.category}</span>
                <span className="text-sm">
                  <strong className={isOver ? 'text-red-500' : 'text-slate-900'}>${spent.toFixed(0)}</strong>
                  <span className="text-slate-500"> / ${lim.toFixed(0)}</span>
                </span>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${percent}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className={`h-full ${isOver ? 'bg-red-500' : percent > 80 ? 'bg-amber-400' : 'bg-wise-green'}`}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
