import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireGroupSession } from '@/server/auth/requireSession'

type CatalogItem = {
  id: string
  name: string
  category: string
  stock: number
  price: number
  image_url: string | null
}

type ScanItem = {
  detected_label: string
  matched_item_id: string | null
  matched_item_name: string | null
  estimated_quantity: number
  confidence: number
  alternatives: Array<{ item_id: string; item_name: string }>
  reasoning?: string
}

type ScanResponse = {
  items: ScanItem[]
  global_confidence: number
  notes: string[]
}

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_ITEMS = 40
const REQUESTS_PER_MINUTE = 8

const rateBucket = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const current = rateBucket.get(key)
  if (!current || current.resetAt <= now) {
    rateBucket.set(key, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (current.count >= REQUESTS_PER_MINUTE) return false
  current.count += 1
  rateBucket.set(key, current)
  return true
}

function clampConfidence(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function normalizeQuantity(value: unknown) {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

function sanitizeScanPayload(raw: any, catalogMap: Map<string, CatalogItem>): ScanResponse {
  const srcItems = Array.isArray(raw?.items) ? raw.items.slice(0, MAX_ITEMS) : []
  const items: ScanItem[] = srcItems.map((entry: any) => {
    const matchedIdRaw = typeof entry?.matched_item_id === 'string' ? entry.matched_item_id : null
    const matched = matchedIdRaw ? catalogMap.get(matchedIdRaw) : undefined
    const alternatives = Array.isArray(entry?.alternatives)
      ? entry.alternatives
        .map((alt: any) => {
          const altId = typeof alt?.item_id === 'string' ? alt.item_id : ''
          const mapped = catalogMap.get(altId)
          if (!mapped) return null
          return { item_id: mapped.id, item_name: mapped.name }
        })
        .filter(Boolean)
      : []

    return {
      detected_label: typeof entry?.detected_label === 'string' ? entry.detected_label.slice(0, 100) : 'unknown',
      matched_item_id: matched ? matched.id : null,
      matched_item_name: matched ? matched.name : null,
      estimated_quantity: normalizeQuantity(entry?.estimated_quantity),
      confidence: clampConfidence(entry?.confidence),
      alternatives,
      reasoning: typeof entry?.reasoning === 'string' ? entry.reasoning.slice(0, 180) : undefined,
    }
  })

  const notes = Array.isArray(raw?.notes)
    ? raw.notes.filter((n: unknown) => typeof n === 'string').slice(0, 5)
    : []
  const globalConfidence = clampConfidence(raw?.global_confidence)

  return {
    items,
    notes,
    global_confidence: globalConfidence,
  }
}

async function readAsDataUrl(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  return `data:${file.type};base64,${base64}`
}

function buildPrompt(catalog: CatalogItem[]) {
  return [
    'Tu analyses une capture d\'inventaire FiveM.',
    'Règles obligatoires :',
    '- Ne renvoie que des items du catalogue transmis.',
    '- Si incertain, matched_item_id = null et matched_item_name = "unknown".',
    '- estimated_quantity doit être un entier >= 0.',
    '- confidence entre 0 et 1.',
    '- alternatives: 0 à 3 propositions provenant uniquement du catalogue.',
    '- Ne jamais inventer un item hors catalogue.',
    '',
    'Catalogue JSON:',
    JSON.stringify(catalog),
  ].join('\n')
}

export async function POST(request: Request) {
  try {
    const session = await requireGroupSession(request)
    const rateKey = `${session.groupId}`
    if (!checkRateLimit(rateKey)) {
      return NextResponse.json({ error: 'Trop de scans. Réessaie dans une minute.' }, { status: 429 })
    }

    const form = await request.formData()
    const file = form.get('image')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Image manquante.' }, { status: 400 })
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Format non supporté (JPG/PNG/WebP).' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Image trop lourde (max 5 Mo).' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    const model = process.env.OPENAI_SCAN_MODEL || 'gpt-4.1-mini'
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY manquante côté serveur. Ajoute-la dans .env.local puis redémarre Next.js.' },
        { status: 500 }
      )
    }

    const supabase = getSupabaseAdmin()
    const { data: catalogRows, error: catalogErr } = await supabase
      .from('objects')
      .select('id,name,price,stock,image_url')
      .eq('group_id', session.groupId)
      .order('name', { ascending: true })

    if (catalogErr) {
      console.error('[scan-inventaire] catalog error', catalogErr)
      return NextResponse.json({ error: 'Impossible de charger le catalogue du groupe.' }, { status: 500 })
    }

    const catalog: CatalogItem[] = (catalogRows ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      category: 'Objets',
      stock: Number(row.stock ?? 0),
      price: Number(row.price ?? 0),
      image_url: row.image_url ?? null,
    }))

    if (catalog.length === 0) {
      return NextResponse.json({ error: 'Catalogue vide. Ajoute des items avant un scan.' }, { status: 400 })
    }

    const imageDataUrl = await readAsDataUrl(file)
    const prompt = buildPrompt(catalog)

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: 'Tu es un assistant OCR inventaire très strict.' }],
          },
          {
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              { type: 'input_image', image_url: imageDataUrl },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'scan_inventory_result',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                global_confidence: { type: 'number' },
                notes: {
                  type: 'array',
                  items: { type: 'string' },
                },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      detected_label: { type: 'string' },
                      matched_item_id: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                      matched_item_name: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                      estimated_quantity: { type: 'integer' },
                      confidence: { type: 'number' },
                      reasoning: { type: 'string' },
                      alternatives: {
                        type: 'array',
                        items: {
                          type: 'object',
                          additionalProperties: false,
                          properties: {
                            item_id: { type: 'string' },
                            item_name: { type: 'string' },
                          },
                          required: ['item_id', 'item_name'],
                        },
                      },
                    },
                    required: [
                      'detected_label',
                      'matched_item_id',
                      'matched_item_name',
                      'estimated_quantity',
                      'confidence',
                      'reasoning',
                      'alternatives',
                    ],
                  },
                },
              },
              required: ['items', 'global_confidence', 'notes'],
            },
          },
        },
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('[scan-inventaire] openai error', response.status, text)
      return NextResponse.json({ error: 'Erreur IA pendant l’analyse.' }, { status: 502 })
    }

    const payload = await response.json()
    const outputText = payload?.output_text
    if (!outputText || typeof outputText !== 'string') {
      return NextResponse.json({ error: 'Réponse IA invalide.' }, { status: 502 })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(outputText)
    } catch {
      return NextResponse.json({ error: 'Impossible de lire la réponse JSON de l’IA.' }, { status: 502 })
    }

    const catalogMap = new Map(catalog.map((item) => [item.id, item]))
    const result = sanitizeScanPayload(parsed, catalogMap)

    return NextResponse.json({
      scan: result,
      catalog,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur interne'
    console.error('[scan-inventaire] fatal', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
