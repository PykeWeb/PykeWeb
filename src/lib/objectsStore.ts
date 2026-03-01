export type ObjectItem = {
  id: string
  name: string
  price: number
  description?: string
  imageDataUrl?: string
  stock: number
  createdAt: string
}

const KEY = 'crewvault.objects.v1'

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function getObjects(): ObjectItem[] {
  if (typeof window === 'undefined') return []
  const data = safeParse<ObjectItem[]>(window.localStorage.getItem(KEY))
  return Array.isArray(data) ? data : []
}

export function saveObjects(items: ObjectItem[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(KEY, JSON.stringify(items))
}

export function addObject(item: ObjectItem) {
  const items = getObjects()
  items.unshift(item)
  saveObjects(items)
}

export async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Impossible de lire le fichier'))
    reader.readAsDataURL(file)
  })
}
