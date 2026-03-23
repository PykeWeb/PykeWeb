import type { CatalogItem } from '@/lib/types/itemsFinance'
import { normalizeCatalogCategory } from '@/lib/catalogConfig'

export type ItemStockCategoryStats = {
  all: number
  objects: number
  weapons: number
  equipment: number
  drugs: number
  other: number
}

export function computeItemStockCategoryStats(items: CatalogItem[]): ItemStockCategoryStats {
  const sumStock = (predicate: (category: CatalogItem['category']) => boolean) => (
    items.reduce((total, item) => {
      const category = normalizeCatalogCategory(String(item.category || '')) || 'objects'
      if (!predicate(category)) return total
      return total + Math.max(0, Number(item.stock) || 0)
    }, 0)
  )

  return {
    objects: sumStock((category) => category === 'objects'),
    weapons: sumStock((category) => category === 'weapons'),
    equipment: sumStock((category) => category === 'equipment'),
    drugs: sumStock((category) => category === 'drugs'),
    other: sumStock((category) => category === 'custom'),
    all: sumStock(() => true),
  }
}
