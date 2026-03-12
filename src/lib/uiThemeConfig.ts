export const UI_THEME_CONFIG_KEY = '__ui_theme_config__'

export type UiBubbleConfig = {
  label?: string
  icon?: string
  bgColor?: string
  borderColor?: string
  textColor?: string
  iconBgColor?: string
  iconColor?: string
}

export type UiCustomDashboardBubble = {
  id: string
  title: string
  href: string
  value?: string
  icon?: string
  bgColor?: string
  borderColor?: string
  textColor?: string
}

export type UiThemeConfig = {
  bubbles: Record<string, UiBubbleConfig>
  customDashboardBubbles: UiCustomDashboardBubble[]
}

export const defaultUiThemeConfig: UiThemeConfig = {
  bubbles: {},
  customDashboardBubbles: [],
}

export function parseUiThemeConfig(raw: string | null | undefined): UiThemeConfig {
  if (!raw) return defaultUiThemeConfig
  try {
    const parsed = JSON.parse(raw) as Partial<UiThemeConfig>
    return {
      bubbles: parsed.bubbles && typeof parsed.bubbles === 'object' ? parsed.bubbles as Record<string, UiBubbleConfig> : {},
      customDashboardBubbles: Array.isArray(parsed.customDashboardBubbles) ? parsed.customDashboardBubbles : [],
    }
  } catch {
    return defaultUiThemeConfig
  }
}

export function buildUiThemeConfigFromOverrides(overrides: Record<string, string> | null | undefined): UiThemeConfig {
  return parseUiThemeConfig(overrides?.[UI_THEME_CONFIG_KEY])
}
