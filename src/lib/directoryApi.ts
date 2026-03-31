import { supabase } from '@/lib/supabase/client'
import { currentGroupId } from '@/lib/tenantScope'

export type DirectoryActivity = 'coke' | 'meth' | 'objects' | 'weapons' | 'equipment' | 'group' | 'other'

export type DirectoryContact = {
  id: string
  group_id: string
  name: string
  partner_group: string | null
  phone: string | null
  activity: DirectoryActivity
  note: string | null
  created_at: string
  updated_at: string
}

type DirectoryContactRow = {
  id: string
  group_id: string
  name: string | null
  partner_group: string | null
  phone: string | null
  activity: string | null
  note: string | null
  created_at: string
  updated_at: string
}

const GROUP_ACTIVITY_TAG = '[activity:group]'

function normalizeActivity(value: string | null | undefined): DirectoryActivity {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (!raw) return 'other'
  if (raw.includes('coke') || raw.includes('cocaine')) return 'coke'
  if (raw.includes('meth')) return 'meth'
  if (['objects', 'object', 'objets', 'objet'].includes(raw)) return 'objects'
  if (['weapons', 'weapon', 'armes', 'arme'].includes(raw)) return 'weapons'
  if (['equipment', 'equipement', 'equipements'].includes(raw)) return 'equipment'
  if (['members', 'member', 'membres', 'membre'].includes(raw)) return 'group'
  if (['group', 'groupe', 'groupes'].includes(raw)) return 'group'
  if (['other', 'autre', 'autres', 'misc'].includes(raw)) return 'other'
  return 'other'
}

function encodeActivityPayload(activity: DirectoryActivity, note: string | null | undefined) {
  const baseNote = note?.trim() || ''
  const noteWithoutTag = baseNote.replace(GROUP_ACTIVITY_TAG, '').trim()

  if (activity === 'group') {
    const taggedNote = noteWithoutTag ? `${noteWithoutTag}\n${GROUP_ACTIVITY_TAG}` : GROUP_ACTIVITY_TAG
    return { dbActivity: 'other' as const, dbNote: taggedNote }
  }

  return { dbActivity: activity, dbNote: noteWithoutTag || null }
}

function normalizeRow(row: DirectoryContactRow): DirectoryContact {
  const normalizedActivity = normalizeActivity(row.activity)
  const rawNote = row.note?.trim() || ''
  const hasGroupTag = rawNote.includes(GROUP_ACTIVITY_TAG)
  const cleanedNote = rawNote.replace(GROUP_ACTIVITY_TAG, '').trim()

  return {
    id: row.id,
    group_id: row.group_id,
    name: String(row.name || '').trim(),
    partner_group: row.partner_group?.trim() || null,
    phone: row.phone?.trim() || null,
    activity: normalizedActivity === 'other' && hasGroupTag ? 'group' : normalizedActivity,
    note: cleanedNote || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function listDirectoryContacts(): Promise<DirectoryContact[]> {
  const { data, error } = await supabase
    .from('directory_contacts')
    .select('id,group_id,name,partner_group,phone,activity,note,created_at,updated_at')
    .eq('group_id', currentGroupId())
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message || 'Impossible de charger l\'annuaire.')
  return ((data ?? []) as DirectoryContactRow[]).map(normalizeRow)
}

export async function createDirectoryContact(args: {
  name: string
  partner_group?: string | null
  phone?: string | null
  activity: DirectoryActivity
  note?: string | null
}): Promise<DirectoryContact> {
  const name = args.name.trim()
  if (!name) throw new Error('Le nom est obligatoire.')
  const payloadActivity = encodeActivityPayload(normalizeActivity(args.activity), args.note)

  const payload = {
    group_id: currentGroupId(),
    name,
    partner_group: args.partner_group?.trim() || null,
    phone: args.phone?.trim() || null,
    activity: payloadActivity.dbActivity,
    note: payloadActivity.dbNote,
  }

  const { data, error } = await supabase
    .from('directory_contacts')
    .insert(payload)
    .select('id,group_id,name,partner_group,phone,activity,note,created_at,updated_at')
    .single<DirectoryContactRow>()

  if (error) throw new Error(error.message || 'Création impossible.')
  if (!data) throw new Error('Création impossible.')
  return normalizeRow(data)
}

export async function updateDirectoryContact(args: {
  id: string
  name: string
  partner_group?: string | null
  phone?: string | null
  activity: DirectoryActivity
  note?: string | null
}): Promise<void> {
  const name = args.name.trim()
  if (!name) throw new Error('Le nom est obligatoire.')
  const payloadActivity = encodeActivityPayload(normalizeActivity(args.activity), args.note)

  const { error } = await supabase
    .from('directory_contacts')
    .update({
      name,
      partner_group: args.partner_group?.trim() || null,
      phone: args.phone?.trim() || null,
      activity: payloadActivity.dbActivity,
      note: payloadActivity.dbNote,
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.id)
    .eq('group_id', currentGroupId())

  if (error) throw new Error(error.message || 'Modification impossible.')
}

export async function deleteDirectoryContact(id: string): Promise<void> {
  const { error } = await supabase
    .from('directory_contacts')
    .delete()
    .eq('id', id)
    .eq('group_id', currentGroupId())

  if (error) throw new Error(error.message || 'Suppression impossible.')
}
