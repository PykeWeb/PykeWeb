import { supabase } from '@/lib/supabaseClient'

export type UiLabels = Record<string, string>
export type UiLayouts = Record<string, string[]>

export type UiSettingsRow = {
  key: string
  labels: UiLabels
  layouts: UiLayouts
  updated_at: string
}

const SETTINGS_KEY = 'default'

export const DEFAULT_LABELS: UiLabels = {
  site_name: 'Pyke Stock',
  site_tagline: 'Dashboard RP (FiveM)',
  nav_dashboard: 'Dashboard',
  nav_objets: 'Objets',
  nav_armes: 'Armes',
  nav_equipement: 'Équipement',
  nav_drogues: 'Drogues',
  nav_depenses: 'Dépenses',
  nav_reglages: 'Réglages',
}

export const DEFAULT_LAYOUTS: UiLayouts = {
  drogues_plantations: ['prod', 'coke', 'meth'],
}

export async function getUiSettings(): Promise<UiSettingsRow> {
  const { data, error } = await supabase
    .from('ui_settings')
    .select('key,labels,layouts,updated_at')
    .eq('key', SETTINGS_KEY)
    .maybeSingle()

  if (error) throw new Error(error.message)

  if (!data) {
    // create default row
    const insert = {
      key: SETTINGS_KEY,
      labels: DEFAULT_LABELS,
      layouts: DEFAULT_LAYOUTS,
    }
    const { data: created, error: e2 } = await supabase.from('ui_settings').insert(insert).select().single()
    if (e2) throw new Error(e2.message)
    return created as UiSettingsRow
  }

  return {
    key: data.key,
    labels: { ...DEFAULT_LABELS, ...(data.labels || {}) },
    layouts: { ...DEFAULT_LAYOUTS, ...(data.layouts || {}) },
    updated_at: data.updated_at,
  } as UiSettingsRow
}

export async function updateUiLabels(next: UiLabels) {
  const { error } = await supabase
    .from('ui_settings')
    .update({ labels: next, updated_at: new Date().toISOString() })
    .eq('key', SETTINGS_KEY)
  if (error) throw new Error(error.message)
}

export async function updateUiLayouts(next: UiLayouts) {
  const { error } = await supabase
    .from('ui_settings')
    .update({ layouts: next, updated_at: new Date().toISOString() })
    .eq('key', SETTINGS_KEY)
  if (error) throw new Error(error.message)
}
