import { useState } from 'react'
import Calculator from './components/Calculator.tsx'
import Stepper from './components/Stepper.tsx'
import TransactionHistory from './components/TransactionHistory.tsx'

function App() {
  const [activeTxId, setActiveTxId] = useState<number | null>(null);

  return (
    <div className="min-h-screen p-4 sm:p-8 flex flex-col items-center bg-slate-50">
      <header className="w-full max-w-5xl flex justify-between items-center mb-10">
        <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-wise to-wise-light tracking-tight">
          Influxus
        </h1>
      </header>

      <main className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 flex flex-col gap-8">
          <Calculator onTransferStart={setActiveTxId} />
        </div>

        <div className="lg:col-span-7 flex flex-col gap-8">
          {activeTxId && <Stepper txId={activeTxId} />}
          <TransactionHistory />
        </div>
      </main>
    </div>
  )
}

export default App
