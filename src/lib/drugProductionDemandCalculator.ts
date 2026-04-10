export type DemandMode =
  | 'coke_leaf_to_brick'
  | 'coke_brick_to_pouch'
  | 'coke_leaf_to_pouch'
  | 'meth_table_transform'
  | 'seed_only'
  | 'leaf_to_brick'
  | 'brick_to_pouch'
  | 'two_steps_seed_to_brick'
  | 'two_steps_transforms'
  | 'full_chain'

export type DemandInputs = {
  mode: DemandMode
  isMeth?: boolean
  quantitySeeds: number
  quantityLeaves: number
  quantityBricks: number
  seedPrice: number
  pouchSalePrice: number
  brickTransformCost: number
  pouchTransformCost: number
}

export function computeDemandMetrics(input: DemandInputs) {
  const seedQty = Math.max(0, Math.floor(input.quantitySeeds || 0))
  const leafQty = Math.max(0, Math.floor(input.quantityLeaves || 0))
  const brickQty = Math.max(0, Math.floor(input.quantityBricks || 0))
  const seedPrice = Math.max(0, Number(input.seedPrice || 0))
  const pouchSalePrice = Math.max(0, Number(input.pouchSalePrice || 0))
  const brickTransformCost = Math.max(0, Number(input.brickTransformCost || 0))
  const pouchTransformCost = Math.max(0, Number(input.pouchTransformCost || 0))

  const taxRate = 0.05
  const pouchesPerBrick = 10
  const normalizedMode = input.isMeth
    ? 'meth_table_transform'
    : input.mode === 'leaf_to_brick'
      ? 'coke_leaf_to_brick'
      : input.mode === 'brick_to_pouch'
        ? 'coke_brick_to_pouch'
        : input.mode === 'two_steps_transforms' || input.mode === 'full_chain' || input.mode === 'two_steps_seed_to_brick'
          ? 'coke_leaf_to_pouch'
          : 'coke_leaf_to_pouch'

  if (normalizedMode === 'meth_table_transform') {
    const methBrutQty = leafQty
    const expectedOutput = brickQty > 0 ? brickQty : methBrutQty * 2
    const seedCostTotal = seedQty * seedPrice
    const totalSaleEstimate = expectedOutput * pouchSalePrice
    const transformCostTotal = pouchTransformCost
    const totalCost = seedCostTotal + transformCostTotal
    const estimatedProfit = totalSaleEstimate - totalCost
    return {
      taxRate,
      pouchesPerBrick,
      seedQty,
      leafQty,
      brickQty,
      netBricks: methBrutQty,
      pouches: expectedOutput,
      expectedOutput,
      seedCostTotal,
      totalSaleEstimate,
      transformCostTotal,
      totalCost,
      estimatedProfit,
    }
  }

  const leavesBase = normalizedMode === 'coke_brick_to_pouch' ? 0 : leafQty
  const netBricks = normalizedMode === 'coke_brick_to_pouch' ? brickQty : Math.max(0, Math.floor(leavesBase * (1 - taxRate)))
  const pouches = normalizedMode === 'coke_leaf_to_brick' ? netBricks * pouchesPerBrick : Math.max(0, netBricks * pouchesPerBrick)
  const expectedOutput = normalizedMode === 'coke_leaf_to_brick' ? netBricks : pouches
  const seedCostTotal = seedQty * seedPrice
  const totalSaleEstimate = pouches * pouchSalePrice
  const transformCostTotal = normalizedMode === 'coke_leaf_to_brick'
    ? leavesBase * brickTransformCost
    : normalizedMode === 'coke_brick_to_pouch'
      ? brickQty * pouchTransformCost
      : leavesBase * (brickTransformCost + pouchTransformCost)
  const totalCost = seedCostTotal + transformCostTotal
  const estimatedProfit = totalSaleEstimate - totalCost

  return {
    taxRate,
    pouchesPerBrick,
    seedQty,
    leafQty,
    brickQty,
    netBricks,
    pouches,
    expectedOutput,
    seedCostTotal,
    totalSaleEstimate,
    transformCostTotal,
    totalCost,
    estimatedProfit,
  }
}
