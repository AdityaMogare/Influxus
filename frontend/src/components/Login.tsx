import React, { useState } from 'react';
import { Mail, Phone, ArrowRight, ShieldCheck, KeyRound, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../api';

export default function Login({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!identifier) {
      setError('Please enter a valid email or phone number');
      return;
    }
    
    setIsLoading(true);
    try {
      await api.requestOtp(identifier);
      setStep('verify');
    } catch (err: any) {
      setError(err.message || 'Failed to request OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setIsLoading(true);
    try {
      await api.verifyOtp(identifier, otp);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 relative overflow-hidden font-outfit">
      {/* Background Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-wise/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-500/20 blur-[120px] pointer-events-none" />
      
      {/* Container */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md p-8 sm:p-12 mx-4 bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]"
      >
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-wise to-emerald-400 rounded-2xl flex items-center justify-center shadow-lg shadow-wise/30">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
        </div>

        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">
            Influxus
          </h1>
          <p className="text-slate-400 text-lg">Stakeholder Portal</p>
        </div>

        <AnimatePresence mode="wait">
          {step === 'request' ? (
            <motion.form 
              key="request-form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleRequestOtp} 
              className="space-y-6"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Email or Phone Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="w-5 h-5 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="stakeholder@influxus.com"
                    className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-wise/50 focus:border-wise transition-all placeholder:text-slate-600"
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <Phone className="w-4 h-4 text-slate-600" />
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                   <div className="w-1 h-1 rounded-full bg-red-400" />
                   {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !identifier}
                className="w-full relative group overflow-hidden bg-white text-slate-900 rounded-xl py-4 font-bold transition-all hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-slate-200/50 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                <span className="flex items-center justify-center gap-2 relative z-10">
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      Continue securely
                      <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </span>
              </button>
            </motion.form>
          ) : (
            <motion.form 
              key="verify-form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleVerifyOtp} 
              className="space-y-6"
            >
              <div className="text-center mb-6">
                 <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-wise/10 text-wise mb-4">
                    <ShieldCheck className="w-6 h-6" />
                 </div>
                 <p className="text-slate-300 text-sm">We sent a secure code to</p>
                 <p className="text-white font-medium">{identifier}</p>
                 <button 
                   type="button" 
                   onClick={() => setStep('request')}
                   className="text-wise hover:text-wise-light text-xs mt-2 transition-colors font-medium"
                 >
                   Wrong identifier? Edit
                 </button>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <KeyRound className="w-5 h-5 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Enter 6-digit OTP"
                    maxLength={6}
                    className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-wise/50 focus:border-wise transition-all text-center tracking-[0.5em] text-2xl font-bold placeholder:text-slate-600 placeholder:tracking-normal placeholder:font-normal placeholder:text-base"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                   <div className="w-1 h-1 rounded-full bg-red-400" />
                   {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                className="w-full relative group overflow-hidden bg-wise text-white rounded-xl py-4 font-bold transition-all hover:bg-wise-light disabled:opacity-50 disabled:cursor-not-allowed mt-4 shadow-lg shadow-wise/20"
              >
                <span className="flex items-center justify-center gap-2 relative z-10">
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify & Log In
                      <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </span>
              </button>
            </motion.form>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
}
