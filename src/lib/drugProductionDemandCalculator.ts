export type DemandMode = 'seed_only' | 'leaf_to_brick' | 'brick_to_pouch' | 'full_chain'

export type DemandInputs = {
  mode: DemandMode
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
  const pouchLotSize = 10

  const leavesBase = input.mode === 'full_chain' ? seedQty : input.mode === 'leaf_to_brick' ? leafQty : 0
  const netBricks = input.mode === 'brick_to_pouch' ? brickQty : Math.max(0, Math.floor(leavesBase * (1 - taxRate)))
  const pouches = Math.max(0, netBricks * pouchesPerBrick)

  const expectedOutput = input.mode === 'seed_only'
    ? seedQty
    : input.mode === 'leaf_to_brick'
      ? netBricks
      : pouches

  const seedCostTotal = seedQty * seedPrice
  const totalSaleEstimate = pouches * pouchSalePrice
  const transformCostTotal = (netBricks * brickTransformCost) + ((pouches / pouchLotSize) * pouchTransformCost)
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
