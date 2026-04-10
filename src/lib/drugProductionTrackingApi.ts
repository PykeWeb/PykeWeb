import { currentGroupId } from '@/lib/tenantScope'
import { supabase } from '@/lib/supabase/client'

export type ProductionType = 'coke' | 'meth' | 'other'
export type ProductionStatus = 'in_progress' | 'completed' | 'cancelled'

export type DrugProductionTrackingRow = {
  id: string
  group_id: string
  partner_name: string
  type: ProductionType
  quantity_sent: number
  ratio: number
  expected_output: number
  received_output: number
  status: ProductionStatus
  note: string | null
  created_at: string
  expected_date: string | null
  seed_price: number | null
  pouch_sale_price: number | null
  brick_transform_cost: number | null
  pouch_transform_cost: number | null
}

const BRICK_TAX_RATE = 0.05
const POUCHES_PER_BRICK = 10

function computeStatus(received: number, expected: number, current?: ProductionStatus): ProductionStatus {
  if (current === 'cancelled') return 'cancelled'
  if (received >= expected && expected > 0) return 'completed'
  return 'in_progress'
}

function isMissingColumnError(error: { message?: string } | null | undefined, column: string) {
  const message = (error?.message || '').toLowerCase()
  return message.includes(column.toLowerCase()) && message.includes('could not find')
}

function normalizeProductionType(value: unknown): ProductionType {
  const raw = String(value || '').toLowerCase()
  if (raw.includes('meth')) return 'meth'
  if (raw.includes('coke')) return 'coke'
  return 'other'
}

function normalizeProductionRow(row: DrugProductionTrackingRow): DrugProductionTrackingRow {
  return {
    ...row,
    type: normalizeProductionType(row.type),
  }
}

export async function listDrugProductionTrackings(): Promise<DrugProductionTrackingRow[]> {
  const { data, error } = await supabase
    .from('drug_production_tracking')
    .select('*')
    .eq('group_id', currentGroupId())
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message || 'Erreur chargement suivi production')
  return ((data ?? []) as DrugProductionTrackingRow[]).map(normalizeProductionRow)
}

export async function createDrugProductionTracking(payload: {
  partnerName: string
  type: ProductionType
  quantitySent: number
  ratio: number
  expectedOutput?: number
  receivedOutput?: number
  note?: string
  createdAt?: string
  expectedDate?: string
  seedPrice?: number
  pouchSalePrice?: number
  brickTransformCost?: number
  pouchTransformCost?: number
}) {
  const quantitySent = Math.max(0, Math.floor(payload.quantitySent || 0))
  const ratio = Math.max(0, Number(payload.ratio || 0))
  const totalLeaves = quantitySent * ratio
  const netBricks = Math.max(0, totalLeaves * (1 - BRICK_TAX_RATE))
  const autoExpectedOutput = Math.max(0, Math.floor(netBricks * POUCHES_PER_BRICK))
  const expectedOutput = payload.expectedOutput === undefined
    ? autoExpectedOutput
    : Math.max(0, Math.floor(payload.expectedOutput || 0))
  const receivedOutput = Math.max(0, Math.floor(payload.receivedOutput || 0))
  const status = computeStatus(receivedOutput, expectedOutput)
  const createdAtValue = payload.createdAt && /^\d{4}-\d{2}-\d{2}$/.test(payload.createdAt)
    ? new Date(`${payload.createdAt}T00:00:00.000Z`).toISOString()
    : undefined
  const expectedDateValue = payload.expectedDate && /^\d{4}-\d{2}-\d{2}$/.test(payload.expectedDate)
    ? payload.expectedDate
    : null

  const insertPayload = {
    group_id: currentGroupId(),
    partner_name: payload.partnerName,
    type: normalizeProductionType(payload.type),
    quantity_sent: quantitySent,
    ratio,
    expected_output: expectedOutput,
    received_output: Math.min(receivedOutput, expectedOutput || receivedOutput),
    status,
    note: payload.note?.trim() || null,
    created_at: createdAtValue,
    expected_date: expectedDateValue,
    seed_price: payload.seedPrice === undefined ? null : Math.max(0, Number(payload.seedPrice || 0)),
    pouch_sale_price: payload.pouchSalePrice === undefined ? null : Math.max(0, Number(payload.pouchSalePrice || 0)),
    brick_transform_cost: payload.brickTransformCost === undefined ? null : Math.max(0, Number(payload.brickTransformCost || 0)),
    pouch_transform_cost: payload.pouchTransformCost === undefined ? null : Math.max(0, Number(payload.pouchTransformCost || 0)),
  }

  const { data, error } = await supabase
    .from('drug_production_tracking')
    .insert(insertPayload)
    .select('*')
    .single()

  if (!error) return normalizeProductionRow(data as DrugProductionTrackingRow)

  const pricingColumnMissing =
    isMissingColumnError(error, 'seed_price')
    || isMissingColumnError(error, 'pouch_sale_price')
    || isMissingColumnError(error, 'brick_transform_cost')
    || isMissingColumnError(error, 'pouch_transform_cost')

  if (!pricingColumnMissing) throw new Error(error.message || 'Erreur création demande')

  const {
    seed_price: _seedPrice,
    pouch_sale_price: _pouchSalePrice,
    brick_transform_cost: _brickTransformCost,
    pouch_transform_cost: _pouchTransformCost,
    ...legacyPayload
  } = insertPayload

  const { data: legacyData, error: legacyError } = await supabase
    .from('drug_production_tracking')
    .insert(legacyPayload)
    .select('*')
    .single()

  if (legacyError) throw new Error(legacyError.message || 'Erreur création demande')
  return normalizeProductionRow(legacyData as DrugProductionTrackingRow)
}

export async function updateDrugProductionTracking(id: string, payload: {
  partnerName?: string
  type?: ProductionType
  quantitySent?: number
  expectedOutput?: number
  receivedOutput?: number
  note?: string
  expectedDate?: string | null
  createdAt?: string
  seedPrice?: number
  pouchSalePrice?: number
  brickTransformCost?: number
  pouchTransformCost?: number
  status?: ProductionStatus
}) {
  const { data: current, error: getError } = await supabase
    .from('drug_production_tracking')
    .select('*')
    .eq('id', id)
    .eq('group_id', currentGroupId())
    .single()

  if (getError) throw new Error(getError.message || 'Demande introuvable')

  const nextQuantitySent = payload.quantitySent === undefined
    ? Math.max(0, Math.floor(Number(current.quantity_sent || 0)))
    : Math.max(0, Math.floor(payload.quantitySent || 0))

  const nextExpectedOutput = payload.expectedOutput === undefined
    ? Math.max(0, Math.floor(Number(current.expected_output || 0)))
    : Math.max(0, Math.floor(payload.expectedOutput || 0))

  const nextReceived = payload.receivedOutput === undefined
    ? Number(current.received_output || 0)
    : Math.max(0, Math.floor(payload.receivedOutput || 0))

  const forcedStatus = payload.status
  const computedStatus = forcedStatus === 'cancelled'
    ? 'cancelled'
    : computeStatus(nextReceived, nextExpectedOutput, current.status)

  const createdAtValue = payload.createdAt && /^\d{4}-\d{2}-\d{2}$/.test(payload.createdAt)
    ? new Date(`${payload.createdAt}T00:00:00.000Z`).toISOString()
    : undefined
  const expectedDateValue = payload.expectedDate === undefined
    ? current.expected_date
    : payload.expectedDate && /^\d{4}-\d{2}-\d{2}$/.test(payload.expectedDate)
      ? payload.expectedDate
      : null

  const updatePayload = {
    partner_name: payload.partnerName?.trim() || current.partner_name,
    type: payload.type ?? normalizeProductionType(current.type),
    quantity_sent: nextQuantitySent,
    expected_output: nextExpectedOutput,
    received_output: Math.min(nextReceived, nextExpectedOutput),
    note: payload.note === undefined ? current.note : payload.note?.trim() || null,
    expected_date: expectedDateValue,
    seed_price: payload.seedPrice === undefined ? current.seed_price : Math.max(0, Number(payload.seedPrice || 0)),
    pouch_sale_price: payload.pouchSalePrice === undefined ? current.pouch_sale_price : Math.max(0, Number(payload.pouchSalePrice || 0)),
    brick_transform_cost: payload.brickTransformCost === undefined ? current.brick_transform_cost : Math.max(0, Number(payload.brickTransformCost || 0)),
    pouch_transform_cost: payload.pouchTransformCost === undefined ? current.pouch_transform_cost : Math.max(0, Number(payload.pouchTransformCost || 0)),
    ...(createdAtValue ? { created_at: createdAtValue } : {}),
    status: forcedStatus ?? computedStatus,
  }

  const { data, error } = await supabase
    .from('drug_production_tracking')
    .update(updatePayload)
    .eq('id', id)
    .eq('group_id', currentGroupId())
    .select('*')
    .single()

  if (!error) return normalizeProductionRow(data as DrugProductionTrackingRow)

  const pricingColumnMissing =
    isMissingColumnError(error, 'seed_price')
    || isMissingColumnError(error, 'pouch_sale_price')
    || isMissingColumnError(error, 'brick_transform_cost')
    || isMissingColumnError(error, 'pouch_transform_cost')

  if (!pricingColumnMissing) throw new Error(error.message || 'Erreur mise à jour demande')

  const {
    seed_price: _seedPrice,
    pouch_sale_price: _pouchSalePrice,
    brick_transform_cost: _brickTransformCost,
    pouch_transform_cost: _pouchTransformCost,
    ...legacyPayload
  } = updatePayload

  const { data: legacyData, error: legacyError } = await supabase
    .from('drug_production_tracking')
    .update(legacyPayload)
    .eq('id', id)
    .eq('group_id', currentGroupId())
    .select('*')
    .single()

  if (legacyError) throw new Error(legacyError.message || 'Erreur mise à jour demande')
  return normalizeProductionRow(legacyData as DrugProductionTrackingRow)
}

export async function deleteDrugProductionTracking(id: string) {
  const { error } = await supabase
    .from('drug_production_tracking')
    .delete()
    .eq('id', id)
    .eq('group_id', currentGroupId())

  if (error) throw new Error(error.message || 'Erreur suppression demande')
}
