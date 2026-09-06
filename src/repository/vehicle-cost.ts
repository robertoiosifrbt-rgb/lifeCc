// What a kilometre costs the Vehicle itself — wear, not fuel — per Vehicle,
// effective-dated.
//
// Not a single mutable row: a rate the owner sets today must not rewrite
// what an earlier date was assessed against. Each save is a new row keyed by
// the day it took effect; "current" is simply the newest one not yet in the
// future. A Completed Workday never reads this at all — its own
// `rate_vehicle_per_km` was already pinned the moment it was written.

import { asRecord, optionalDay, requiredText, stampsOf } from './row'
import type { Row } from './row'

export type VehicleCostRate = Omit<Row, 'id'> & {
  vehicle_item_id: string
  effective_from: string
  vehicle_per_km: number
}

function requiredNumber(raw: Record<string, unknown>, key: string): number {
  const value = raw[key]
  const parsed = typeof value === 'string' ? Number(value) : value
  if (typeof parsed !== 'number' || Number.isNaN(parsed)) {
    throw new Error(`Row without a real ${key}`)
  }
  return parsed
}

export function vehicleCostRateFromRow(row: unknown): VehicleCostRate {
  const raw = asRecord(row)
  const effective_from = optionalDay(raw, 'effective_from')
  if (effective_from === null) throw new Error('A vehicle cost rate without an effective date')
  const vehicle_per_km = requiredNumber(raw, 'vehicle_per_km')
  if (vehicle_per_km < 0) throw new Error(`Vehicle cost below nothing: ${vehicle_per_km}`)
  return {
    vehicle_item_id: requiredText(raw, 'vehicle_item_id'),
    owner: requiredText(raw, 'owner'),
    effective_from,
    vehicle_per_km,
    ...stampsOf(raw),
  }
}

/**
 * The rate actually in force for a Vehicle on a given day — the newest row
 * whose `effective_from` has already arrived, never a rate that has not
 * taken effect yet and never a soft-deleted (invalidated) one.
 */
export function currentVehicleCostRateOf(
  rates: readonly VehicleCostRate[],
  vehicleItemId: string | null,
  today: string,
): number | null {
  if (vehicleItemId === null) return null
  let best: VehicleCostRate | null = null
  for (const rate of rates) {
    if (rate.vehicle_item_id !== vehicleItemId) continue
    if (rate.deleted_at !== null) continue
    if (rate.effective_from > today) continue
    if (best === null || rate.effective_from > best.effective_from) best = rate
  }
  return best?.vehicle_per_km ?? null
}
