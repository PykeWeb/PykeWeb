import { Suspense } from 'react'
import ItemsClient from '@/app/items/ui/ItemsClient'

export default function DroguesPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60 shadow-glow">
          Chargement…
        </div>
      }
    >
      <ItemsClient defaultView="tools" />
    </Suspense>
  )
}
