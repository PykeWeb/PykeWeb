export type FinanceEntrySource = 'finance_transactions' | 'transactions' | 'expenses'

export type FinanceEntryMovementKind = 'expense' | 'purchase' | 'stock_in' | 'sale' | 'stock_out'

export type FinanceEntryDetailLine = {
  name: string
  quantity: number
  unit_price: number
  total: number
  image_url: string | null
}

export type FinanceEntryDetail = {
  id: string
  source: FinanceEntrySource
  display_name: string
  movement_kind: FinanceEntryMovementKind
  created_at: string
  counterparty: string | null
  notes: string | null
  payment_mode: string | null
  quantity: number
  total: number
  is_multi: boolean
  expense_status?: 'pending' | 'paid' | null
  expense_id?: string | null
  lines: FinanceEntryDetailLine[]
}

export type FinanceEntryDetailResponse = {
  source: FinanceEntrySource
  entry: FinanceEntryDetail
}
