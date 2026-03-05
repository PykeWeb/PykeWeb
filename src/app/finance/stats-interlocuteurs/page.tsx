import { PageHeader } from '@/components/PageHeader'
import CounterpartyStatsClient from '../ui/CounterpartyStatsClient'

export default function FinanceCounterpartyStatsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Stats interlocuteurs"
        subtitle="Analyse des dépenses, achats et ventes par interlocuteur."
      />
      <CounterpartyStatsClient />
    </div>
  )
}
