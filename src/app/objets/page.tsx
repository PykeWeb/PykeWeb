import { Suspense } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import ObjetsClient from './ObjetsClient'

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Objets"
        subtitle="Catalogue + stock + transactions (achats / sorties)"
        actions={
          <>
            <Link href="/objets?tab=transactions">
              <Button variant="secondary">Transactions</Button>
            </Link>
            <Link href="/objets/nouveau">
              <Button>Ajouter</Button>
            </Link>
          </>
        }
      />

      <Suspense
        fallback={
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60 shadow-glow">
            Chargement…
          </div>
        }
      >
        <ObjetsClient />
      </Suspense>
    </div>
  )
}
