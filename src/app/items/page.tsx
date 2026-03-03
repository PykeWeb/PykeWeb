import { PageHeader } from '@/components/PageHeader'
import ItemsClient from './ui/ItemsClient'

export default function ItemsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Catalogue global d’items" subtitle="Objets, armes, équipement et drogues." />
      <ItemsClient />
    </div>
  )
}
