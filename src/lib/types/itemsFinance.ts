export type ItemCategory = 'objects' | 'weapons' | 'drugs' | 'equipment' | 'custom'

export type ItemType =
  | 'accessory'
  | 'tool'
  | 'consumable'
  | 'material'
  | 'weapon'
  | 'ammo'
  | 'weapon_accessory'
  | 'equipment'
  | 'outfit'
  | 'protection'
  | 'seed'
  | 'pouch'
  | 'product'
  | 'recipe'
  | 'drug_material'
  | 'other'
  | 'input'
  | 'output'
  | 'production' // legacy

export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary' | null

export type CatalogItem = {
  id: string
  group_id: string
  internal_id: string
  name: string
  category: ItemCategory
  item_type: ItemType
  description: string | null
  image_url: string | null
  buy_price: number
  sell_price: number
  internal_value: number
  show_in_finance: boolean
  is_active: boolean
  stock: number
  low_stock_threshold: number
  stackable: boolean
  max_stack: number
  weight: number | null
  fivem_item_id: string | null
  hash: string | null
  rarity: ItemRarity
  created_at: string
  updated_at: string
}

export type FinancePaymentMode = 'cash' | 'bank' | 'item' | 'other' | 'stock_out'

export type FinanceTransaction = {
  id: string
  group_id: string
  item_id: string
  mode: 'buy' | 'sell'
  quantity: number
  unit_price: number
  total: number
  counterparty: string | null
  notes: string | null
  payment_mode: FinancePaymentMode
  created_at: string
}
