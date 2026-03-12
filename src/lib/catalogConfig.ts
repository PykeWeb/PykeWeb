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
    { value: 'other', label: 'Objets' },
  ],
  weapons: [
    { value: 'weapon', label: 'Armes' },
    { value: 'ammo', label: 'Munitions' },
    { value: 'weapon_accessory', label: "Accessoire d’arme" },
  ],
  equipment: [
    { value: 'equipment', label: 'Équipement' },
  ],
  drugs: [
    { value: 'seed', label: 'Graine' },
    { value: 'pouch', label: 'Pochon' },
    { value: 'drug_material', label: 'Matériels' },
    { value: 'product', label: 'Production' },
  ],
  custom: [{ value: 'other', label: 'Autres' }],
}

export const allCategoryTypeOptions: { value: ItemType; label: string }[] = [
  { value: 'other', label: 'Autres' },
  { value: 'equipment', label: 'Équipement' },
  { value: 'weapon', label: 'Armes' },
  { value: 'ammo', label: 'Munitions' },
  { value: 'weapon_accessory', label: "Accessoire d’arme" },
  { value: 'seed', label: 'Graine' },
  { value: 'pouch', label: 'Pochon' },
  { value: 'drug_material', label: 'Matériels' },
  { value: 'product', label: 'Production' },
]

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
  output: 'product',
  production: 'product',
  consumable: 'consumable',
  weapon: 'weapon',
  equipment: 'equipment',
  product: 'product',
  recipe: 'drug_material',
  drug_material: 'drug_material',
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
  const categoryMapped =
    category === 'drugs' && normalized === 'accessory'
      ? 'drug_material'
      : category === 'equipment' && normalized === 'accessory'
        ? 'equipment'
        : normalized
  const allowed = new Set(categoryTypeOptions[category].map((opt) => opt.value))
  if (allowed.has(categoryMapped)) return categoryMapped
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
    const normalized = normalizeItemType(type, category)
    const normalizedScoped = categoryTypeOptions[category].find((option) => option.value === normalized)
    if (normalizedScoped) return normalizedScoped.label
  }
  const globalLabels: Record<ItemType, string> = {
    accessory: 'Matériels',
    tool: 'Outils',
    consumable: 'Consommable',
    material: 'Matériau',
    weapon: 'Armes',
    ammo: 'Munitions',
    weapon_accessory: "Accessoire d’arme",
    equipment: 'Équipement',
    outfit: 'Tenue',
    protection: 'Protection',
    seed: 'Graine',
    pouch: 'Pochon',
    product: 'Production',
    recipe: 'Matériels',
    drug_material: 'Matériels',
    other: 'Autres',
    input: 'Autres',
    output: 'Production',
    production: 'Production',
  }
  return globalLabels[type] ?? 'Autres'
}
