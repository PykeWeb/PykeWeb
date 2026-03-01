import { PageHeader } from '@/components/PageHeader'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { NewWeaponForm } from './ui/NewWeaponForm'

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ajouter une arme"
        subtitle="Nom • ID • image (upload/coller) • description (optionnel)"
        actions={
          <Link href="/armes">
            <Button variant="secondary">Retour</Button>
          </Link>
        }
      />
      <NewWeaponForm />
    </div>
  )
}
