import { AppFrame } from '@/components/layout/AppFrame'
import { PageHeader } from '@/components/PageHeader'
import ItemsClient from './ui/ItemsClient'

export default function ItemsPage() {
  return (
    <AppFrame>
      <PageHeader title="Catalogue global d’items" subtitle="Vue globale + création rapide." />
      <ItemsClient />
    </AppFrame>
  )
}
