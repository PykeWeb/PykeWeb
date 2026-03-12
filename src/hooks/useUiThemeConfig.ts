'use client'

import { useEffect, useState } from 'react'
import { buildUiThemeConfigFromOverrides, defaultUiThemeConfig, type UiThemeConfig } from '@/lib/uiThemeConfig'

export function useUiThemeConfig() {
  const [config, setConfig] = useState<UiThemeConfig>(defaultUiThemeConfig)

  useEffect(() => {
    let alive = true

    async function load() {
      try {
        const res = await fetch('/api/ui-texts', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { overrides?: Record<string, string> }
        if (!alive) return
        setConfig(buildUiThemeConfigFromOverrides(data.overrides))
      } catch {
        // no-op
      }
    }

    void load()
    const timer = window.setInterval(() => {
      if (document.hidden) return
      void load()
    }, 4000)

    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  return config
}
