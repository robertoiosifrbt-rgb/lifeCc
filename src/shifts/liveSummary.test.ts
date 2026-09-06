// sliceFor/liveSummaryOf's own tests live in sliceFor.test.ts — split out at
// the 300-line limit.

import { describe, expect, it } from 'vitest'

import type { Entity } from '../repository/entity'
import type { Expense } from '../repository/expense'
import type { Link } from '../repository/link'
import type { Shift } from '../repository/shift'
import type { VehicleCostRate } from '../repository/vehicle-cost'
import type { VehicleLink } from '../repository/vehicle'
import { costBasisOf } from './liveSummary'

const NO_VEHICLE: VehicleLink = { kind: 'none' }
const TODAY = '2026-09-05'

function shift(over: Partial<Shift> = {}): Shift {
  return {
    item_id: 'i1',
    owner: 'me',
    odo_start: null,
    odo_end: null,
    tips: null,
    personal_km: null,
    bonuses: null,
    parking: null,
    tolls: null,
    other_cost: null,
    rate_fuel_per_km: null,
    rate_vehicle_per_km: null,
    sessions: [],
    earnings: [],
    ...over,
  }
}

function vehicle(itemId: string): Entity {
  return {
    item_id: itemId,
    owner: 'me',
    entity_kind: 'vehicle',
    registration: null,
    make: null,
    model: null,
    fuel: null,
    odo: null,
    mot_due: null,
    road_tax_due: null,
    insurance_due: null,
    service_due: null,
    oil_changed_at: null,
    oil_due_at: null,
  }
}

function about(id: string, from_id: string, to_id: string): Link {
  return { id, owner: 'me', from_id, to_id, kind: 'about', created_at: '2026-09-01T00:00:00Z' }
}

function fuelExpense(item_id: string, odo: number, pounds: number): Expense {
  return {
    item_id,
    owner: 'me',
    amount: pounds,
    category: 'fuel',
    odo,
    full_tank: true,
    litres: null,
    covers_from: null,
    covers_to: null,
    business_pct: 100,
  }
}

function costRate(vehicle_item_id: string, effective_from: string, vehicle_per_km: number): VehicleCostRate {
  return {
    vehicle_item_id,
    owner: 'me',
    effective_from,
    vehicle_per_km,
    version: 1,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    deleted_at: null,
  }
}

describe('costBasisOf', () => {
  it('a Draft uses the linked Vehicle’s current automatic fuel rate and its own configured cost rate, never the shift’s own stale pinned one', () => {
    const day = shift({ rate_fuel_per_km: 0.9, rate_vehicle_per_km: 0.9 })
    const entities = [vehicle('v1')]
    const links = [about('l1', 'f1', 'v1'), about('l2', 'f2', 'v1')]
    // Two full tanks, 100 km apart, £10 spent between them: £0.10/km,
    // worked out fresh from the fill-ups — never the stale 0.9 the shift's
    // own row still carries.
    const { costBasis } = costBasisOf({
      shift: day,
      completed: false,
      vehicle: { kind: 'one', vehicleItemId: 'v1', linkId: 'l1' },
      expenses: [fuelExpense('f1', 1000, 0), fuelExpense('f2', 1100, 10)],
      links,
      entities,
      vehicleCostRates: [costRate('v1', '2026-01-01', 0.05)],
      today: TODAY,
    })
    expect(costBasis).toEqual({ fuel_per_km: 0.1, vehicle_per_km: 0.05 })
  })

  it('a Completed Workday uses exactly its own pinned rate, never the Vehicle’s current one', () => {
    const day = shift({ rate_fuel_per_km: 0.9, rate_vehicle_per_km: 0.9 })
    const { costBasis } = costBasisOf({
      shift: day,
      completed: true,
      vehicle: { kind: 'one', vehicleItemId: 'v1', linkId: 'l1' },
      expenses: [],
      links: [],
      entities: [],
      vehicleCostRates: [costRate('v1', '2026-01-01', 0.05)],
      today: TODAY,
    })
    expect(costBasis).toEqual({ fuel_per_km: 0.9, vehicle_per_km: 0.9 })
  })

  it('no Vehicle linked, or an ambiguous one: fuel and vehicle cost both stay unknown, never guessed', () => {
    const day = shift()
    const entities = [vehicle('v1'), vehicle('v2')]
    const links = [about('l1', 'f1', 'v1'), about('l2', 'f1', 'v2')]
    const forNone = costBasisOf({
      shift: day,
      completed: false,
      vehicle: NO_VEHICLE,
      expenses: [fuelExpense('f1', 1000, 40)],
      links: [],
      entities: [],
      vehicleCostRates: [costRate('v1', '2026-01-01', 0.05)],
      today: TODAY,
    })
    const forAmbiguous = costBasisOf({
      shift: day,
      completed: false,
      vehicle: { kind: 'ambiguous' },
      expenses: [fuelExpense('f1', 1000, 40)],
      links,
      entities,
      vehicleCostRates: [costRate('v1', '2026-01-01', 0.05)],
      today: TODAY,
    })
    expect(forNone.costBasis).toEqual({ fuel_per_km: null, vehicle_per_km: null })
    expect(forAmbiguous.costBasis).toEqual({ fuel_per_km: null, vehicle_per_km: null })
  })

  it('the Vehicle cost is independent of the fuel rate — configuring one never needs the other known', () => {
    const day = shift()
    const { costBasis } = costBasisOf({
      shift: day,
      completed: false,
      vehicle: { kind: 'one', vehicleItemId: 'v1', linkId: 'l1' },
      expenses: [],
      links: [],
      entities: [],
      vehicleCostRates: [costRate('v1', '2026-01-01', 0.05)],
      today: TODAY,
    })
    expect(costBasis.fuel_per_km).toBeNull()
    expect(costBasis.vehicle_per_km).toBe(0.05)
  })

  it('picks the newest Vehicle cost rate not yet in the future, never a stale earlier one or one not yet effective', () => {
    const day = shift()
    const rates = [
      costRate('v1', '2020-01-01', 0.05),
      costRate('v1', '2026-09-01', 0.09),
      costRate('v1', '2026-09-10', 0.2),
    ]
    const { costBasis } = costBasisOf({
      shift: day,
      completed: false,
      vehicle: { kind: 'one', vehicleItemId: 'v1', linkId: 'l1' },
      expenses: [],
      links: [],
      entities: [],
      vehicleCostRates: rates,
      today: TODAY,
    })
    expect(costBasis.vehicle_per_km).toBe(0.09)
  })
})
