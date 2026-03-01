import { Suspense } from 'react'
import { PageHeader } from '@/components/PageHeader'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { WeaponLoansClient } from './ui/WeaponLoansClient'

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Prêts d’armes"
        subtitle="Retrouver et terminer rapidement les prêts en cours"
        actions={
          <>
            <Link href="/armes">
              <Button variant="secondary">Retour</Button>
            </Link>
            <Link href="/armes/prets/nouveau">
              <Button>Créer un prêt</Button>
            </Link>
          </>
        }
      />
      <Suspense
        fallback={
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60 shadow-glow">Chargement…</div>
        }
      >
        <WeaponLoansClient />
      </Suspense>
    </div>
  )
}
