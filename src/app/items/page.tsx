import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import ItemsClient from './ui/ItemsClient'

const allowedCategories = new Set(['all', 'objects', 'weapons', 'equipment', 'drugs', 'custom'])

export default function ItemsPage({ searchParams }: { searchParams?: { action?: string; category?: string } }) {
  const action = searchParams?.action
  const rawCategory = searchParams?.category?.toLowerCase() || 'all'
  const initialCategory = allowedCategories.has(rawCategory) ? rawCategory : 'all'
  if (action === 'create') redirect('/items/nouveau')
  if (action === 'trade') redirect('/items/achat-vente')

  return (
    <div className="space-y-4">
      <PageHeader title="Catalogue global d’items" />
      <ItemsClient initialCategory={initialCategory as 'all' | 'objects' | 'weapons' | 'equipment' | 'drugs' | 'custom'} />
    </div>
  )
}
