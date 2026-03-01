import { PageHeader } from '@/components/PageHeader'
import ReglagesClient from './ui/ReglagesClient'

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Réglages" subtitle="Modifier les textes (menu, titres) — sauvegarde en base" />
      <ReglagesClient />
    </div>
  )
}
