import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import ItemsClient from './ui/ItemsClient'

export default function ItemsPage({ searchParams }: { searchParams?: { action?: string } }) {
  const action = searchParams?.action
  if (action === 'create') redirect('/items/nouveau')
  if (action === 'trade') redirect('/items/achat-vente')

  return (
    <div className="space-y-4">
      <PageHeader title="Catalogue global d’items" subtitle="Objets, armes, équipement et drogues." />
      <ItemsClient />
    </div>
  )
}
