export type DemandMode =
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
  const methPouchesPerTable = 32

  if (input.isMeth) {
    const expectedOutput = seedQty * methPouchesPerTable
    const seedCostTotal = seedQty * seedPrice
    const totalSaleEstimate = expectedOutput * pouchSalePrice
    const transformCostTotal = 0
    const totalCost = seedCostTotal + transformCostTotal
    const estimatedProfit = totalSaleEstimate - totalCost
    return {
      taxRate,
      pouchesPerBrick,
      seedQty,
      leafQty,
      brickQty,
      netBricks: 0,
      pouches: expectedOutput,
      expectedOutput,
      seedCostTotal,
      totalSaleEstimate,
      transformCostTotal,
      totalCost,
      estimatedProfit,
    }
  }

  const leavesBase =
    input.mode === 'full_chain' || input.mode === 'two_steps_seed_to_brick'
      ? seedQty
      : input.mode === 'leaf_to_brick' || input.mode === 'two_steps_transforms'
        ? leafQty
        : 0
  const netBricks = input.mode === 'brick_to_pouch' ? brickQty : Math.max(0, Math.floor(leavesBase * (1 - taxRate)))
  const pouches = Math.max(0, netBricks * pouchesPerBrick)

  const expectedOutput = input.mode === 'seed_only'
    ? seedQty
    : input.mode === 'leaf_to_brick' || input.mode === 'two_steps_seed_to_brick'
      ? netBricks
      : pouches

  const seedCostTotal = (input.mode === 'seed_only' || input.mode === 'full_chain' || input.mode === 'two_steps_seed_to_brick')
    ? seedQty * seedPrice
    : 0
  const totalSaleEstimate = pouches * pouchSalePrice
  const transformCostTotal = input.mode === 'seed_only'
    ? 0
    : input.mode === 'leaf_to_brick' || input.mode === 'two_steps_seed_to_brick'
      ? (leavesBase * brickTransformCost)
      : input.mode === 'brick_to_pouch'
        ? (brickQty * pouchTransformCost)
        : (leavesBase * (brickTransformCost + pouchTransformCost))
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
