export const COKE_SESSION_STORAGE_KEY = 'pykeweb:coke-session:v1'
export const METH_SESSION_STORAGE_KEY = 'pykeweb:meth-session:v1'

export type CokeSessionPlan = {
  createdAt: string
  seeds: number
  zones: number
  pots: number
  fertilizer: number
  water: number
  lamps: number
  theoreticalLeaves: number
}

export type MethSessionPlan = {
  createdAt: string
  machines: number
  zones: number
  tables: number
  batteries: number
  ammonia: number
  methylamine: number
  theoreticalPouches: number
}

export function buildCokeSessionPlan(seeds: number, zones: number): CokeSessionPlan {
  const safeSeeds = Math.max(0, Math.floor(Number(seeds) || 0))
  const safeZones = Math.max(0, Math.floor(Number(zones) || 0))
  return {
    createdAt: new Date().toISOString(),
    seeds: safeSeeds,
    zones: safeZones,
    pots: safeSeeds,
    fertilizer: safeSeeds,
    water: safeSeeds * 3,
    lamps: safeZones * 2,
    theoreticalLeaves: safeSeeds,
  }
}

export function buildMethSessionPlan(zones: number): MethSessionPlan {
  const safeZones = Math.max(0, Math.floor(Number(zones) || 0))
  const machines = safeZones * 3
  return {
    createdAt: new Date().toISOString(),
    machines,
    zones: safeZones,
    tables: machines,
    batteries: machines * 2,
    ammonia: machines * 6,
    methylamine: machines * 5,
    theoreticalPouches: machines,
  }
}
