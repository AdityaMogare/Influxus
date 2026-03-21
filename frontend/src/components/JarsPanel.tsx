import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Account } from '../api';
import { Plus, PiggyBank, ArrowRightLeft, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function JarsPanel({ accountId = 1 }: { accountId?: number }) {
  const queryClient = useQueryClient();
  const [newJarName, setNewJarName] = useState('');
  const [moveAmount, setMoveAmount] = useState('');
  const [activeJar, setActiveJar] = useState<Account | null>(null);
  
  const { data: jars, isLoading } = useQuery({
    queryKey: ['jars', accountId],
    queryFn: () => api.getJars(accountId),
  });
  
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: api.getAccounts,
  });

  const checking = accounts?.find(a => a.id === accountId);

  const createJar = useMutation({
    mutationFn: () => api.createJar(accountId, newJarName),
    onSuccess: () => {
      setNewJarName('');
      queryClient.invalidateQueries({ queryKey: ['jars'] });
    }
  });

  const moveMoney = useMutation({
    mutationFn: ({ direction }: { direction: 'to_jar'|'from_jar' }) => {
      if (!activeJar) throw new Error("Select a jar");
      return api.moveJar(accountId, activeJar.id, parseFloat(moveAmount), direction);
    },
    onSuccess: () => {
      setMoveAmount('');
      setActiveJar(null);
      queryClient.invalidateQueries({ queryKey: ['jars'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    }
  });

  return (
    <div className="glass-panel p-6 sm:p-8 flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <PiggyBank className="w-6 h-6 text-wise" /> 
          Your Jars
        </h2>
        <div className="text-sm font-medium text-slate-500">
          Main Checking: <span className="text-slate-900">${checking?.balance || '0.00'}</span>
        </div>
      </div>
      
      {/* Create Jar */}
      <div className="flex gap-3">
        <input 
          type="text" 
          placeholder="New Jar Name (e.g. Holiday)" 
          className="input-field flex-1"
          value={newJarName}
          onChange={e => setNewJarName(e.target.value)}
        />
        <button 
          onClick={() => createJar.mutate()}
          disabled={!newJarName || createJar.isPending}
          className="btn-primary py-2 px-4 rounded-xl flex items-center gap-1"
        >
          {createJar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
        </button>
      </div>
      
      {/* Jars List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        {isLoading ? (
            <div className="animate-pulse h-24 bg-slate-100 rounded-xl" />
        ) : jars?.length === 0 ? (
            <p className="text-slate-500 text-sm">No jars yet. Create one to start saving!</p>
        ) : jars?.map((jar, i) => (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            key={jar.id} 
            className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${activeJar?.id === jar.id ? 'border-wise bg-blue-50/50' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
            onClick={() => setActiveJar(jar)}
          >
            <h3 className="font-semibold text-slate-900">{jar.jar_name}</h3>
            <p className="text-2xl font-bold mt-2 text-wise">${parseFloat(jar.balance).toFixed(2)}</p>
          </motion.div>
        ))}
      </div>

      {/* Move Money Console */}
      <AnimatePresence>
        {activeJar && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 p-5 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col gap-4 overflow-hidden"
          >
            <h4 className="font-medium flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-slate-400" />
              Transfer for {activeJar.jar_name}
            </h4>
            <div className="flex gap-3">
              <input 
                type="number" 
                placeholder="$ Amount"
                className="input-field flex-1"
                value={moveAmount}
                onChange={e => setMoveAmount(e.target.value)}
              />
              <button 
                onClick={() => moveMoney.mutate({ direction: 'to_jar' })}
                disabled={!moveAmount || moveMoney.isPending}
                className="bg-slate-900 text-white font-medium py-2 px-4 rounded-xl hover:bg-slate-800 transition-colors"
              >
                Deposit
              </button>
              <button 
                onClick={() => moveMoney.mutate({ direction: 'from_jar' })}
                disabled={!moveAmount || moveMoney.isPending}
                className="bg-white border border-slate-200 text-slate-900 font-medium py-2 px-4 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Withdraw
              </button>
            </div>
            {moveMoney.isError && (
              <p className="text-red-500 text-sm">{moveMoney.error.message}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
