import type { ItemCategory, ItemRarity, ItemType } from '@/lib/types/itemsFinance'

export const itemCategoryOptions: { value: ItemCategory; label: string }[] = [
  { value: 'objects', label: 'Objets' },
  { value: 'weapons', label: 'Armes' },
  { value: 'drugs', label: 'Drogues' },
  { value: 'equipment', label: 'Équipement' },
  { value: 'custom', label: 'Custom' },
]

export const itemTypeOptions: { value: ItemType; label: string }[] = [
  { value: 'input', label: 'Entrée' },
  { value: 'output', label: 'Sortie' },
  { value: 'consumable', label: 'Consommable' },
  { value: 'equipment', label: 'Équipement' },
  { value: 'production', label: 'Production' },
  { value: 'other', label: 'Autre' },
]

export const itemRarityOptions: { value: string; label: string }[] = [
  { value: '', label: 'Aucune' },
  { value: 'common', label: 'Commun' },
  { value: 'rare', label: 'Rare' },
  { value: 'epic', label: 'Épique' },
  { value: 'legendary', label: 'Légendaire' },
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

export function toLegacyCatalogCategory(category: ItemCategory): 'object' | 'weapon' | 'drug' | 'equipment' | 'custom' {
  if (category === 'objects') return 'object'
  if (category === 'weapons') return 'weapon'
  if (category === 'drugs') return 'drug'
  if (category === 'equipment') return 'equipment'
  return 'custom'
}
