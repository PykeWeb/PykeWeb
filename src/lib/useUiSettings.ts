'use client'

import { useEffect, useMemo, useState } from 'react'
import { getUiSettings, upsertUiSettings, type UiSettingsRow } from '@/lib/uiSettingsApi'

export function useUiSettings() {
  const [settings, setSettings] = useState<UiSettingsRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const s = await getUiSettings()
        if (mounted) setSettings(s)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const labels = useMemo(() => settings?.labels ?? {}, [settings])
  const layouts = useMemo(() => settings?.layouts ?? {}, [settings])

  const setLabel = async (key: string, value: string) => {
    const next = { ...(settings?.labels ?? {}), [key]: value }
    await upsertUiSettings({ labels: next, layouts: settings?.layouts ?? null })
    setSettings((prev) => ({ group_key: prev?.group_key ?? 'default', labels: next, layouts: prev?.layouts ?? null }))
  }

  const setLayout = async (key: string, value: any) => {
    const next = { ...(settings?.layouts ?? {}), [key]: value }
    await upsertUiSettings({ labels: settings?.labels ?? null, layouts: next })
    setSettings((prev) => ({ group_key: prev?.group_key ?? 'default', labels: prev?.labels ?? null, layouts: next }))
  }

  const t = (key: string, fallback: string) => (labels[key] ? String(labels[key]) : fallback)

  return { settings, loading, labels, layouts, setLabel, setLayout, t }
}
