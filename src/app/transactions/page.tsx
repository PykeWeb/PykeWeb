import { Suspense } from 'react'
import TransactionsClient from './TransactionsClient'

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60 shadow-glow">
          Chargement…
        </div>
      }
    >
      <TransactionsClient />
    </Suspense>
  )
}
