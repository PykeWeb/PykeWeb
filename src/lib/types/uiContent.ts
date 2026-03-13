export type EditableTextAlign = 'left' | 'center' | 'right'

export type EditableTextStyle = {
  fontSize: number
  color: string
  align: EditableTextAlign
  marginTop: number
  padding: number
  x: number
  y: number
}

export type EditableTextBlock = {
  id: string
  content: string
  style: EditableTextStyle
}

export type PageHeaderContentConfig = {
  title?: EditableTextBlock
  subtitle?: EditableTextBlock
  extraBlocks: EditableTextBlock[]
}

export const defaultEditableTextStyle: EditableTextStyle = {
  fontSize: 16,
  color: '#ffffff',
  align: 'left',
  marginTop: 0,
  padding: 0,
  x: 0,
  y: 0,
}

export function normalizeEditableTextStyle(input: Partial<EditableTextStyle> | null | undefined): EditableTextStyle {
  const fontSize = Number(input?.fontSize)
  const marginTop = Number(input?.marginTop)
  const padding = Number(input?.padding)
  const x = Number(input?.x)
  const y = Number(input?.y)
  const alignRaw = input?.align

  return {
    fontSize: Number.isFinite(fontSize) ? Math.max(10, Math.min(72, fontSize)) : defaultEditableTextStyle.fontSize,
    color: typeof input?.color === 'string' && input.color.trim() ? input.color : defaultEditableTextStyle.color,
    align: alignRaw === 'center' || alignRaw === 'right' ? alignRaw : 'left',
    marginTop: Number.isFinite(marginTop) ? Math.max(-200, Math.min(200, marginTop)) : defaultEditableTextStyle.marginTop,
    padding: Number.isFinite(padding) ? Math.max(0, Math.min(120, padding)) : defaultEditableTextStyle.padding,
    x: Number.isFinite(x) ? Math.max(-1200, Math.min(1200, x)) : defaultEditableTextStyle.x,
    y: Number.isFinite(y) ? Math.max(-1200, Math.min(1200, y)) : defaultEditableTextStyle.y,
  }
}

export function normalizePageHeaderContentConfig(input: unknown): PageHeaderContentConfig {
  const raw = input && typeof input === 'object' ? (input as Partial<PageHeaderContentConfig>) : {}

  function normalizeBlock(block: unknown, fallbackContent = ''): EditableTextBlock {
    const rawBlock = block && typeof block === 'object' ? (block as Partial<EditableTextBlock>) : {}
    return {
      id: typeof rawBlock.id === 'string' && rawBlock.id.trim() ? rawBlock.id : `block-${Math.random().toString(36).slice(2, 10)}`,
      content: typeof rawBlock.content === 'string' ? rawBlock.content : fallbackContent,
      style: normalizeEditableTextStyle(rawBlock.style),
    }
  }

  return {
    title: raw.title ? normalizeBlock(raw.title) : undefined,
    subtitle: raw.subtitle ? normalizeBlock(raw.subtitle) : undefined,
    extraBlocks: Array.isArray(raw.extraBlocks) ? raw.extraBlocks.map((block) => normalizeBlock(block)).filter((block) => block.content.trim()) : [],
  }
}
