'use client'

import { useEffect, useState } from 'react'
import {
  DEFAULT_LABELS,
  DEFAULT_LAYOUTS,
  getUiSettings,
  updateUiLabels,
  updateUiLayouts,
  type UiLabels,
  type UiLayouts,
} from '@/lib/uiSettingsApi'

export function useUiSettings() {
  const [labels, setLabels] = useState<UiLabels>(DEFAULT_LABELS)
  const [layouts, setLayouts] = useState<UiLayouts>(DEFAULT_LAYOUTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const s = await getUiSettings()
        if (!alive) return
        setLabels(s.labels)
        setLayouts(s.layouts)
      } catch (e: any) {
        if (!alive) return
        setError(e?.message || 'Erreur')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  async function saveLabels(next: UiLabels) {
    setLabels(next)
    await updateUiLabels(next)
  }

  async function saveLayouts(next: UiLayouts) {
    setLayouts(next)
    await updateUiLayouts(next)
  }

  return { labels, layouts, loading, error, saveLabels, saveLayouts }
}
