import type { ItemCategory, ItemType } from '@/lib/types/itemsFinance'

export const itemCategoryOptions: { value: ItemCategory; label: string }[] = [
  { value: 'objects', label: 'Objets' },
  { value: 'weapons', label: 'Armes' },
  { value: 'equipment', label: 'Équipement' },
  { value: 'drugs', label: 'Drogues' },
  { value: 'custom', label: 'Autres' },
]

export const categoryTypeOptions: Record<ItemCategory, { value: ItemType; label: string }[]> = {
  objects: [
    { value: 'other', label: 'Divers' },
  ],
  weapons: [
    { value: 'weapon', label: 'Arme' },
    { value: 'ammo', label: 'Munition' },
    { value: 'weapon_accessory', label: "Accessoire d’arme" },
  ],
  equipment: [
    { value: 'accessory', label: 'Accessoires' },
    { value: 'other', label: 'Divers' },
  ],
  drugs: [
    { value: 'seed', label: 'Graine' },
    { value: 'pouch', label: 'Pochon' },
    { value: 'accessory', label: 'Accessoires' },
    { value: 'other', label: 'Divers' },
  ],
  custom: [{ value: 'other', label: 'Autre' }],
}

export const itemTypeOptions = Object.values(categoryTypeOptions).flatMap((options) => options)

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

const legacyTypeMap: Record<string, ItemType> = {
  input: 'other',
  output: 'pouch',
  production: 'seed',
  consumable: 'consumable',
  weapon: 'weapon',
  equipment: 'equipment',
  product: 'other',
  recipe: 'other',
  drug_material: 'other',
  outfit: 'other',
  protection: 'other',
  accessory: 'accessory',
  other: 'other',
}

export function normalizeCatalogCategory(raw: string | null): ItemCategory | null {
  if (!raw) return null
  return legacyToCanonicalCategory[raw.toLowerCase()] ?? null
}

export function normalizeItemType(raw: string | null, category: ItemCategory): ItemType {
  const value = (raw ?? '').toLowerCase().trim()
  const normalized = legacyTypeMap[value] ?? (value as ItemType)
  const allowed = new Set(categoryTypeOptions[category].map((opt) => opt.value))
  if (allowed.has(normalized)) return normalized
  if (allowed.has('other')) return 'other'
  return categoryTypeOptions[category][0].value
}

export function getCategoryLabel(category: ItemCategory): string {
  return itemCategoryOptions.find((option) => option.value === category)?.label ?? 'Autres'
}

export function getTypeLabel(type: ItemType, category?: ItemCategory): string {
  if (category) {
    const scoped = categoryTypeOptions[category].find((option) => option.value === type)
    if (scoped) return scoped.label
  }
  return itemTypeOptions.find((option) => option.value === type)?.label ?? 'Autre'
}
