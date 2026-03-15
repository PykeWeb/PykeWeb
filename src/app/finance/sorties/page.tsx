'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FinanceItemTradeModal } from '@/components/ui/FinanceItemTradeModal'
import { markStockOutNote } from '@/lib/financeStockFlow'
import { createFinanceTransaction, listCatalogItemsUnified } from '@/lib/itemsApi'
import type { CatalogItem } from '@/lib/types/itemsFinance'
import { copy } from '@/lib/copy'

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
        titleOverride={copy.finance.stockFlow.stockOutTitle}
        subtitleOverride={copy.finance.stockFlow.stockOutSubtitle}
        showModeBadge={false}
        initialItems={initialItems}
        onClose={() => router.push('/finance')}
        onSubmit={async (payload) => {
          const reason = payload.notes?.trim() || ''
          if (!reason) {
            throw new Error(copy.finance.stockFlow.stockOutReasonRequired)
          }

          await createFinanceTransaction({
            item_id: payload.item.id,
            mode: 'sell',
            quantity: payload.quantity,
            unit_price: 0,
            counterparty: payload.counterparty,
            notes: markStockOutNote(reason),
            payment_mode: 'other',
          })
          toast.success(copy.finance.stockFlow.stockOutSaved)
          router.push('/finance')
          router.refresh()
        }}
      />
    </div>
  )
}
