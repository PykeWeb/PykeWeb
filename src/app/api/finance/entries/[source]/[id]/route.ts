import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { FinanceEntryDetail, FinanceEntryDetailLine, FinanceEntryDetailResponse, FinanceEntrySource } from '@/lib/types/financeDetail'
import { requireGroupSession } from '@/server/auth/requireSession'

type RouteParams = { params: { source: string; id: string } }

type FinanceTransactionRow = {
  id: string
  mode: 'buy' | 'sell' | null
  quantity: number | null
  unit_price: number | null
  total: number | null
  counterparty: string | null
  payment_mode: string | null
  notes: string | null
  created_at: string
  catalog_items: { name: string | null; image_url: string | null } | { name: string | null; image_url: string | null }[] | null
}

type TransactionItemRow = {
  name_snapshot: string | null
  quantity: number | null
  unit_price: number | null
  total: number | null
  image_url_snapshot: string | null
}

type TransactionRow = {
  id: string
  type: 'purchase' | 'sale' | null
  counterparty: string | null
  total: number | null
  notes: string | null
  created_at: string
  transaction_items: TransactionItemRow[] | null
}

type ExpenseRow = {
  id: string
  member_name: string | null
  item_label: string
  quantity: number | null
  unit_price: number | null
  total: number | null
  description: string | null
  created_at: string
  proof_image_url: string | null
  status: 'pending' | 'paid' | null
}

function toSafeNumber(value: number | null | undefined): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function sumQuantity(lines: FinanceEntryDetailLine[]): number {
  const quantity = lines.reduce((sum, line) => sum + Math.max(0, toSafeNumber(line.quantity)), 0)
  return quantity > 0 ? quantity : 1
}

function sumTotal(lines: FinanceEntryDetailLine[]): number {
  return lines.reduce((sum, line) => sum + Math.max(0, toSafeNumber(line.total)), 0)
}

function buildResponse(source: FinanceEntrySource, entry: FinanceEntryDetail): NextResponse<FinanceEntryDetailResponse> {
  return NextResponse.json({ source, entry })
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseGroupedFinanceTransactionIds(rawId: string): string[] {
  if (!rawId.startsWith('group:')) return []
  return rawId
    .slice('group:'.length)
    .split(',')
    .map((id) => id.trim())
    .filter((id) => UUID_RE.test(id))
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await requireGroupSession(request)
    const source = params.source
    const id = decodeURIComponent(params.id)
    const supabase = getSupabaseAdmin()

    if (source === 'finance_transactions') {
      const groupedIds = parseGroupedFinanceTransactionIds(id)
      const baseQuery = supabase
        .from('finance_transactions')
        .select('id,mode,quantity,unit_price,total,counterparty,payment_mode,notes,created_at,catalog_items(name,image_url)')
        .eq('group_id', session.groupId)

      const query = groupedIds.length > 0 ? baseQuery.in('id', groupedIds) : baseQuery.eq('id', id)
      const { data, error } = await query.order('created_at', { ascending: true })

      if (error || !data || data.length === 0) return NextResponse.json({ error: error?.message || 'Transaction introuvable' }, { status: 404 })

      const rows = data as FinanceTransactionRow[]
      const lines = rows.map((row) => {
        const joinedItem = Array.isArray(row.catalog_items) ? (row.catalog_items[0] ?? null) : row.catalog_items
        const quantity = Math.max(1, toSafeNumber(row.quantity))
        const unitPrice = Math.max(0, toSafeNumber(row.unit_price))
        const lineTotal = Math.max(0, toSafeNumber(row.total || quantity * unitPrice))
        return {
          name: joinedItem?.name || 'Item',
          quantity,
          unit_price: unitPrice,
          total: lineTotal,
          image_url: joinedItem?.image_url || null,
        } satisfies FinanceEntryDetailLine
      })

      const first = rows[0]
      const isMulti = lines.length > 1
      return buildResponse('finance_transactions', {
        id,
        source: 'finance_transactions',
        display_name: isMulti ? 'Transaction multiple' : lines[0].name,
        movement_kind: first.mode === 'sell' ? 'sale' : 'purchase',
        created_at: first.created_at,
        counterparty: first.counterparty,
        notes: first.notes,
        payment_mode: first.payment_mode,
        quantity: sumQuantity(lines),
        total: sumTotal(lines),
        is_multi: isMulti,
        expense_status: null,
        expense_id: null,
        lines,
      })
    }


    if (source === 'transactions') {
      const { data, error } = await supabase
        .from('transactions')
        .select('id,type,counterparty,total,notes,created_at,transaction_items(name_snapshot,quantity,unit_price,total,image_url_snapshot)')
        .eq('group_id', session.groupId)
        .eq('id', id)
        .single<TransactionRow>()

      if (error || !data) return NextResponse.json({ error: error?.message || 'Transaction introuvable' }, { status: 404 })

      const lines = ((data.transaction_items ?? []) as TransactionItemRow[]).map((item) => {
        const quantity = Math.max(1, toSafeNumber(item.quantity))
        const unitPrice = Math.max(0, toSafeNumber(item.unit_price))
        const total = Math.max(0, toSafeNumber(item.total || quantity * unitPrice))
        return {
          name: (item.name_snapshot || 'Item').trim() || 'Item',
          quantity,
          unit_price: unitPrice,
          total,
          image_url: item.image_url_snapshot,
        } satisfies FinanceEntryDetailLine
      })

      const normalizedLines = lines.length > 0
        ? lines
        : [{ name: 'Transaction', quantity: 1, unit_price: 0, total: Math.max(0, toSafeNumber(data.total)), image_url: null }]

      const displayName = normalizedLines.length > 1 ? 'Transaction multiple' : normalizedLines[0].name
      const total = Math.max(0, toSafeNumber(data.total || sumTotal(normalizedLines)))

      return buildResponse('transactions', {
        id: data.id,
        source: 'transactions',
        display_name: displayName,
        movement_kind: data.type === 'sale' ? 'sale' : 'purchase',
        created_at: data.created_at,
        counterparty: data.counterparty,
        notes: data.notes,
        payment_mode: null,
        quantity: sumQuantity(normalizedLines),
        total,
        is_multi: normalizedLines.length > 1,
        expense_status: null,
        expense_id: null,
        lines: normalizedLines,
      })
    }

    if (source === 'expenses') {
      const { data, error } = await supabase
        .from('expenses')
        .select('id,member_name,item_label,quantity,unit_price,total,description,created_at,proof_image_url,status')
        .eq('group_id', session.groupId)
        .eq('id', id)
        .single<ExpenseRow>()

      if (error || !data) return NextResponse.json({ error: error?.message || 'Dépense introuvable' }, { status: 404 })

      const line: FinanceEntryDetailLine = {
        name: data.item_label || 'Dépense',
        quantity: Math.max(1, toSafeNumber(data.quantity)),
        unit_price: Math.max(0, toSafeNumber(data.unit_price)),
        total: Math.max(0, toSafeNumber(data.total || toSafeNumber(data.quantity) * toSafeNumber(data.unit_price))),
        image_url: data.proof_image_url,
      }

      return buildResponse('expenses', {
        id: data.id,
        source: 'expenses',
        display_name: line.name,
        movement_kind: 'expense',
        created_at: data.created_at,
        counterparty: data.member_name,
        notes: data.description,
        payment_mode: null,
        quantity: line.quantity,
        total: line.total,
        is_multi: false,
        expense_status: data.status === 'paid' ? 'paid' : 'pending',
        expense_id: data.id,
        lines: [line],
      })
    }

    return NextResponse.json({ error: 'Source invalide' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Non autorisé'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
