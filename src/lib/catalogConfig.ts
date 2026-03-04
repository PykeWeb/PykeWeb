import type { ItemCategory, ItemType } from '@/lib/types/itemsFinance'

export const itemCategoryOptions: { value: ItemCategory; label: string }[] = [
  { value: 'objects', label: 'Objets' },
  { value: 'weapons', label: 'Armes' },
  { value: 'drugs', label: 'Drogues' },
  { value: 'equipment', label: 'Équipement' },
  { value: 'custom', label: 'Autres' },
]

export const itemTypeOptions: { value: ItemType; label: string }[] = [
  { value: 'input', label: 'Objets' },
  { value: 'equipment', label: 'Armes / Équipements' },
  { value: 'other', label: 'Autres' },
  { value: 'output', label: 'Pochons' },
  { value: 'production', label: 'Graines' },
  { value: 'consumable', label: 'Accessoires' },
]

const legacyToCanonicalCategory: Record<string, ItemCategory> = {
  object: 'objects',
  weapon: 'weapons',
  drug: 'drugs',
  equipment: 'equipment',
  objects: 'objects',
  weapons: 'weapons',
  drugs: 'drugs',
  custom: 'custom',
}

export function normalizeCatalogCategory(raw: string | null): ItemCategory | null {
  if (!raw) return null
  return legacyToCanonicalCategory[raw] ?? null
}
