import { PageHeader } from '@/components/PageHeader'
import { NewWeaponForm } from './ui/NewWeaponForm'

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ajouter une arme"
        subtitle="Nom • ID • image (upload/coller) • description (optionnel)"
      />
      <NewWeaponForm />
    </div>
  )
}
