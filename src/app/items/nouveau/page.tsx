'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { ItemForm } from '@/components/ui/ItemForm'
import { createCatalogItem } from '@/lib/itemsApi'
import { copy } from '@/lib/copy'

export default function NewItemPage() {
  const router = useRouter()

  return (
    <div className="space-y-4">
      <PageHeader title="Nouvel item (Items)" />
      <ItemForm
        panelClassName="border-slate-700 bg-slate-900 shadow-[0_20px_45px_rgba(0,0,0,0.45)]"
        hideTitle
        onCancel={() => router.push('/items')}
        onSave={async (payload) => {
          try {
            await createCatalogItem(payload)
            toast.success('Item créé.')
            router.push('/items')
            router.refresh()
          } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : copy.itemForm.errors.createFailed)
            throw error
          }
        }}
      />
    </div>
  )
}
