import { Suspense } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { NewWeaponLoanForm } from './ui/NewWeaponLoanForm'

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Créer un prêt"
        subtitle="Sélectionner l’arme • le membre • la quantité"
      />
      <Suspense
        fallback={
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60 shadow-glow">Chargement…</div>
        }
      >
        <NewWeaponLoanForm />
      </Suspense>
    </div>
  )
}
