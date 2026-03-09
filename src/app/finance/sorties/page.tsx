'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FinanceItemTradeModal } from '@/components/ui/FinanceItemTradeModal'
import { createFinanceTransaction, listCatalogItemsUnified } from '@/lib/itemsApi'
import type { CatalogItem } from '@/lib/types/itemsFinance'

export default function FinanceSortiesPage() {
  const router = useRouter()
  const [initialItems, setInitialItems] = useState<CatalogItem[]>([])

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
        mode="sell"
        hideUnitPrice
        initialItems={initialItems}
        onClose={() => router.push('/finance')}
        onSubmit={async (payload) => {
          const reason = payload.notes?.trim() || ''
          if (!reason) {
            throw new Error('Raison obligatoire pour une sortie de stock.')
          }

          await createFinanceTransaction({
            item_id: payload.item.id,
            mode: 'sell',
            quantity: payload.quantity,
            unit_price: 0,
            counterparty: payload.counterparty,
            notes: reason,
            payment_mode: 'stock_out',
          })
          toast.success('Sortie de stock enregistrée.')
          router.push('/finance')
          router.refresh()
        }}
      />
    </div>
  )
}
