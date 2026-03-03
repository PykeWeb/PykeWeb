import { supabase } from '@/lib/supabase/client'
import { currentGroupId } from '@/lib/tenantScope'

export type CatalogCategory = 'objects' | 'weapons' | 'equipment' | 'drugs'

export type GlobalCatalogItem = {
  id: string
  source_id: string
  category: CatalogCategory
  item_type: string | null
  weapon_id: string | null
  name: string
  price: number
  stock: number
  image_url: string | null
}

export async function listGlobalCatalogItems(): Promise<GlobalCatalogItem[]> {
  const { data, error } = await supabase
    .from('catalog_global_items')
    .select('id,source_id,category,item_type,weapon_id,name,price,stock,image_url')
    .eq('group_id', currentGroupId())
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []).map((row: any) => ({
    id: row.id,
    source_id: row.source_id,
    category: row.category,
    item_type: row.item_type,
    weapon_id: row.weapon_id,
    name: row.name,
    price: Number(row.price ?? 0),
    stock: Number(row.stock ?? 0),
    image_url: row.image_url ?? null,
  }))
}

export async function createCatalogItem(args: {
  category: CatalogCategory
  name: string
  price: number
  item_type?: string | null
  weapon_id?: string | null
}) {
  const group_id = currentGroupId()

  if (args.category === 'objects') {
    const { error } = await supabase.from('objects').insert({ group_id, name: args.name, price: args.price, stock: 0 })
    if (error) throw error
    return
  }

  if (args.category === 'weapons') {
    const { error } = await supabase.from('weapons').insert({ group_id, name: args.name, weapon_id: args.weapon_id || null, stock: 0 })
    if (error) throw error
    return
  }

  if (args.category === 'equipment') {
    const { error } = await supabase.from('equipment').insert({ group_id, name: args.name, price: args.price, stock: 0 })
    if (error) throw error
    return
  }

  const { error } = await supabase.from('drug_items').insert({
    group_id,
    name: args.name,
    type: args.item_type || 'drug',
    price: args.price,
    stock: 0,
  })
  if (error) throw error
}
