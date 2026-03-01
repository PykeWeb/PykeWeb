import { Suspense } from 'react'
import { PageHeader } from '@/components/PageHeader'
import DepensesClient from './ui/DepensesClient'

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dépenses"
        subtitle="Remboursements des membres : preuve + statut (en attente / remboursé)"
      />

      <Suspense
        fallback={
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60 shadow-glow">
            Chargement…
          </div>
        }
      >
        <DepensesClient />
      </Suspense>
    </div>
  )
}
