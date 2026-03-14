'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { FinanceItemTradeModal } from '@/components/ui/FinanceItemTradeModal'
import { createFinanceTransaction, listCatalogItemsUnified } from '@/lib/itemsApi'
import type { CatalogItem } from '@/lib/types/itemsFinance'
import { copy } from '@/lib/copy'

export default function FinanceItemTradePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [initialItems, setInitialItems] = useState<CatalogItem[]>([])
  const initialMode: 'buy' | 'sell' = searchParams.get('mode') === 'sell' ? 'sell' : 'buy'

  useEffect(() => {
    void listCatalogItemsUnified()
      .then(setInitialItems)
      .catch(() => setInitialItems([]))
  }, [])

  return (
    <div className="space-y-4">
      <FinanceItemTradeModal
        inline
        open
        mode={initialMode}
        enableModeSelect
        hideTitle
        onModeChange={(nextMode) => {
          const params = new URLSearchParams(searchParams.toString())
          params.set('mode', nextMode)
          router.replace(`/finance/achat-vente?${params.toString()}`)
        }}
        initialItems={initialItems}
        onClose={() => router.push('/finance')}
        onSubmit={async (payload) => {
          await createFinanceTransaction({
            item_id: payload.item.id,
            mode: payload.mode,
            quantity: payload.quantity,
            unit_price: payload.unitPrice,
            counterparty: payload.counterparty,
            notes: payload.notes,
          })
          toast.success(copy.finance.toastSaved)
          router.push('/finance')
          router.refresh()
        }}
      />
    </div>
  )
}
