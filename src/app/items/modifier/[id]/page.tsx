'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ItemForm } from '@/components/ui/ItemForm'
import { listCatalogItemsUnified, updateCatalogItem } from '@/lib/itemsApi'
import type { CatalogItem } from '@/lib/types/itemsFinance'

export default function EditItemPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [items, setItems] = useState<CatalogItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const rows = await listCatalogItemsUnified(true)
        setItems(rows)
      } catch (loadError: unknown) {
        setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les items.')
      }
    }
    void load()
  }, [])

  const item = useMemo(() => {
    if (!items) return null
    return items.find((entry) => entry.id === params.id) ?? null
  }, [items, params.id])

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</div>
      </div>
    )
  }

  if (!items) return <p className="text-sm text-white/70">Chargement…</p>
  if (!item) return <p className="text-sm text-white/70">Item introuvable.</p>

  return (
    <div className="space-y-4">
      <ItemForm
        initialItem={item}
        submitLabel="Enregistrer les modifications"
        panelClassName="border-slate-700 bg-slate-900 shadow-[0_20px_45px_rgba(0,0,0,0.45)]"
        onCancel={() => router.push('/items')}
        onSave={async (payload) => {
          try {
            await updateCatalogItem({ ...payload, id: item.id })
            toast.success('Item modifié.')
            router.push('/items')
            router.refresh()
          } catch (saveError: unknown) {
            toast.error(saveError instanceof Error ? saveError.message : "Impossible de modifier l'item.")
            throw saveError
          }
        }}
      />
    </div>
  )
}
