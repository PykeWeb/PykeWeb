'use client'

import { ActivitiesCategoryTabs } from '@/components/activities/ActivitiesCategoryTabs'
import { NouvelleDepenseForm } from '@/components/ui/NouvelleDepenseForm'

export default function NouvelleDepenseActivitesPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-glow">
        <ActivitiesCategoryTabs active="depense" />
      </div>
      <NouvelleDepenseForm backHref="/activites" successHref="/activites" title="" actionsPlacement="top-right" />
    </div>
  )
}
