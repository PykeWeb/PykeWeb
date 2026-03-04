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
    { value: 'accessory', label: 'Accessoires' },
    { value: 'tool', label: 'Outils' },
    { value: 'consumable', label: 'Consommables' },
    { value: 'material', label: 'Matériaux' },
    { value: 'other', label: 'Autres' },
  ],
  weapons: [
    { value: 'weapon', label: 'Arme' },
    { value: 'ammo', label: 'Munition' },
    { value: 'weapon_accessory', label: "Accessoire d’arme" },
  ],
  equipment: [
    { value: 'equipment', label: 'Équipement' },
    { value: 'outfit', label: 'Tenue' },
    { value: 'protection', label: 'Protection' },
    { value: 'accessory', label: 'Accessoire' },
  ],
  drugs: [
    { value: 'seed', label: 'Graine' },
    { value: 'pouch', label: 'Pochon' },
    { value: 'product', label: 'Produit' },
    { value: 'recipe', label: 'Recette' },
    { value: 'drug_material', label: 'Matériel' },
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
  return allowed.has(normalized) ? normalized : categoryTypeOptions[category][0].value
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
