import { Suspense } from 'react'
import DepensesClient from '@/app/depenses/ui/DepensesClient'

export default function FinanceDepensesPage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense
        fallback={
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60 shadow-glow">
            Chargement…
          </div>
        }
      >
        <DepensesClient
          title="Dépenses (Finance)"
          newExpenseHref="/finance/depense/nouveau"
          backHref="/finance"
          detailsBaseHref="/finance/transactions/expenses"
          hideInlineActions
        />
      </Suspense>
    </div>
  )
}
