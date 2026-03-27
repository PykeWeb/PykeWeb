import type { CatalogItem, ItemCategory, ItemType } from '@/lib/types/itemsFinance'

export const itemCategoryOptions: { value: ItemCategory; label: string }[] = [
  { value: 'objects', label: 'Objets' },
  { value: 'weapons', label: 'Armes' },
  { value: 'equipment', label: 'Équipement' },
  { value: 'drugs', label: 'Drogues' },
  { value: 'custom', label: 'Autres\u200b' },
]

export const categoryTypeOptions: Record<ItemCategory, { value: ItemType; label: string }[]> = {
  objects: [
    { value: 'objects', label: 'Objets' },
  ],
  weapons: [
    { value: 'weapon', label: 'Armes' },
    { value: 'ammo', label: 'Munitions' },
    { value: 'weapon_accessory', label: 'Modding' },
  ],
  equipment: [
    { value: 'equipment', label: 'Équipements' },
  ],
  drugs: [
    { value: 'seed', label: 'Graines' },
    { value: 'pouch', label: 'Pochons' },
    { value: 'drug_material', label: 'Matériels' },
    { value: 'product', label: 'Productions' },
  ],
  custom: [{ value: 'other', label: 'Autres\u200b' }],
}

export type UnifiedTypeFilterValue =
  | 'all'
  | 'objects'
  | 'equipment'
  | 'weapon'
  | 'ammo'
  | 'weapon_accessory'
  | 'seed'
  | 'pouch'
  | 'drug_material'
  | 'product'
  | 'other'

export function getTypeFilterOptions(category: 'all' | ItemCategory): { value: UnifiedTypeFilterValue; label: string }[] {
  if (category === 'all') {
    return [
      { value: 'all', label: 'Tous' },
      { value: 'objects', label: 'Objets' },
      { value: 'equipment', label: 'Équipements' },
      { value: 'weapon', label: 'Armes' },
      { value: 'ammo', label: 'Munitions' },
      { value: 'weapon_accessory', label: 'Modding' },
      { value: 'seed', label: 'Graines' },
      { value: 'pouch', label: 'Pochons' },
      { value: 'drug_material', label: 'Matériels' },
      { value: 'product', label: 'Productions' },
      { value: 'other', label: 'Autres\u200b' },
    ]
  }

  if (category === 'objects') return [{ value: 'all', label: 'Tous' }, { value: 'objects', label: 'Objets' }]
  if (category === 'equipment') return [{ value: 'all', label: 'Tous' }, { value: 'equipment', label: 'Équipements' }]
  if (category === 'weapons') return [{ value: 'all', label: 'Tous' }, { value: 'weapon', label: 'Armes' }, { value: 'ammo', label: 'Munitions' }, { value: 'weapon_accessory', label: 'Modding' }]
  if (category === 'drugs') return [{ value: 'all', label: 'Tous' }, { value: 'seed', label: 'Graines' }, { value: 'pouch', label: 'Pochons' }, { value: 'drug_material', label: 'Matériels' }, { value: 'product', label: 'Productions' }]
  return [{ value: 'all', label: 'Tous' }, { value: 'other', label: 'Autres\u200b' }]
}

export function matchesTypeFilter(item: CatalogItem, selectedCategory: 'all' | ItemCategory, selectedType: UnifiedTypeFilterValue): boolean {
  if (selectedType === 'all') return true
  if (selectedType === 'objects') return item.category === 'objects'
  if (selectedType === 'equipment') return item.category === 'equipment'
  if (selectedType === 'other' && selectedCategory === 'all') return item.category === 'custom'
  return normalizeItemType(item.item_type, item.category) === selectedType
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
  objet: 'objects',
  objets: 'objects',
  arme: 'weapons',
  armes: 'weapons',
  equipement: 'equipment',
  drogue: 'drugs',
  drogues: 'drugs',
  autre: 'custom',
  autres: 'custom',
  other: 'custom',
  misc: 'custom',
}

function normalizeCategoryKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const legacyTypeMap: Record<string, ItemType> = {
  objects: 'objects',
  drug: 'product',
  input: 'other',
  output: 'product',
  production: 'product',
  planting: 'drug_material',
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
  return legacyToCanonicalCategory[normalizeCategoryKey(raw)] ?? null
}

export function normalizeItemType(raw: string | null, category: ItemCategory): ItemType {
  const value = (raw ?? '').toLowerCase().trim()
  const normalized = legacyTypeMap[value] ?? (value as ItemType)
  const categoryMapped =
    category === 'objects' && normalized === 'other'
      ? 'objects'
      : category === 'drugs' && normalized === 'accessory'
      ? 'drug_material'
      : category === 'drugs' && normalized === 'equipment'
        ? 'product'
        : category === 'equipment' && normalized === 'accessory'
          ? 'equipment'
          : normalized
  const allowed = new Set(categoryTypeOptions[category].map((opt) => opt.value))
  if (allowed.has(categoryMapped)) return categoryMapped
  if (allowed.has('other')) return 'other'
  return categoryTypeOptions[category][0].value
}

export function getCategoryLabel(category: ItemCategory): string {
  return itemCategoryOptions.find((option) => option.value === category)?.label ?? 'Autres\u200b'
}

export function getTypeLabel(type: ItemType, category?: ItemCategory | string | null): string {
  const rawCategory = typeof category === 'string' ? category : (category || null)
  const normalizedCategory = normalizeCatalogCategory(rawCategory)
  const normalizedCategoryKey = rawCategory ? normalizeCategoryKey(rawCategory) : null

  if (normalizedCategory) {
    const normalizedType = normalizeItemType(type, normalizedCategory)
    const scoped = categoryTypeOptions[normalizedCategory].find((option) => option.value === normalizedType)
    if (scoped) return scoped.label
  }

  if (normalizedCategory == null && normalizedCategoryKey?.includes('drog')) {
    const normalizedDrugType = normalizeItemType(type, 'drugs')
    const scopedDrug = categoryTypeOptions.drugs.find((option) => option.value === normalizedDrugType)
    if (scopedDrug) return scopedDrug.label
  }
  const globalLabels: Record<ItemType, string> = {
    objects: 'Objets',
    accessory: 'Matériels',
    tool: 'Outils',
    consumable: 'Consommable',
    material: 'Matériau',
    weapon: 'Armes',
    ammo: 'Munitions',
    weapon_accessory: 'Modding',
    equipment: 'Équipements',
    outfit: 'Tenue',
    protection: 'Protection',
    seed: 'Graines',
    pouch: 'Pochons',
    product: 'Productions',
    recipe: 'Matériels',
    drug_material: 'Matériels',
    other: 'Autres\u200b',
    input: 'Autres\u200b',
    output: 'Productions',
    production: 'Productions',
  }
  return globalLabels[type] ?? 'Autres\u200b'
}
