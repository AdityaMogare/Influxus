import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { ShieldAlert, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AuditLog({ checkingAccountId = 1 }: { checkingAccountId?: number }) {
  const queryClient = useQueryClient();
  const [activeExceptionFilter, setActiveExceptionFilter] = useState<'ALL' | 'UNRESOLVED'>('UNRESOLVED');

  const { data: reports, isLoading } = useQuery({
    queryKey: ['recon_reports'],
    queryFn: api.getReconReports,
    refetchInterval: 5000
  });

  const runRecon = useMutation({
    mutationFn: api.runReconciliation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recon_reports'] })
  });

  const forceResolve = useMutation({
    mutationFn: (exceptionId: number) => api.forceReconcile(exceptionId, checkingAccountId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recon_reports'] })
  });
  
  // Flatten exceptions for the table view
  const allExceptions = reports?.flatMap(r => r.exceptions.map(e => ({...e, drift: r.total_drift}))) || [];
  const filteredExceptions = activeExceptionFilter === 'ALL' ? allExceptions : allExceptions.filter(e => e.resolved === 'NO');

  // Most recent drift calculation
  const latestReport = reports?.[0];
  const currentDrift = parseFloat(latestReport?.total_drift || '0');
  const hasDrift = currentDrift !== 0;

  return (
    <div className="glass-panel p-6 sm:p-8 flex flex-col gap-6">
      <div className="flex justify-between items-start">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-wise" /> 
          Financial Ops Audit Log
        </h2>
        <button 
          onClick={() => runRecon.mutate()}
          className="btn-primary py-2 px-4 rounded-xl flex items-center gap-2 text-sm"
          disabled={runRecon.isPending}
        >
          {runRecon.isPending ? <RefreshCw className="animate-spin w-4 h-4" /> : 'Run Recon Engine'}
        </button>
      </div>

      {hasDrift && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-red-800 font-bold">SYSTEM DRIFT DETECTED</h3>
            <p className="text-red-700 text-sm mt-1">
              Internal ledger balances do not match external bank statements by <strong className="font-mono">${currentDrift.toFixed(2)}</strong>. 
              Review exceptions below to issue adjustments.
            </p>
          </div>
        </motion.div>
      )}

      {/* Exceptions Table */}
      <div className="mt-4">
        <div className="flex justify-between items-end mb-3">
          <h3 className="font-bold text-slate-900">Active Exceptions</h3>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setActiveExceptionFilter('UNRESOLVED')} className={`text-xs px-3 py-1.5 rounded-md font-medium ${activeExceptionFilter === 'UNRESOLVED' ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Unresolved</button>
            <button onClick={() => setActiveExceptionFilter('ALL')} className={`text-xs px-3 py-1.5 rounded-md font-medium ${activeExceptionFilter === 'ALL' ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>All</button>
          </div>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium">
                <tr>
                  <th className="px-4 py-3">Internal TX ID</th>
                  <th className="px-4 py-3">Bank Ref</th>
                  <th className="px-4 py-3">Mismatch Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-400">Loading audit trail...</td></tr>
                ) : filteredExceptions.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-500">✅ Ledger is perfectly reconciled.</td></tr>
                ) : (
                  <AnimatePresence>
                    {filteredExceptions.map((ex) => (
                      <motion.tr 
                        key={ex.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs">{ex.transaction_id || 'PHANTOM_EXT'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{ex.bank_reference || 'MISSING_AT_BANK'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded inline-flex text-xs font-semibold
                            ${ex.mismatch_type === 'PHANTOM' ? 'bg-amber-100 text-amber-800' : 
                              ex.mismatch_type === 'AMOUNT_MISMATCH' ? 'bg-purple-100 text-purple-800' : 
                              'bg-rose-100 text-rose-800'}`}>
                            {ex.mismatch_type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {ex.resolved === 'YES' ? 
                            <span className="flex items-center gap-1 text-wise-green font-medium"><CheckCircle className="w-4 h-4" /> Reconciled</span> : 
                            <span className="text-red-500 font-medium flex items-center gap-1"><AlertTriangle className="w-4 h-4"/> Blocked</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          {ex.resolved === 'NO' && (
                            <button 
                              onClick={() => forceResolve.mutate(ex.id)}
                              disabled={forceResolve.isPending}
                              className="text-wise hover:text-wise-light font-semibold bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                            >
                              Force Reconcile
                            </button>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
