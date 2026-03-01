import { Suspense } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { ArmesClient } from './ui/ArmesClient'

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Armes"
        subtitle="Catalogue et stock (sans prix) + prêts aux membres"
      />
      <Suspense
        fallback={
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60 shadow-glow">Chargement…</div>
        }
      >
        <ArmesClient />
      </Suspense>
    </div>
  )
}
