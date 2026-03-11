import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireGroupSession } from '@/server/auth/requireSession'

const BUCKET = 'pwr-order-photos'
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
const MAX_FILE_SIZE = 8 * 1024 * 1024

function toNonNegativeInt(value: unknown) {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0
  return Math.max(0, Math.floor(num))
}

async function assertPwrGroup(groupId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('tenant_groups')
    .select('login,name,badge')
    .eq('id', groupId)
    .maybeSingle<{ login: string | null; name: string | null; badge: string | null }>()

  if (error) throw new Error(error.message)

  const scope = `${data?.login || ''} ${data?.name || ''} ${data?.badge || ''}`.toLowerCase()
  if (!scope.includes('pwr')) throw new Error('Accès réservé au groupe PWR.')
}

async function ensureBucket() {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.storage.listBuckets()
  if (error) throw new Error(error.message)
  const exists = (data ?? []).some((bucket) => bucket.name === BUCKET)
  if (exists) return

  const { error: createError } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_FILE_SIZE,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  })
  if (createError) throw new Error(createError.message)
}

async function loadOrder(groupId: string, orderId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('pwr_orders')
    .select('id,group_id,delivered_qty,target_qty,truck_capacity,unit_label')
    .eq('id', orderId)
    .eq('group_id', groupId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Commande introuvable.')
  return data
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireGroupSession(request)
    await assertPwrGroup(session.groupId)

    const { id } = await context.params
    await loadOrder(session.groupId, id)

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('pwr_order_checkpoints')
      .select('id,order_id,group_id,delivered_qty,note,photo_url,created_at')
      .eq('group_id', session.groupId)
      .eq('order_id', id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Non autorisé.'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireGroupSession(request)
    await assertPwrGroup(session.groupId)

    const { id } = await context.params
    const order = await loadOrder(session.groupId, id)
    const form = await request.formData()

    const addedQty = toNonNegativeInt(form.get('addedQty'))
    if (addedQty <= 0) return NextResponse.json({ error: 'Quantité ajoutée invalide.' }, { status: 400 })

    const note = String(form.get('note') || '').trim()
    const photo = form.get('photo')

    let photoUrl: string | null = null

    if (photo instanceof File && photo.size > 0) {
      if (!ALLOWED_MIME_TYPES.has(photo.type)) {
        return NextResponse.json({ error: 'Format photo non supporté (PNG/JPEG/WebP).' }, { status: 400 })
      }
      if (photo.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'Photo trop lourde (max 8 Mo).' }, { status: 400 })
      }

      await ensureBucket()
      const ext = photo.type.includes('png') ? 'png' : photo.type.includes('webp') ? 'webp' : 'jpg'
      const path = `${session.groupId}/${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const supabase = getSupabaseAdmin()
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, photo, {
        upsert: true,
        contentType: photo.type || undefined,
      })
      if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
      photoUrl = data.publicUrl
    }

    const supabase = getSupabaseAdmin()
    const currentDelivered = toNonNegativeInt(order.delivered_qty)
    const targetQty = Math.max(1, toNonNegativeInt(order.target_qty))
    const remaining = Math.max(0, targetQty - currentDelivered)
    const safeAdded = Math.min(remaining, addedQty)
    const nextDeliveredQty = currentDelivered + safeAdded

    if (safeAdded <= 0) {
      return NextResponse.json({ error: 'Commande déjà complète.' }, { status: 400 })
    }

    const [{ data, error }, { error: updateError }] = await Promise.all([
      supabase
        .from('pwr_order_checkpoints')
        .insert({
          group_id: session.groupId,
          order_id: id,
          delivered_qty: safeAdded,
          note: note || null,
          photo_url: photoUrl,
        })
        .select('id,order_id,group_id,delivered_qty,note,photo_url,created_at')
        .single(),
      supabase
        .from('pwr_orders')
        .update({ delivered_qty: nextDeliveredQty })
        .eq('id', id)
        .eq('group_id', session.groupId),
    ])

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
