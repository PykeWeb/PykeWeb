import { supabase } from '@/lib/supabaseClient'

export type UiSettingsRow = {
  group_key: string
  labels: Record<string, string> | null
  layouts: Record<string, any> | null
}

function getGroupKey(): string {
  return (
    process.env.NEXT_PUBLIC_GROUP_KEY ||
    process.env.NEXT_PUBLIC_GROUP_NAME ||
    'default'
  )
}

export async function getUiSettings(): Promise<UiSettingsRow | null> {
  const group_key = getGroupKey()
  const { data, error } = await supabase
    .from('ui_settings')
    .select('group_key, labels, layouts')
    .eq('group_key', group_key)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return data as UiSettingsRow
}

export async function upsertUiSettings(patch: Partial<UiSettingsRow>): Promise<void> {
  const group_key = getGroupKey()
  const { error } = await supabase.from('ui_settings').upsert(
    {
      group_key,
      labels: patch.labels ?? null,
      layouts: patch.layouts ?? null
    },
    { onConflict: 'group_key' }
  )
  if (error) throw error
}
