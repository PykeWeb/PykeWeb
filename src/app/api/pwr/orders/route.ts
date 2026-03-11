import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireGroupSession } from '@/server/auth/requireSession'

function toPositiveInt(value: unknown, fallback: number) {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.max(1, Math.floor(num))
}

function sanitizeUnitLabel(value: unknown) {
  const raw = String(value || '').trim()
  return raw || 'bidons'
}

export async function GET(request: Request) {
  try {
    const session = await requireGroupSession(request)
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('pwr_orders')
      .select('id,group_id,title,target_qty,truck_capacity,delivered_qty,unit_label,created_at,updated_at')
      .eq('group_id', session.groupId)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Non autorisé.'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireGroupSession(request)
    const body = await request.json() as {
      title?: string
      targetQty?: number
      truckCapacity?: number
      unitLabel?: string
    }

    const title = String(body.title || '').trim()
    if (!title) return NextResponse.json({ error: 'Nom de commande requis.' }, { status: 400 })

    const targetQty = toPositiveInt(body.targetQty, 3000)
    const truckCapacity = toPositiveInt(body.truckCapacity, 475)
    const unitLabel = sanitizeUnitLabel(body.unitLabel)

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('pwr_orders')
      .insert({
        group_id: session.groupId,
        title,
        target_qty: targetQty,
        truck_capacity: truckCapacity,
        delivered_qty: 0,
        unit_label: unitLabel,
      })
      .select('id,group_id,title,target_qty,truck_capacity,delivered_qty,unit_label,created_at,updated_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
