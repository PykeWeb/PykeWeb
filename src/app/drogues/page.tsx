import { Suspense } from 'react'
import { PageHeader } from '@/components/PageHeader'
import ItemsClient from '@/app/items/ui/ItemsClient'

export default function DroguesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Drogues" subtitle="Calculateur drogue (Items) + contenu plantations" />
      <Suspense
        fallback={
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60 shadow-glow">
            Chargement…
          </div>
        }
      >
        <ItemsClient defaultView="tools" />
      </Suspense>
    </div>
  )
}
