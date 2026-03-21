import { useState } from 'react'
import Calculator from './components/Calculator.tsx'
import Stepper from './components/Stepper.tsx'
import TransactionHistory from './components/TransactionHistory.tsx'
import JarsPanel from './components/JarsPanel.tsx'
import BudgetDashboard from './components/BudgetDashboard.tsx'
import PortfolioView from './components/PortfolioView.tsx'

function App() {
  const [activeTxId, setActiveTxId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'send' | 'jars' | 'budget' | 'invest'>('send');

  const tabs = [
    { id: 'send', label: 'Send Money' },
    { id: 'jars', label: 'Jars' },
    { id: 'budget', label: 'Budgeting' },
    { id: 'invest', label: 'Invest' }
  ];

  return (
    <div className="min-h-screen p-4 sm:p-8 flex flex-col items-center bg-slate-50">
      <header className="w-full max-w-5xl flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-wise to-wise-light tracking-tight">
          Influxus
        </h1>
        
        {/* Navigation Tabs */}
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100 overflow-x-auto w-full sm:w-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-wise text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>
      
      <main className="w-full max-w-5xl mt-4">
        {activeTab === 'send' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 flex flex-col gap-8">
              <Calculator onTransferStart={setActiveTxId} />
            </div>
            <div className="lg:col-span-7 flex flex-col gap-8">
              {activeTxId && <Stepper txId={activeTxId} />}
              <TransactionHistory />
            </div>
          </div>
        )}

        {activeTab === 'jars' && (
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
             <JarsPanel accountId={1} />
             <div className="glass-panel p-8 text-slate-500 flex flex-col justify-center items-center text-center">
                <h3 className="text-xl font-bold text-slate-900 mb-2">Virtual Account Partitioning</h3>
                <p>Move funds instantly and without fees in your Jars. Jars are fenced off so your checking account spending never touches your savings.</p>
             </div>
           </div>
        )}

        {activeTab === 'budget' && (
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
             <BudgetDashboard accountId={1} />
             <div className="glass-panel p-8 text-slate-500 flex flex-col justify-center items-center text-center">
                <h3 className="text-xl font-bold text-slate-900 mb-2">Rule-Based Fencing</h3>
                <p>Track your spending vs your limits dynamically. Every transaction is automatically categorized by our engine when processed through the ledger.</p>
             </div>
           </div>
        )}

        {activeTab === 'invest' && (
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
             <PortfolioView accountId={1} />
             <div className="glass-panel p-8 text-slate-500 flex flex-col justify-center items-center text-center">
                <h3 className="text-xl font-bold text-slate-900 mb-2">Unit-Based Accounting</h3>
                <p>This transforms the ledger from tracking Cents to tracking Units. Watch real-time market fluctuations update your portfolio via the background Python worker.</p>
             </div>
           </div>
        )}
      </main>
    </div>
  )
}

export default App
