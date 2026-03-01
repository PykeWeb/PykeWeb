import { Suspense } from 'react'
import { PageHeader } from '@/components/PageHeader'
import DroguesClient from './ui/DroguesClient'

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Drogues"
        subtitle="Catalogue + stock + plantations (recettes & production)"
      />

      <Suspense
        fallback={
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60 shadow-glow">
            Chargement…
          </div>
        }
      >
        <DroguesClient />
      </Suspense>
    </div>
  )
}
