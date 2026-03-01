import { Suspense } from 'react'
import { PageHeader } from '@/components/PageHeader'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { DashboardClient } from './ui/DashboardClient'

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        subtitle="Vue globale : objets, transactions, armes et prêts"
        actions={
          <>
            <Link href="/objets">
              <Button variant="secondary">Objets</Button>
            </Link>
            <Link href="/armes">
              <Button variant="secondary">Armes</Button>
            </Link>
          </>
        }
      />

      <Suspense
        fallback={
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70 shadow-glow">
            Chargement…
          </div>
        }
      >
        <DashboardClient />
      </Suspense>
    </div>
  )
}
