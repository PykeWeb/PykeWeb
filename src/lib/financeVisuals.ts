import type { FinanceMovementType } from '@/lib/financeApi'

export const FINANCE_MULTI_BUY_IMAGE = '/images/finance/multi-buy.svg'
export const FINANCE_MULTI_SALE_IMAGE = '/images/finance/multi-sale.svg'
export const FINANCE_EXPENSE_IMAGE = '/images/finance/multi-expense.svg'

export function getFinanceListImage(args: {
  movementType: FinanceMovementType
  category?: 'custom' | string | null
  isMulti?: boolean
  itemImageUrl?: string | null
}) {
  if (args.movementType === 'expense' && (args.isMulti || args.category === 'custom')) {
    return FINANCE_EXPENSE_IMAGE
  }

  if (args.isMulti) {
    if (args.movementType === 'purchase') return FINANCE_MULTI_BUY_IMAGE
    if (args.movementType === 'sale') return FINANCE_MULTI_SALE_IMAGE
  }
  return args.itemImageUrl || null
}
