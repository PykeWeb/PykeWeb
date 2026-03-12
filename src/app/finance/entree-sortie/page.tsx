'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FinanceItemTradeModal } from '@/components/ui/FinanceItemTradeModal'
import { createFinanceTransaction, listCatalogItemsUnified } from '@/lib/itemsApi'
import type { CatalogItem } from '@/lib/types/itemsFinance'
import { copy } from '@/lib/copy'
import { markStockInNote } from '@/lib/financeStockFlow'

export default function FinanceEntreeSortiePage() {
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
        enableModeSelect
        hideUnitPrice
        titleOverride={copy.finance.stockFlow.stockInOutButton}
        subtitleOverride={copy.finance.stockFlow.stockInSubtitle}
        showModeBadge={false}
        modeBuyLabel={copy.finance.stockFlow.stockInModeLabel}
        modeSellLabel={copy.finance.stockFlow.stockOutModeLabel}
        initialItems={initialItems}
        onClose={() => router.push('/finance')}
        onSubmit={async (payload) => {
          const reason = payload.notes?.trim() || ''
          if (!reason) {
            throw new Error(
              payload.mode === 'buy'
                ? copy.finance.stockFlow.stockInReasonRequired
                : copy.finance.stockFlow.stockOutReasonRequired,
            )
          }

          await createFinanceTransaction({
            item_id: payload.item.id,
            mode: payload.mode,
            quantity: payload.quantity,
            unit_price: 0,
            counterparty: payload.counterparty,
            notes: payload.mode === 'buy' ? markStockInNote(reason) : reason,
            payment_mode: payload.mode === 'buy' ? 'other' : 'stock_out',
          })

          toast.success(payload.mode === 'buy' ? copy.finance.stockFlow.stockInSaved : copy.finance.stockFlow.stockOutSaved)
          router.push('/finance')
          router.refresh()
        }}
      />
    </div>
  )
}
