import { Suspense } from 'react'
import { PageHeader } from '@/components/PageHeader'
import EquipementClient from './ui/EquipementClient'

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Équipement" subtitle="Catalogue + stock + achats / sorties (revente aux joueurs)" />

      <Suspense
        fallback={
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60 shadow-glow">
            Chargement…
          </div>
        }
      >
        <EquipementClient />
      </Suspense>
    </div>
  )
}
