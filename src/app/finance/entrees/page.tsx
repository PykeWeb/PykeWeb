'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FinanceItemTradeModal } from '@/components/ui/FinanceItemTradeModal'
import { createFinanceTransaction, listCatalogItemsUnified } from '@/lib/itemsApi'
import type { CatalogItem } from '@/lib/types/itemsFinance'
import { copy } from '@/lib/copy'

export default function FinanceEntreesPage() {
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
        mode="buy"
        hideUnitPrice
        titleOverride={copy.finance.stockFlow.stockInTitle}
        subtitleOverride={copy.finance.stockFlow.stockInSubtitle}
        showModeBadge={false}
        initialItems={initialItems}
        onClose={() => router.push('/finance')}
        onSubmit={async (payload) => {
          const reason = payload.notes?.trim() || ''
          if (!reason) {
            throw new Error(copy.finance.stockFlow.stockInReasonRequired)
          }

          await createFinanceTransaction({
            item_id: payload.item.id,
            mode: 'buy',
            quantity: payload.quantity,
            unit_price: 0,
            counterparty: payload.counterparty,
            notes: reason,
            payment_mode: 'other',
          })
          toast.success(copy.finance.stockFlow.stockInSaved)
          router.push('/finance')
          router.refresh()
        }}
      />
    </div>
  )
}
