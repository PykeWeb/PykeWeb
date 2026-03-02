import { supabase } from '@/lib/supabaseClient'
import { currentGroupId } from '@/lib/tenantScope'

export type DbWeapon = {
  id: string
  weapon_id?: string | null
  name?: string | null
  description?: string | null
  image_url?: string | null
  stock: number
  created_at: string
}

export type DbWeaponLoan = {
  id: string
  weapon_id: string
  borrower_name: string
  quantity: number
  loaned_at: string
  returned_at?: string | null
  note?: string | null
}

const BUCKET = 'weapon-images'

function getExt(file: File) {
  const byName = file.name.split('.').pop()?.toLowerCase()
  if (byName && byName.length <= 5) return byName
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/webp') return 'webp'
  return 'png'
}

export async function listWeapons(): Promise<DbWeapon[]> {
  const [{ data, error }, globalRes] = await Promise.all([
    supabase.from('weapons').select('id,weapon_id,name,description,image_url,stock,created_at').eq('group_id', currentGroupId()).order('created_at', { ascending: false }),
    fetch('/api/catalog/items?category=weapon', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])),
  ])
  if (error) throw error
  const locals = (data ?? []) as DbWeapon[]
  const names = new Set(locals.map((w) => (w.name || '').toLowerCase()))
  const globals = (Array.isArray(globalRes) ? globalRes : []).map((g: any) => ({ id: g.id, weapon_id: g.weapon_id, name: g.name, description: g.description, image_url: g.image_url, stock: 0, created_at: g.created_at })) as DbWeapon[]
  return [...locals, ...globals.filter((g) => !names.has((g.name || '').toLowerCase()))]
}

export async function createWeapon(args: {
  weapon_id?: string
  name?: string
  quantity?: number
  description?: string
  imageFile?: File | null
}): Promise<DbWeapon> {
  const groupId = currentGroupId()
  const quantity = Math.max(1, Math.floor(args.quantity ?? 1))

  const identifierColumn = args.weapon_id?.trim() ? 'weapon_id' : args.name?.trim() ? 'name' : null
  const identifierValue = args.weapon_id?.trim() || args.name?.trim() || null

  if (identifierColumn && identifierValue) {
    const { data: existing } = await supabase
      .from('weapons')
      .select('id,stock')
      .eq('group_id', groupId)
      .eq(identifierColumn, identifierValue)
      .maybeSingle()

    if (existing?.id) {
      const { data: bumped, error: bumpErr } = await supabase
        .from('weapons')
        .update({ stock: Number(existing.stock ?? 0) + quantity })
        .eq('id', existing.id)
        .eq('group_id', groupId)
        .select('id,weapon_id,name,description,image_url,stock,created_at')
        .single()
      if (bumpErr) throw bumpErr
      return bumped as DbWeapon
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('weapons')
    .insert({
      group_id: groupId,
      weapon_id: args.weapon_id || null,
      name: args.name || null,
      stock: quantity,
      description: args.description || null,
    })
    .select('id,weapon_id,name,description,image_url,stock,created_at')
    .single()

  if (insertError) throw insertError
  if (!inserted) throw new Error('Insert failed')

  if (args.imageFile) {
    const ext = getExt(args.imageFile)
    const path = `${inserted.id}/main.${ext}`

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, args.imageFile, {
      upsert: true,
      contentType: args.imageFile.type || undefined,
    })
    if (uploadError) throw uploadError

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const image_url = publicData.publicUrl

    const { data: updated, error: updateError } = await supabase
      .from('weapons')
      .update({ image_url })
      .eq('id', inserted.id)
      .select('id,weapon_id,name,description,image_url,stock,created_at')
      .single()
    if (updateError) throw updateError
    return updated as DbWeapon
  }

  return inserted as DbWeapon
}

export async function adjustWeaponStock(args: { weaponId: string; delta: number; note?: string }) {
  if (args.weaponId.startsWith('global:')) throw new Error('Stock des items globaux: crée un item local ou override dédié.')
  // Read current stock
  const { data: row, error: getErr } = await supabase.from('weapons').select('id,stock').eq('id', args.weaponId).eq('group_id', currentGroupId()).single()
  if (getErr) throw getErr
  const current = row?.stock ?? 0
  const next = current + args.delta
  if (next < 0) throw new Error('Stock insuffisant')

  const { error: updErr } = await supabase.from('weapons').update({ stock: next }).eq('id', args.weaponId).eq('group_id', currentGroupId())
  if (updErr) throw updErr

  // Optional: log movement (table weapon_stock_movements). If the table is not created yet, ignore.
  try {
    await supabase.from('weapon_stock_movements').insert({
      group_id: currentGroupId(),
      weapon_id: args.weaponId,
      delta: args.delta,
      note: args.note || null,
    })
  } catch {
    // ignore
  }

  return next
}

export async function listActiveWeaponLoans(): Promise<(DbWeaponLoan & { weapon?: DbWeapon | null })[]> {
  const { data, error } = await supabase
    .from('weapon_loans')
    .select('id,weapon_id,borrower_name,quantity,loaned_at,returned_at,note, weapons:weapon_id (id,weapon_id,name,description,image_url,stock,created_at)')
    .eq('group_id', currentGroupId())
    .is('returned_at', null)
    .order('loaned_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as any
}

export async function createWeaponLoan(args: { weaponId: string; borrowerName: string; quantity: number; note?: string }) {
  // Decrement stock first (will error if insufficient)
  await adjustWeaponStock({ weaponId: args.weaponId, delta: -Math.abs(args.quantity), note: `Prêt à ${args.borrowerName}` })

  const { data, error } = await supabase
    .from('weapon_loans')
    .insert({
      group_id: currentGroupId(),
      weapon_id: args.weaponId,
      borrower_name: args.borrowerName,
      quantity: Math.abs(args.quantity),
      note: args.note || null,
    })
    .select('id,weapon_id,borrower_name,quantity,loaned_at,returned_at,note')
    .single()
  if (error) throw error
  return data as DbWeaponLoan
}

export async function closeWeaponLoan(args: { loanId: string }) {
  const { data: loan, error: getErr } = await supabase
    .from('weapon_loans')
    .select('id,weapon_id,borrower_name,quantity,returned_at')
    .eq('id', args.loanId)
    .eq('group_id', currentGroupId())
    .single()
  if (getErr) throw getErr
  if (!loan) throw new Error('Loan not found')
  if (loan.returned_at) return

  // Mark returned
  const { error: updErr } = await supabase
    .from('weapon_loans')
    .update({ returned_at: new Date().toISOString() })
    .eq('id', args.loanId)
    .eq('group_id', currentGroupId())
  if (updErr) throw updErr

  // Increment stock back
  await adjustWeaponStock({ weaponId: loan.weapon_id, delta: Math.abs(loan.quantity), note: `Retour prêt ${loan.borrower_name}` })
}

export async function updateWeapon(args: {
  id: string
  weapon_id?: string | null
  name?: string | null
  description?: string | null
  imageFile?: File | null
}) {
  if (args.id.startsWith('global:')) {
    const res = await fetch('/api/catalog/overrides', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ global_item_id: args.id.replace('global:', ''), override_name: args.name, override_weapon_id: args.weapon_id, is_hidden: false }),
    })
    if (!res.ok) throw new Error(await res.text())
    return
  }

  const { data: updatedBase, error: baseErr } = await supabase
    .from('weapons')
    .update({
      weapon_id: args.weapon_id || null,
      name: args.name || null,
      description: args.description || null,
    })
    .eq('id', args.id)
    .eq('group_id', currentGroupId())
    .select('id,weapon_id,name,description,image_url,stock,created_at')
    .single()

  if (baseErr) throw baseErr

  if (args.imageFile) {
    const ext = getExt(args.imageFile)
    const path = `${args.id}/main.${ext}`
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, args.imageFile, {
      upsert: true,
      contentType: args.imageFile.type || undefined,
    })
    if (uploadError) throw uploadError

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const { data: updatedWithImage, error: imageErr } = await supabase
      .from('weapons')
      .update({ image_url: publicData.publicUrl })
      .eq('id', args.id)
    .eq('group_id', currentGroupId())
      .select('id,weapon_id,name,description,image_url,stock,created_at')
      .single()
    if (imageErr) throw imageErr
    return updatedWithImage as DbWeapon
  }

  return updatedBase as DbWeapon
}

export async function deleteWeapon(weaponId: string) {
  if (weaponId.startsWith('global:')) {
    const res = await fetch('/api/catalog/overrides', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ global_item_id: weaponId.replace('global:', ''), is_hidden: true }) })
    if (!res.ok) throw new Error(await res.text())
    return
  }
  const { error } = await supabase.from('weapons').delete().eq('id', weaponId).eq('group_id', currentGroupId())
  if (error) throw error
}
