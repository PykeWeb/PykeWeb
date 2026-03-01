import { Suspense } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { ArmesClient } from './ui/ArmesClient'

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Armes"
        subtitle="Catalogue et stock (sans prix) + prêts aux membres"
        actions={
          <>
            <Link href="/armes/prets">
              <Button variant="secondary">Prêts en cours</Button>
            </Link>
            <Link href="/armes/nouveau">
              <Button>Ajouter</Button>
            </Link>
          </>
        }
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
