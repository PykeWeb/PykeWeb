import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getSessionFromRequest } from '@/server/auth/session'
import {
  ACTIVITY_OPTIONS,
  type ActivityEquipmentLineInput,
  type ActivityObjectLineInput,
  type ActivityType,
} from '@/lib/types/activities'

type CatalogItemRow = { id: string; name: string; category: string; buy_price: number | null; stock?: number | null }
type GlobalCatalogRow = {
  id: string
  category: string
  item_type: string | null
  name: string
  description: string | null
  image_url: string | null
  price: number | null
  default_quantity: number | null
  weapon_id: string | null
}
type GlobalCatalogOverrideRow = {
  global_item_id: string
  is_hidden: boolean | null
  override_name: string | null
  override_price: number | null
  override_description: string | null
  override_image_url: string | null
  override_item_type: string | null
  override_weapon_id: string | null
}

const MAX_PROOF_LENGTH = 3_000_000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}

function toWeekStart(date = new Date()) {
  const copy = new Date(date)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setHours(0, 0, 0, 0)
  copy.setDate(copy.getDate() + diff)
  return copy
}

function toWeekEnd(weekStart: Date) {
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 7)
  return end
}


function isMissingColumnError(error: unknown, column: string) {
  if (!error || typeof error !== 'object' || !('message' in error)) return false
  const message = String((error as { message?: unknown }).message || '').toLowerCase()
  return message.includes(`'${column.toLowerCase()}'`) && message.includes('could not find')
}

function getCurrentWeekRange() {
  const weekStart = toWeekStart()
  const weekEnd = toWeekEnd(weekStart)
  return { weekStart, weekEnd }
}


function isPaymentModeConstraintError(error: unknown) {
  const message = toErrorMessage(error, '').toLowerCase()
  return message.includes('finance_transactions_payment_mode_check')
    || message.includes('payment_mode')
    || message.includes('invalid input value for enum')
}

function toNonNegative(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

async function resolveActivityCatalogItemId(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  groupId: string,
  itemId: string,
  expectedCategory?: 'objects' | 'equipment',
) {
  const raw = String(itemId || '').trim()
  if (!raw) throw new Error('ID item vide.')
  if (UUID_RE.test(raw)) return raw

  if (raw.startsWith('global:')) {
    const globalId = raw.slice('global:'.length).trim()
    if (!UUID_RE.test(globalId)) throw new Error('ID item global invalide.')

    const { data: existing } = await supabase
      .from('catalog_items')
      .select('id')
      .eq('group_id', groupId)
      .eq('internal_id', `global-${globalId}`)
      .maybeSingle<{ id: string }>()
    if (existing?.id) return existing.id

    const [{ data: globalRow, error: globalErr }, { data: override }] = await Promise.all([
      supabase
        .from('catalog_items_global')
        .select('id,category,item_type,name,description,image_url,price,default_quantity,weapon_id')
        .eq('id', globalId)
        .single<GlobalCatalogRow>(),
      supabase
        .from('catalog_items_group_overrides')
        .select('global_item_id,is_hidden,override_name,override_price,override_description,override_image_url,override_item_type,override_weapon_id')
        .eq('group_id', groupId)
        .eq('global_item_id', globalId)
        .maybeSingle<GlobalCatalogOverrideRow>(),
    ])
    if (globalErr || !globalRow) throw globalErr || new Error('Item global introuvable.')
    if (override?.is_hidden) throw new Error('Cet item est masqué pour ce groupe.')

    const category = String(globalRow.category || '').trim()
    if (expectedCategory && category !== expectedCategory) throw new Error('Catégorie globale invalide pour cette activité.')
    const name = String(override?.override_name || globalRow.name || '').trim()
    if (!name) throw new Error('Nom item global invalide.')
    const buyPrice = toNonNegative(override?.override_price ?? globalRow.price ?? 0)

    const { data: inserted, error: insertErr } = await supabase
      .from('catalog_items')
      .insert({
        group_id: groupId,
        internal_id: `global-${globalId}`,
        name,
        category,
        item_type: override?.override_item_type || globalRow.item_type || 'other',
        description: override?.override_description ?? globalRow.description,
        image_url: override?.override_image_url ?? globalRow.image_url,
        buy_price: buyPrice,
        sell_price: buyPrice,
        internal_value: 0,
        show_in_finance: true,
        is_active: true,
        stock: toNonNegative(globalRow.default_quantity ?? 0),
        low_stock_threshold: 0,
        stackable: true,
        max_stack: 100,
        weight: null,
        fivem_item_id: override?.override_weapon_id ?? globalRow.weapon_id,
        hash: null,
        rarity: null,
      })
      .select('id')
      .single<{ id: string }>()

    if (insertErr) throw insertErr
    return inserted.id
  }

  if (raw.startsWith('legacy:')) {
    const { data: existing } = await supabase
      .from('catalog_items')
      .select('id')
      .eq('group_id', groupId)
      .eq('internal_id', raw.replace(/:/g, '-'))
      .maybeSingle<{ id: string }>()
    if (existing?.id) return existing.id
  }

  return raw
}

export async function GET(request: Request) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session?.groupId) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 })

    const url = new URL(request.url)
    const rawWeekStart = url.searchParams.get('weekStart')
    const scope = url.searchParams.get('scope') === 'all' ? 'all' : 'week'
    const weekStart = rawWeekStart ? new Date(rawWeekStart) : toWeekStart()
    if (Number.isNaN(weekStart.getTime())) return NextResponse.json({ error: 'Semaine invalide.' }, { status: 400 })
    const weekEnd = toWeekEnd(weekStart)

    const supabase = getSupabaseAdmin()
    const [{ data: entries, error: entriesError }, { data: settings, error: settingsError }] = await Promise.all([
      (() => {
        let query = supabase
          .from('group_activity_entries')
          .select('*')
          .eq('group_id', session.groupId)
          .order('created_at', { ascending: false })
          .limit(scope === 'all' ? 2000 : 800)
        if (scope !== 'all') {
          query = query.gte('created_at', weekStart.toISOString()).lt('created_at', weekEnd.toISOString())
        }
        return query
      })(),
      supabase
        .from('group_activity_settings')
        .select('group_id, default_percent_per_object')
        .eq('group_id', session.groupId)
        .maybeSingle(),
    ])

    if (entriesError) throw entriesError
    if (settingsError) throw settingsError

    const normalizedSettings = {
      group_id: session.groupId,
      default_percent_per_object: Math.max(0, Number(settings?.default_percent_per_object) || 2),
    }

    const safeEntries = (entries ?? []).filter((entry) => String(entry.group_id || '') === session.groupId)

    const byMember = new Map<string, { totalObjects: number; totalSalary: number }>()
    for (const entry of safeEntries) {
      const name = String(entry.member_name || '').trim()
      if (!name) continue
      const prev = byMember.get(name) ?? { totalObjects: 0, totalSalary: 0 }
      byMember.set(name, {
        totalObjects: prev.totalObjects + Math.max(0, Number(entry.quantity) || 0),
        totalSalary: prev.totalSalary + Math.max(0, Number(entry.salary_amount) || 0),
      })
    }

    const summaries = [...byMember.entries()]
      .map(([member_name, stats]) => ({ member_name, total_objects: stats.totalObjects, total_salary: stats.totalSalary }))
      .sort((a, b) => b.total_salary - a.total_salary)

    return NextResponse.json({ entries: safeEntries, summaries, settings: normalizedSettings })
  } catch (error: unknown) {
    return NextResponse.json({ error: toErrorMessage(error, 'Impossible de charger les activités.') }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session?.groupId) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 })

    const body = (await request.json()) as {
      member_name?: string
      activity_type?: ActivityType
      object_lines?: ActivityObjectLineInput[]
      equipment_lines?: ActivityEquipmentLineInput[]
      percent_per_object?: number
      proof_image_data?: string
    }

    const memberName = String(body.member_name ?? '').trim()
    const activityType = body.activity_type
    const objectLines = Array.isArray(body.object_lines) ? body.object_lines : []
    const equipmentLines = Array.isArray(body.equipment_lines) ? body.equipment_lines : []
    const proof = String(body.proof_image_data ?? '').trim()

    if (!memberName) return NextResponse.json({ error: 'Nom du membre requis.' }, { status: 400 })
    if (!activityType || !ACTIVITY_OPTIONS.includes(activityType)) return NextResponse.json({ error: 'Activité invalide.' }, { status: 400 })
    if (objectLines.length === 0) return NextResponse.json({ error: 'Ajoute au moins un objet.' }, { status: 400 })
    if (objectLines.some((line) => !line.object_item_id || Math.max(0, Math.floor(Number(line.quantity) || 0)) <= 0)) {
      return NextResponse.json({ error: 'Lignes objets invalides.' }, { status: 400 })
    }
    if (activityType !== 'Boite au lettre') {
      if (equipmentLines.length === 0) return NextResponse.json({ error: 'Ajoute au moins un équipement.' }, { status: 400 })
      if (equipmentLines.some((line) => !line.equipment_item_id || Math.max(0, Math.floor(Number(line.quantity) || 0)) <= 0)) {
        return NextResponse.json({ error: 'Lignes équipements invalides.' }, { status: 400 })
      }
    }
    if (!proof.startsWith('data:image/jpeg;base64,') && !proof.startsWith('data:image/png;base64,')) {
      return NextResponse.json({ error: 'Preuve obligatoire (jpeg/png).' }, { status: 400 })
    }
    if (proof.length > MAX_PROOF_LENGTH) return NextResponse.json({ error: 'Image trop volumineuse.' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const { data: settings, error: settingsError } = await supabase
      .from('group_activity_settings')
      .select('default_percent_per_object')
      .eq('group_id', session.groupId)
      .maybeSingle()

    if (settingsError) throw settingsError

    const fallbackPercent = Math.max(0.01, Number(settings?.default_percent_per_object) || 2)
    const canOverridePercent = Boolean(session.isAdmin || session.role === 'chef')
    const requestedPercent = Math.max(0.01, Number(body.percent_per_object) || 0.01)
    const percent = canOverridePercent ? requestedPercent : fallbackPercent

    if (percent <= 0) return NextResponse.json({ error: 'Pourcentage invalide.' }, { status: 400 })

    const normalizedObjectLines = await Promise.all(
      objectLines.map(async (line) => ({
        ...line,
        object_item_id: await resolveActivityCatalogItemId(supabase, session.groupId, String(line.object_item_id || '')),
      }))
    )
    const objectIds = [...new Set(normalizedObjectLines.map((line) => String(line.object_item_id).trim()).filter(Boolean))]
    const { data: objectRows, error: objectErr } = await supabase
      .from('catalog_items')
      .select('id,name,category,buy_price,stock')
      .eq('group_id', session.groupId)
      .eq('is_active', true)
      .in('id', objectIds)

    if (objectErr) throw objectErr
    const objectMap = new Map<string, CatalogItemRow>()
    for (const row of (objectRows ?? []) as CatalogItemRow[]) objectMap.set(row.id, row)
    if (objectMap.size !== objectIds.length) return NextResponse.json({ error: 'Un ou plusieurs objets sont invalides.' }, { status: 400 })

    let equipmentDisplay = ''
    let equipmentTotalQty = 0
    let firstEquipmentId: string | null = null
    const equipmentStockMap = new Map<string, CatalogItemRow>()
    let normalizedEquipmentLines: ActivityEquipmentLineInput[] = []

    if (activityType !== 'Boite au lettre') {
      normalizedEquipmentLines = await Promise.all(
        equipmentLines.map(async (line) => ({
          ...line,
          equipment_item_id: await resolveActivityCatalogItemId(supabase, session.groupId, String(line.equipment_item_id || ''), 'equipment'),
        }))
      )
      const equipmentIds = [...new Set(normalizedEquipmentLines.map((line) => String(line.equipment_item_id).trim()).filter(Boolean))]
      const { data: equipmentRows, error: equipmentErr } = await supabase
        .from('catalog_items')
        .select('id,name,category,buy_price,stock')
        .eq('group_id', session.groupId)
        .eq('is_active', true)
        .in('id', equipmentIds)

      if (equipmentErr) throw equipmentErr
      const equipmentMap = new Map<string, CatalogItemRow>()
      for (const row of (equipmentRows ?? []) as CatalogItemRow[]) {
        if (row.category === 'equipment') equipmentMap.set(row.id, row)
      }
      if (equipmentMap.size !== equipmentIds.length) return NextResponse.json({ error: 'Un ou plusieurs équipements sont invalides.' }, { status: 400 })

      const requiredQtyByEquipment = new Map<string, number>()
      const parts: string[] = []
      for (const line of normalizedEquipmentLines) {
        const item = equipmentMap.get(line.equipment_item_id)
        if (!item) continue
        const qty = Math.max(1, Math.floor(Number(line.quantity) || 1))
        requiredQtyByEquipment.set(item.id, (requiredQtyByEquipment.get(item.id) || 0) + qty)
        equipmentTotalQty += qty
        parts.push(`${item.name} x${qty}`)
        if (!firstEquipmentId) firstEquipmentId = item.id
      }

      for (const [itemId, requiredQty] of requiredQtyByEquipment.entries()) {
        const equipment = equipmentMap.get(itemId)
        if (!equipment) continue
        const currentStock = Math.max(0, Number(equipment.stock || 0))
        if (currentStock < requiredQty) {
          return NextResponse.json({ error: `Stock insuffisant pour l'équipement ${equipment.name}.` }, { status: 400 })
        }
      }

      for (const [itemId, equipment] of equipmentMap.entries()) {
        equipmentStockMap.set(itemId, equipment)
      }
      equipmentDisplay = parts.join(' • ')
    }

    const rowsToInsert = normalizedObjectLines.map((line) => {
      const item = objectMap.get(line.object_item_id) as CatalogItemRow
      const qty = Math.max(1, Math.floor(Number(line.quantity) || 1))
      const objectPrice = Math.max(0, Number(item.buy_price) || 0)
      const salaryAmount = objectPrice * qty * (percent / 100)

      return {
        group_id: session.groupId,
        member_name: memberName,
        activity_type: activityType,
        object_item_id: item.id,
        object_name: item.name,
        item_name: item.name,
        object_unit_price: objectPrice,
        quantity: qty,
        percent_per_object: percent,
        salary_amount: salaryAmount,
        equipment_item_id: firstEquipmentId,
        equipment_name: equipmentDisplay || null,
        equipment: equipmentDisplay || null,
        equipment_quantity: activityType === 'Boite au lettre' ? 0 : equipmentTotalQty,
        proof_image_data: proof,
      }
    })

    let { error } = await supabase.from('group_activity_entries').insert(rowsToInsert)

    if (error && isMissingColumnError(error, 'equipment_quantity')) {
      const legacyRows = rowsToInsert.map(({ equipment_quantity: _equipmentQuantity, ...row }) => row)
      const legacyInsert = await supabase.from('group_activity_entries').insert(legacyRows)
      error = legacyInsert.error
    }

    if (error) throw error

    for (const line of normalizedObjectLines) {
      const objectItem = objectMap.get(line.object_item_id)
      if (!objectItem) continue
      const qty = Math.max(1, Math.floor(Number(line.quantity) || 1))
      const currentStock = Math.max(0, Number(objectItem.stock || 0))
      const { error: updateObjectStockErr } = await supabase
        .from('catalog_items')
        .update({ stock: currentStock + qty })
        .eq('group_id', session.groupId)
        .eq('id', objectItem.id)
      if (updateObjectStockErr) throw updateObjectStockErr
      objectItem.stock = currentStock + qty
    }

    if (activityType !== 'Boite au lettre') {
      for (const line of normalizedEquipmentLines) {
        const equipmentItem = equipmentStockMap.get(line.equipment_item_id)
        if (!equipmentItem) continue
        const qty = Math.max(1, Math.floor(Number(line.quantity) || 1))
        const currentStock = Math.max(0, Number(equipmentItem.stock || 0))
        if (currentStock < qty) {
          return NextResponse.json({ error: `Stock insuffisant pour l'équipement ${equipmentItem.name}.` }, { status: 400 })
        }
        const { error: updateEquipmentStockErr } = await supabase
          .from('catalog_items')
          .update({ stock: currentStock - qty })
          .eq('group_id', session.groupId)
          .eq('id', equipmentItem.id)
        if (updateEquipmentStockErr) throw updateEquipmentStockErr
        equipmentItem.stock = currentStock - qty
      }
    }

    const financeNotes = `Activité ${activityType} - ${memberName}`
    const financeRows = [
      ...normalizedObjectLines.map((line) => {
        const item = objectMap.get(line.object_item_id) as CatalogItemRow
        const qty = Math.max(1, Math.floor(Number(line.quantity) || 1))
        const unit = Math.max(0, Number(item.buy_price) || 0)
        return {
          group_id: session.groupId,
          item_id: item.id,
          mode: 'buy',
          quantity: qty,
          unit_price: unit,
          total: Number((qty * unit).toFixed(2)),
          counterparty: memberName,
          notes: financeNotes,
          payment_mode: 'stock_in',
        }
      }),
      ...normalizedEquipmentLines.map((line) => {
        const item = equipmentStockMap.get(line.equipment_item_id) as CatalogItemRow
        const qty = Math.max(1, Math.floor(Number(line.quantity) || 1))
        const unit = Math.max(0, Number(item.buy_price) || 0)
        return {
          group_id: session.groupId,
          item_id: item.id,
          mode: 'sell',
          quantity: qty,
          unit_price: unit,
          total: Number((qty * unit).toFixed(2)),
          counterparty: memberName,
          notes: financeNotes,
          payment_mode: 'stock_out',
        }
      }),
    ]

    for (const row of financeRows) {
      const preferredMode = String(row.payment_mode || 'other')
      const fallbacks = preferredMode === 'stock_in' || preferredMode === 'stock_out'
        ? [preferredMode, 'other', 'cash']
        : [preferredMode, 'other']

      let inserted = false
      let lastError: unknown = null
      for (const mode of fallbacks) {
        const { error: financeError } = await supabase.from('finance_transactions').insert({ ...row, payment_mode: mode })
        if (!financeError) {
          inserted = true
          break
        }
        lastError = financeError
        if (!isPaymentModeConstraintError(financeError)) break
      }

      if (!inserted && lastError) throw lastError
    }

    await supabase.from('app_logs').insert([
      {
        group_id: session.groupId,
        group_name: session.groupName,
        user_id: session.memberId ?? null,
        user_name: session.memberName ?? memberName,
        actor_name: session.memberName ?? memberName,
        actor_source: 'web',
        source: 'web',
        area: 'activities',
        category: 'activity',
        action: 'entree',
        action_type: 'entree',
        target_type: 'activity',
        target_name: activityType,
        quantity: normalizedObjectLines.reduce((sum, line) => sum + Math.max(1, Math.floor(Number(line.quantity) || 1)), 0),
        message: `Activité ${activityType} enregistrée (${memberName})`,
        note: financeNotes,
      },
      ...(normalizedEquipmentLines.length > 0
        ? [{
          group_id: session.groupId,
          group_name: session.groupName,
          user_id: session.memberId ?? null,
          user_name: session.memberName ?? memberName,
          actor_name: session.memberName ?? memberName,
          actor_source: 'web',
          source: 'web',
          area: 'activities',
          category: 'activity',
          action: 'sortie',
          action_type: 'sortie',
          target_type: 'equipment',
          target_name: activityType,
          quantity: normalizedEquipmentLines.reduce((sum, line) => sum + Math.max(1, Math.floor(Number(line.quantity) || 1)), 0),
          message: `Équipements consommés pour ${activityType}`,
          note: financeNotes,
        }]
        : []),
    ])

    return NextResponse.json({ ok: true, inserted: rowsToInsert.length })
  } catch (error: unknown) {
    return NextResponse.json({ error: toErrorMessage(error, "Impossible d'enregistrer l'activité.") }, { status: 400 })
  }
}


export async function DELETE(request: Request) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session?.groupId) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 })

    const isChef = Boolean(session.isAdmin || session.role === 'chef')
    if (!isChef) return NextResponse.json({ error: 'Réservé au chef.' }, { status: 403 })

    const { weekStart, weekEnd } = getCurrentWeekRange()
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('group_activity_entries')
      .delete()
      .eq('group_id', session.groupId)
      .gte('created_at', weekStart.toISOString())
      .lt('created_at', weekEnd.toISOString())

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return NextResponse.json({ error: toErrorMessage(error, "Impossible de réinitialiser la semaine.") }, { status: 400 })
  }
}
