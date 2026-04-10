import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { FinanceEntryDetail, FinanceEntryDetailLine, FinanceEntryDetailResponse, FinanceEntrySource } from '@/lib/types/financeDetail'
import { requireGroupSession } from '@/server/auth/requireSession'
import { isStockInNote, isStockOutNote, stripStockFlowMarker } from '@/lib/financeStockFlow'

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
  item_source: 'objects' | 'weapons' | 'equipment' | 'drugs' | 'custom' | null
  item_id: string | null
  item_label: string
  quantity: number | null
  unit_price: number | null
  total: number | null
  description: string | null
  created_at: string
  proof_image_url: string | null
  status: 'pending' | 'paid' | null
}

type ParsedExpenseLine = {
  name: string
  quantity: number
  unit_price: number
  image_url?: string | null
  item_source?: 'objects' | 'weapons' | 'equipment' | 'drugs' | 'custom' | null
  item_id?: string | null
}

const EXPENSE_ITEMS_MARKER = '__ITEMS_JSON__:'

function parseExpenseDescriptionItems(description: string | null | undefined): ParsedExpenseLine[] {
  const text = String(description || '').trim()
  if (!text) return []

  const markerIndex = text.indexOf(EXPENSE_ITEMS_MARKER)
  if (markerIndex >= 0) {
    const rawJson = text.slice(markerIndex + EXPENSE_ITEMS_MARKER.length).trim()
    try {
      const parsed = JSON.parse(rawJson) as unknown
      if (!Array.isArray(parsed)) return []
      return parsed
        .map((row): ParsedExpenseLine | null => {
          if (!row || typeof row !== 'object') return null
          const item = row as Record<string, unknown>
          const name = String(item.name || '').trim()
          if (!name) return null
          const quantity = Math.max(1, toSafeNumber(Number(item.quantity ?? 1)))
          const unit_price = Math.max(0, toSafeNumber(Number(item.unit_price ?? 0)))
          const itemSourceRaw = String(item.item_source || '').trim()
          const item_source = ['objects', 'weapons', 'equipment', 'drugs', 'custom'].includes(itemSourceRaw)
            ? (itemSourceRaw as ParsedExpenseLine['item_source'])
            : null
          return {
            name,
            quantity,
            unit_price,
            image_url: typeof item.image_url === 'string' ? item.image_url : null,
            item_source,
            item_id: typeof item.item_id === 'string' ? item.item_id : null,
          } satisfies ParsedExpenseLine
        })
        .filter((line): line is ParsedExpenseLine => line !== null)
    } catch {
      return []
    }
  }

  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('-'))
    .map((line): ParsedExpenseLine | null => {
      const cleaned = line.replace(/^-\s*/, '')
      const match = cleaned.match(/^(.*?)\s*[x×]\s*(\d+)$/i)
      if (!match) return null
      const name = match[1]?.trim() || ''
      const qty = Number(match[2])
      if (!name) return null
      return {
        name,
        quantity: Math.max(1, toSafeNumber(qty)),
        unit_price: 0,
      } satisfies ParsedExpenseLine
    })
    .filter((line): line is ParsedExpenseLine => line !== null)
}

function stripExpenseMetadata(description: string | null | undefined) {
  const text = String(description || '')
  const markerIndex = text.indexOf(EXPENSE_ITEMS_MARKER)
  if (markerIndex < 0) return text.trim()
  return text.slice(0, markerIndex).trim()
}

async function loadCatalogImageMapByNames(supabase: ReturnType<typeof getSupabaseAdmin>, groupId: string, names: string[]) {
  const uniq = Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)))
  if (uniq.length === 0) return new Map<string, string | null>()

  const [objectsRes, weaponsRes, equipmentRes, drugsRes] = await Promise.all([
    supabase.from('objects').select('name,image_url').eq('group_id', groupId).in('name', uniq),
    supabase.from('weapons').select('name,image_url').eq('group_id', groupId).in('name', uniq),
    supabase.from('equipment').select('name,image_url').eq('group_id', groupId).in('name', uniq),
    supabase.from('drug_items').select('name,image_url').eq('group_id', groupId).in('name', uniq),
  ])

  const map = new Map<string, string | null>()
  for (const row of objectsRes.data ?? []) map.set(String((row as { name: string | null }).name || '').trim(), (row as { image_url: string | null }).image_url)
  for (const row of weaponsRes.data ?? []) map.set(String((row as { name: string | null }).name || '').trim(), (row as { image_url: string | null }).image_url)
  for (const row of equipmentRes.data ?? []) map.set(String((row as { name: string | null }).name || '').trim(), (row as { image_url: string | null }).image_url)
  for (const row of drugsRes.data ?? []) map.set(String((row as { name: string | null }).name || '').trim(), (row as { image_url: string | null }).image_url)
  return map
}

async function resolveCatalogImageBySource(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  groupId: string,
  source: ExpenseRow['item_source'],
  itemId: string | null | undefined,
) {
  if (!source || source === 'custom' || !itemId) return null
  if (source === 'objects') {
    const { data } = await supabase.from('objects').select('image_url').eq('group_id', groupId).eq('id', itemId).maybeSingle<{ image_url: string | null }>()
    return data?.image_url || null
  }
  if (source === 'weapons') {
    const { data } = await supabase.from('weapons').select('image_url').eq('group_id', groupId).eq('id', itemId).maybeSingle<{ image_url: string | null }>()
    return data?.image_url || null
  }
  if (source === 'equipment') {
    const { data } = await supabase.from('equipment').select('image_url').eq('group_id', groupId).eq('id', itemId).maybeSingle<{ image_url: string | null }>()
    return data?.image_url || null
  }
  if (source === 'drugs') {
    const { data } = await supabase.from('drug_items').select('image_url').eq('group_id', groupId).eq('id', itemId).maybeSingle<{ image_url: string | null }>()
    return data?.image_url || null
  }
  return null
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

type FinanceEntryPatchBody = {
  counterparty?: string | null
  notes?: string | null
  quantity?: number
  unit_price?: number
  member_name?: string
  item_label?: string
  description?: string | null
  status?: 'pending' | 'paid'
}

function toPositiveInt(value: unknown, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.floor(parsed))
}

function toNonNegative(value: unknown, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, parsed)
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
        movement_kind: first.mode === 'sell'
          ? ((first.payment_mode === 'stock_out' || isStockOutNote(first.notes)) ? 'stock_out' : 'sale')
          : ((first.payment_mode === 'stock_in' || isStockInNote(first.notes)) ? 'stock_in' : 'purchase'),
        created_at: first.created_at,
        counterparty: first.counterparty,
        notes: stripStockFlowMarker(first.notes),
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
        .select('id,member_name,item_source,item_id,item_label,quantity,unit_price,total,description,created_at,proof_image_url,status')
        .eq('group_id', session.groupId)
        .eq('id', id)
        .single<ExpenseRow>()

      if (error || !data) return NextResponse.json({ error: error?.message || 'Dépense introuvable' }, { status: 404 })

      const parsedLines = parseExpenseDescriptionItems(data.description)
      const total = Math.max(0, toSafeNumber(data.total || toSafeNumber(data.quantity) * toSafeNumber(data.unit_price)))
      const quantity = Math.max(1, toSafeNumber(data.quantity))
      const unitPrice = Math.max(0, toSafeNumber(data.unit_price))

      let lines: FinanceEntryDetailLine[] = []
      if (parsedLines.length > 0) {
        const nameImageMap = await loadCatalogImageMapByNames(supabase, session.groupId, parsedLines.map((line) => line.name))
        const parsedTotalQty = parsedLines.reduce((sum, line) => sum + Math.max(1, toSafeNumber(line.quantity)), 0)
        lines = parsedLines.map((line) => {
          const lineQty = Math.max(1, toSafeNumber(line.quantity))
          const safeUnit = Math.max(0, toSafeNumber(line.unit_price || (parsedTotalQty > 0 ? total / parsedTotalQty : unitPrice)))
          return {
            name: line.name,
            quantity: lineQty,
            unit_price: safeUnit,
            total: Math.max(0, lineQty * safeUnit),
            image_url: line.image_url || nameImageMap.get(line.name) || null,
          } satisfies FinanceEntryDetailLine
        })
      } else {
        const catalogImage = await resolveCatalogImageBySource(supabase, session.groupId, data.item_source, data.item_id)
        lines = [{
          name: data.item_label || 'Dépense',
          quantity,
          unit_price: unitPrice,
          total,
          image_url: catalogImage || data.proof_image_url,
        }]
      }

      const isMulti = lines.length > 1
      const displayName = isMulti ? 'Dépense multiple' : lines[0]?.name || 'Dépense'
      const normalizedTotal = isMulti ? sumTotal(lines) : Math.max(0, toSafeNumber(lines[0]?.total ?? total))

      return buildResponse('expenses', {
        id: data.id,
        source: 'expenses',
        display_name: displayName,
        movement_kind: 'expense',
        created_at: data.created_at,
        counterparty: data.member_name,
        notes: stripExpenseMetadata(data.description),
        payment_mode: null,
        quantity: sumQuantity(lines),
        total: normalizedTotal,
        is_multi: isMulti,
        expense_status: data.status === 'paid' ? 'paid' : 'pending',
        expense_id: data.id,
        lines,
      })
    }

    return NextResponse.json({ error: 'Source invalide' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Non autorisé'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await requireGroupSession(request)
    const source = params.source as FinanceEntrySource
    const id = decodeURIComponent(params.id)
    const body = (await request.json()) as FinanceEntryPatchBody
    const supabase = getSupabaseAdmin()

    if (source === 'finance_transactions') {
      const groupedIds = parseGroupedFinanceTransactionIds(id)
      const hasGroupedIds = groupedIds.length > 1
      const hasQtyPatch = body.quantity !== undefined || body.unit_price !== undefined

      if (hasGroupedIds) {
        if (hasQtyPatch) {
          return NextResponse.json({ error: 'Pour une transaction multiple, seule la note/interlocuteur est modifiable.' }, { status: 400 })
        }

        const sharedPatch: { counterparty?: string | null; notes?: string | null } = {}
        if (typeof body.counterparty === 'string') sharedPatch.counterparty = body.counterparty.trim() || null
        if (typeof body.notes === 'string') sharedPatch.notes = body.notes.trim() || null

        if (Object.keys(sharedPatch).length === 0) {
          return NextResponse.json({ ok: true })
        }

        const { error: groupedUpdateError } = await supabase
          .from('finance_transactions')
          .update(sharedPatch)
          .eq('group_id', session.groupId)
          .in('id', groupedIds)

        if (groupedUpdateError) throw groupedUpdateError
        return NextResponse.json({ ok: true })
      }

      const targetId = groupedIds[0] || id
      const { data: row, error: rowError } = await supabase
        .from('finance_transactions')
        .select('id,item_id,mode,quantity,unit_price')
        .eq('group_id', session.groupId)
        .eq('id', targetId)
        .maybeSingle<{ id: string; item_id: string; mode: 'buy' | 'sell'; quantity: number | null; unit_price: number | null }>()

      if (rowError || !row) return NextResponse.json({ error: rowError?.message || 'Transaction introuvable.' }, { status: 404 })

      const oldQty = toPositiveInt(row.quantity, 1)
      const nextQty = toPositiveInt(body.quantity, oldQty)
      const nextUnit = toNonNegative(body.unit_price, toNonNegative(row.unit_price, 0))

      const { data: item, error: itemError } = await supabase
        .from('catalog_items')
        .select('id,stock')
        .eq('group_id', session.groupId)
        .eq('id', row.item_id)
        .maybeSingle<{ id: string; stock: number | null }>()

      if (itemError || !item) return NextResponse.json({ error: itemError?.message || 'Item introuvable.' }, { status: 404 })

      const currentStock = Math.max(0, Number(item.stock ?? 0))
      const oldImpact = row.mode === 'buy' ? oldQty : -oldQty
      const nextImpact = row.mode === 'buy' ? nextQty : -nextQty
      const nextStock = currentStock + (nextImpact - oldImpact)

      if (nextStock < 0) {
        return NextResponse.json({ error: 'Stock insuffisant pour cette modification.' }, { status: 400 })
      }

      const { error: stockError } = await supabase
        .from('catalog_items')
        .update({ stock: nextStock, updated_at: new Date().toISOString() })
        .eq('group_id', session.groupId)
        .eq('id', item.id)
      if (stockError) throw stockError

      const { error: updateError } = await supabase
        .from('finance_transactions')
        .update({
          quantity: nextQty,
          unit_price: nextUnit,
          total: Math.max(0, nextQty * nextUnit),
          counterparty: typeof body.counterparty === 'string' ? body.counterparty.trim() || null : undefined,
          notes: typeof body.notes === 'string' ? body.notes.trim() || null : undefined,
        })
        .eq('group_id', session.groupId)
        .eq('id', targetId)

      if (updateError) throw updateError
      return NextResponse.json({ ok: true })
    }

    if (source === 'transactions') {
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          counterparty: typeof body.counterparty === 'string' ? body.counterparty.trim() || null : undefined,
          notes: typeof body.notes === 'string' ? body.notes.trim() || null : undefined,
        })
        .eq('group_id', session.groupId)
        .eq('id', id)

      if (updateError) throw updateError
      return NextResponse.json({ ok: true })
    }

    if (source === 'expenses') {
      const quantity = toPositiveInt(body.quantity, 1)
      const unitPrice = toNonNegative(body.unit_price, 0)
      const nextStatus = body.status === 'paid' ? 'paid' : body.status === 'pending' ? 'pending' : null

      const baseUpdate = {
        member_name: typeof body.member_name === 'string' ? body.member_name.trim() : undefined,
        item_label: typeof body.item_label === 'string' ? body.item_label.trim() : undefined,
        quantity,
        unit_price: unitPrice,
        total: quantity * unitPrice,
        description: typeof body.description === 'string' ? body.description.trim() || null : undefined,
        status: nextStatus || undefined,
        paid_at: nextStatus === 'paid' ? new Date().toISOString() : nextStatus === 'pending' ? null : undefined,
      }

      const scopedQuery = supabase.from('expenses').update(baseUpdate).eq('id', id).eq('group_id', session.groupId).select('id')
      const { data: updatedRows, error: updateError } = await scopedQuery
      if (updateError) throw updateError

      if (!updatedRows || updatedRows.length === 0) {
        const fallback = await supabase.from('expenses').update(baseUpdate).eq('id', id).is('group_id', null).select('id')
        if (fallback.error) throw fallback.error
        if (!fallback.data || fallback.data.length === 0) {
          return NextResponse.json({ error: 'Dépense introuvable.' }, { status: 404 })
        }
      }

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Source invalide' }, { status: 400 })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Impossible de modifier cette entrée.' }, { status: 400 })
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await requireGroupSession(request)
    const source = params.source as FinanceEntrySource
    const id = decodeURIComponent(params.id)
    const supabase = getSupabaseAdmin()

    if (source === 'finance_transactions') {
      const groupedIds = parseGroupedFinanceTransactionIds(id)
      const targetIds = groupedIds.length > 0 ? groupedIds : [id]

      const { data: rows, error: loadError } = await supabase
        .from('finance_transactions')
        .select('id,item_id,mode,quantity')
        .eq('group_id', session.groupId)
        .in('id', targetIds)

      if (loadError) throw loadError
      if (!rows || rows.length === 0) return NextResponse.json({ error: 'Transaction introuvable.' }, { status: 404 })

      const itemIds = Array.from(new Set(rows.map((row) => String((row as { item_id: string }).item_id))))
      const { data: items, error: itemError } = await supabase
        .from('catalog_items')
        .select('id,stock')
        .eq('group_id', session.groupId)
        .in('id', itemIds)
      if (itemError) throw itemError

      const stockMap = new Map((items ?? []).map((item) => [String((item as { id: string }).id), Math.max(0, Number((item as { stock: number | null }).stock ?? 0))]))
      const nextStockMap = new Map(stockMap)

      for (const row of rows as Array<{ item_id: string; mode: 'buy' | 'sell' | null; quantity: number | null }>) {
        const qty = toPositiveInt(row.quantity, 1)
        const currentStock = nextStockMap.get(row.item_id) ?? 0
        const nextStock = row.mode === 'sell' ? currentStock + qty : currentStock - qty
        if (nextStock < 0) return NextResponse.json({ error: 'Stock insuffisant pour supprimer cette transaction.' }, { status: 400 })
        nextStockMap.set(row.item_id, nextStock)
      }

      for (const [itemId, stock] of nextStockMap.entries()) {
        if ((stockMap.get(itemId) ?? 0) === stock) continue
        const { error: stockError } = await supabase
          .from('catalog_items')
          .update({ stock, updated_at: new Date().toISOString() })
          .eq('group_id', session.groupId)
          .eq('id', itemId)
        if (stockError) throw stockError
      }

      const { error: deleteError } = await supabase
        .from('finance_transactions')
        .delete()
        .eq('group_id', session.groupId)
        .in('id', targetIds)
      if (deleteError) throw deleteError
      return NextResponse.json({ ok: true })
    }

    if (source === 'transactions') {
      const { data: tx, error: txError } = await supabase
        .from('transactions')
        .select('id,type')
        .eq('group_id', session.groupId)
        .eq('id', id)
        .maybeSingle<{ id: string; type: 'purchase' | 'sale' | null }>()
      if (txError || !tx) return NextResponse.json({ error: txError?.message || 'Transaction introuvable.' }, { status: 404 })

      const { data: items, error: itemsError } = await supabase
        .from('transaction_items')
        .select('object_id,quantity')
        .eq('group_id', session.groupId)
        .eq('transaction_id', tx.id)
      if (itemsError) throw itemsError

      const objectIds = Array.from(new Set((items ?? []).map((item) => String((item as { object_id: string }).object_id)).filter(Boolean)))
      if (objectIds.length > 0) {
        const { data: stocks, error: stockLoadError } = await supabase
          .from('objects')
          .select('id,stock')
          .eq('group_id', session.groupId)
          .in('id', objectIds)
        if (stockLoadError) throw stockLoadError

        const stockMap = new Map((stocks ?? []).map((row) => [String((row as { id: string }).id), Math.max(0, Number((row as { stock: number | null }).stock ?? 0))]))
        for (const item of items as Array<{ object_id: string; quantity: number | null }>) {
          const qty = toPositiveInt(item.quantity, 1)
          const current = stockMap.get(item.object_id) ?? 0
          const next = tx.type === 'sale' ? current + qty : current - qty
          if (next < 0) return NextResponse.json({ error: 'Stock insuffisant pour supprimer cette transaction.' }, { status: 400 })
          stockMap.set(item.object_id, next)
        }

        for (const [objectId, stock] of stockMap.entries()) {
          const { error: stockUpdateError } = await supabase
            .from('objects')
            .update({ stock })
            .eq('group_id', session.groupId)
            .eq('id', objectId)
          if (stockUpdateError) throw stockUpdateError
        }
      }

      const { error: deleteError } = await supabase.from('transactions').delete().eq('group_id', session.groupId).eq('id', tx.id)
      if (deleteError) throw deleteError
      return NextResponse.json({ ok: true })
    }

    if (source === 'expenses') {
      const scopedDelete = await supabase.from('expenses').delete().eq('id', id).eq('group_id', session.groupId).select('id')
      if (scopedDelete.error) throw scopedDelete.error

      if (!scopedDelete.data || scopedDelete.data.length === 0) {
        const fallback = await supabase.from('expenses').delete().eq('id', id).is('group_id', null).select('id')
        if (fallback.error) throw fallback.error
        if (!fallback.data || fallback.data.length === 0) {
          return NextResponse.json({ error: 'Dépense introuvable.' }, { status: 404 })
        }
      }

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Source invalide' }, { status: 400 })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Impossible de supprimer cette entrée.' }, { status: 400 })
  }
}
