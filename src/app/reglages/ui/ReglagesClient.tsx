'use client'

import { useMemo, useState } from 'react'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { useUiSettings } from '@/lib/useUiSettings'
import { DEFAULT_LABELS } from '@/lib/uiSettingsApi'

export default function ReglagesClient() {
  const { labels, loading, error, saveLabels } = useUiSettings()
  const [busy, setBusy] = useState(false)

  const keys = useMemo(() => Object.keys(DEFAULT_LABELS), [])

  async function onSave(next: Record<string, string>) {
    setBusy(true)
    try {
      await saveLabels(next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Textes UI</h2>
          <p className="mt-1 text-sm text-white/60">Tu peux modifier les libellés (sidebar, nom du site). Effet immédiat.</p>
        </div>
        <div className="text-xs text-white/60">{loading ? 'Chargement…' : 'OK'}</div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {keys.map((k) => (
          <LabelRow key={k} k={k} value={labels[k] ?? ''} disabled={busy} onSave={onSave} all={labels} />
        ))}
      </div>
    </Panel>
  )
}

function LabelRow({
  k,
  value,
  disabled,
  onSave,
  all,
}: {
  k: string
  value: string
  disabled: boolean
  all: Record<string, string>
  onSave: (next: Record<string, string>) => Promise<void>
}) {
  const [v, setV] = useState(value)
  const changed = v !== value

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs font-semibold text-white/70">{k}</p>
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        disabled={disabled}
        className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-white/20"
      />
      <div className="mt-3 flex justify-end">
        <Button
          variant="secondary"
          disabled={disabled || !changed}
          onClick={() => onSave({ ...all, [k]: v })}
        >
          Enregistrer
        </Button>
      </div>
    </div>
  )
}
