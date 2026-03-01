import { Suspense } from 'react'
import TransactionNewClient from './TransactionNewClient'

export default function Page({
  searchParams,
}: {
  searchParams: { type?: string }
}) {
  const type = searchParams?.type === 'sale' ? 'sale' : 'purchase'
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60 shadow-glow">
          Chargement…
        </div>
      }
    >
      <TransactionNewClient type={type} />
    </Suspense>
  )
}
