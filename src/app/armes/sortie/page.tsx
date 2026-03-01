import { Suspense } from 'react'
import { PageHeader } from '@/components/PageHeader'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { WeaponOutForm } from './ui/WeaponOutForm'

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sortie d’arme"
        subtitle="Perte / vente / transfert : retirer du stock"
        actions={
          <Link href="/armes">
            <Button variant="secondary">Retour</Button>
          </Link>
        }
      />
      <Suspense
        fallback={
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60 shadow-glow">Chargement…</div>
        }
      >
        <WeaponOutForm />
      </Suspense>
    </div>
  )
}
