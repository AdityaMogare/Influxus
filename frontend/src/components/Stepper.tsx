import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Stepper({ txId }: { txId: number }) {
  const { data: tx } = useQuery({
    queryKey: ['transaction', txId],
    queryFn: () => api.getTransaction(txId),
    refetchInterval: (query) => {
      if (query.state.data?.status === 'COMPLETED' || query.state.data?.status === 'FAILED') return false;
      return 1000;
    },
  });

  const status = tx?.status || 'INITIATED';

  const steps = [
    { key: 'INITIATED', label: 'Transfer Initiated', past: ['PENDING', 'COMPLETED'] },
    { key: 'PENDING', label: 'Processing Payment', past: ['COMPLETED'] },
    { key: 'COMPLETED', label: 'Transfer Completed', past: [] }
  ];

  return (
    <div className="glass-panel p-6 sm:p-8">
      <h3 className="text-lg font-bold mb-6">Transfer Progress</h3>
      <div className="flex flex-col gap-8 relative">
        <div className="absolute left-3 top-4 bottom-4 w-px bg-slate-200" />
        
        {steps.map((step, idx) => {
          const isCurrent = (status === step.key) || (status === 'INITIATED' && step.key === 'PENDING' && tx) || (!tx && step.key === 'INITIATED');
          const isPast = step.past.includes(status) || (status === 'COMPLETED' && step.key !== 'COMPLETED');
          
          return (
            <motion.div 
              key={step.key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`flex items-start gap-4 z-10 ${!isCurrent && !isPast ? 'opacity-40' : ''}`}
            >
              <div className="bg-white rounded-full relative">
                {isPast ? (
                  <CheckCircle2 className="w-6 h-6 text-wise-green" />
                ) : isCurrent ? (
                  <Loader2 className="w-6 h-6 text-wise animate-spin" />
                ) : (
                  <Circle className="w-6 h-6 text-slate-300" />
                )}
              </div>
              <div className="flex flex-col">
                <span className={`font-semibold ${isCurrent ? 'text-wise' : isPast ? 'text-slate-900' : 'text-slate-500'}`}>
                  {step.label}
                </span>
                {isCurrent && (
                  <span className="text-sm text-slate-500 mt-1">
                    {step.key === 'PENDING' ? 'Clearing bank networks (simulated 5s delay)...' : 'Setting up your transfer...'}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
