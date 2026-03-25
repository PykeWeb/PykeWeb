'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { FinanceItemTradeModal } from '@/components/ui/FinanceItemTradeModal'
import { createFinanceTransaction, listCatalogItemsUnified } from '@/lib/itemsApi'
import type { CatalogItem } from '@/lib/types/itemsFinance'
import { copy } from '@/lib/copy'
import { markStockInNote, markStockOutNote } from '@/lib/financeStockFlow'
import { getTenantSession, isSbTenantSession } from '@/lib/tenantSession'
import { SbEntreeSortieClient } from '@/components/modules/sb/SbEntreeSortieClient'

export default function FinanceEntreeSortiePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [initialItems, setInitialItems] = useState<CatalogItem[]>([])
  const [isSbGroup, setIsSbGroup] = useState(false)
  const initialMode: 'buy' | 'sell' = searchParams.get('mode') === 'sell' ? 'sell' : 'buy'

  useEffect(() => {
    const session = getTenantSession()
    setIsSbGroup(isSbTenantSession(session))

    void listCatalogItemsUnified()
      .then(setInitialItems)
      .catch(() => setInitialItems([]))
  }, [])

  if (isSbGroup) {
    return <SbEntreeSortieClient />
  }

  return (
    <div className="space-y-4">
      <FinanceItemTradeModal
        inline
        open
        mode={initialMode}
        enableModeSelect
        hideTitle
        hideUnitPrice
        showModeBadge={false}
        modeBuyLabel={copy.finance.stockFlow.stockInModeLabel}
        modeSellLabel={copy.finance.stockFlow.stockOutModeLabel}
        onModeChange={(nextMode) => {
          const params = new URLSearchParams(searchParams.toString())
          params.set('mode', nextMode)
          router.replace(`/finance/entree-sortie?${params.toString()}`)
        }}
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
            notes: payload.mode === 'buy' ? markStockInNote(reason) : markStockOutNote(reason),
            payment_mode: 'other',
          })

          toast.success(payload.mode === 'buy' ? copy.finance.stockFlow.stockInSaved : copy.finance.stockFlow.stockOutSaved)
          router.push('/finance')
          router.refresh()
        }}
      />
    </div>
  )
}
