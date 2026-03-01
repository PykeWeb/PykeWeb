'use client'

import { useMemo, useState } from 'react'
import { Panel } from '@/components/ui/Panel'
import { useUiSettings } from '@/lib/useUiSettings'
import { BRAND } from '@/lib/brand'

const FIELD_DEFS: { key: string; label: string; placeholder: string }[] = [
  { key: 'brand.name', label: 'Nom du site', placeholder: BRAND.name },
  { key: 'nav.dashboard', label: 'Menu — Dashboard', placeholder: 'Dashboard' },
  { key: 'nav.objets', label: 'Menu — Objets', placeholder: 'Objets' },
  { key: 'nav.armes', label: 'Menu — Armes', placeholder: 'Armes' },
  { key: 'nav.equipement', label: 'Menu — Équipement', placeholder: 'Équipement' },
  { key: 'nav.drogues', label: 'Menu — Drogues', placeholder: 'Drogues' },
  { key: 'nav.depenses', label: 'Menu — Dépenses', placeholder: 'Dépenses' },
  { key: 'title.drogues.plantations', label: 'Titre — Drogues > Plantations', placeholder: 'Plantations' }
]

export default function ReglagesPage() {
  const { loading, labels, setLabel } = useUiSettings()
  const [saving, setSaving] = useState<string | null>(null)

  const values = useMemo(() => {
    const v: Record<string, string> = {}
    for (const f of FIELD_DEFS) v[f.key] = labels[f.key] ?? ''
    return v
  }, [labels])

  const [form, setForm] = useState<Record<string, string>>({})

  const getValue = (key: string) => (key in form ? form[key] : values[key] ?? '')

  const saveOne = async (key: string) => {
    setSaving(key)
    try {
      await setLabel(key, getValue(key))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-4">
      <Panel title="Réglages" subtitle="Modifie les titres / menus et sauvegarde directement dans Supabase (ui_settings).">
        {loading ? (
          <p className="text-sm text-white/70">Chargement…</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {FIELD_DEFS.map((f) => (
              <div key={f.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 text-xs font-semibold text-white/70">{f.label}</div>
                <input
                  value={getValue(f.key)}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
                />
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-white/40">{f.key}</span>
                  <button
                    onClick={() => saveOne(f.key)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium hover:bg-white/10"
                  >
                    {saving === f.key ? 'Sauvegarde…' : 'Sauvegarder'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Ordre des bulles" subtitle="Le drag & drop sur certaines pages se sauvegarde dans ui_settings.layouts.">
        <p className="text-sm text-white/70">
          Va dans <span className="font-semibold">Drogues → Plantations</span> et déplace les modules. L’ordre sera gardé
          pour ce groupe.
        </p>
      </Panel>
    </div>
  )
}
