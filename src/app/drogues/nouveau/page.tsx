import { Suspense } from 'react'
import NouveauDrogueClient from './ui/NouveauDrogueClient'

// useSearchParams() requires a Suspense boundary in the App Router.
export default function NouveauDroguePage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/60 shadow-glow">
          Chargement…
        </div>
      }
    >
      <NouveauDrogueClient />
    </Suspense>
  )
}
