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
}

const BRICK_TAX_RATE = 0.05
const POUCHES_PER_BRICK = 10

function computeStatus(received: number, expected: number, current?: ProductionStatus): ProductionStatus {
  if (current === 'cancelled') return 'cancelled'
  if (received >= expected && expected > 0) return 'completed'
  return 'in_progress'
}

export async function listDrugProductionTrackings(): Promise<DrugProductionTrackingRow[]> {
  const { data, error } = await supabase
    .from('drug_production_tracking')
    .select('*')
    .eq('group_id', currentGroupId())
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as DrugProductionTrackingRow[]
}

export async function createDrugProductionTracking(payload: {
  partnerName: string
  type: ProductionType
  quantitySent: number
  ratio: number
  receivedOutput?: number
  note?: string
  createdAt?: string
  expectedDate?: string
}) {
  const quantitySent = Math.max(0, Math.floor(payload.quantitySent || 0))
  const ratio = Math.max(0, Number(payload.ratio || 0))
  const totalLeaves = quantitySent * ratio
  const netBricks = Math.max(0, totalLeaves * (1 - BRICK_TAX_RATE))
  const expectedOutput = Math.max(0, Math.floor(netBricks * POUCHES_PER_BRICK))
  const receivedOutput = Math.max(0, Math.floor(payload.receivedOutput || 0))
  const status = computeStatus(receivedOutput, expectedOutput)

  const { data, error } = await supabase
    .from('drug_production_tracking')
    .insert({
      group_id: currentGroupId(),
      partner_name: payload.partnerName,
      type: payload.type,
      quantity_sent: quantitySent,
      ratio,
      expected_output: expectedOutput,
      received_output: Math.min(receivedOutput, expectedOutput || receivedOutput),
      status,
      note: payload.note?.trim() || null,
      created_at: payload.createdAt || undefined,
      expected_date: payload.expectedDate || null,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as DrugProductionTrackingRow
}

export async function updateDrugProductionTracking(id: string, payload: {
  receivedOutput?: number
  note?: string
  status?: ProductionStatus
}) {
  const { data: current, error: getError } = await supabase
    .from('drug_production_tracking')
    .select('*')
    .eq('id', id)
    .eq('group_id', currentGroupId())
    .single()

  if (getError) throw getError

  const nextReceived = payload.receivedOutput === undefined
    ? Number(current.received_output || 0)
    : Math.max(0, Math.floor(payload.receivedOutput || 0))

  const forcedStatus = payload.status
  const computedStatus = forcedStatus === 'cancelled'
    ? 'cancelled'
    : computeStatus(nextReceived, Number(current.expected_output || 0), current.status)

  const { data, error } = await supabase
    .from('drug_production_tracking')
    .update({
      received_output: Math.min(nextReceived, Math.max(0, Number(current.expected_output || 0))),
      note: payload.note === undefined ? current.note : payload.note?.trim() || null,
      status: forcedStatus ?? computedStatus,
    })
    .eq('id', id)
    .eq('group_id', currentGroupId())
    .select('*')
    .single()

  if (error) throw error
  return data as DrugProductionTrackingRow
}
