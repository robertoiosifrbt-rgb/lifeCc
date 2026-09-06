// sliceFor/liveSummaryOf's own tests live in sliceFor.test.ts — split out at
// the 300-line limit.

import { describe, expect, it } from 'vitest'

import type { Entity } from '../repository/entity'
import type { Expense } from '../repository/expense'
import type { Item } from '../repository/item'
import type { Link } from '../repository/link'
import type { RunningCosts } from '../repository/settings'
import type { Shift } from '../repository/shift'
import type { VehicleLink } from '../repository/vehicle'
import { draftFrom } from './draft'
import { areaIdOf, costBasisOf } from './liveSummary'

const NO_VEHICLE: VehicleLink = { kind: 'none' }

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'i1',
    owner: 'me',
    kind: 'shift',
    state: 'active',
    title: 'Shift',
    due: '2026-09-05',
    done_at: null,
    area_id: 'area-1',
    waiting_since: null,
    version: 1,
    created_at: '2026-09-05T00:00:00Z',
    updated_at: '2026-09-05T00:00:00Z',
    deleted_at: null,
    ...over,
  }
}

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

function costs(area_id: string, fuel_per_km: number, vehicle_per_km: number): RunningCosts {
  return {
    area_id,
    owner: 'me',
    fuel_per_km,
    vehicle_per_km,
    version: 1,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    deleted_at: null,
  }
}

describe('areaIdOf', () => {
  it('follows the Draft while it is a Draft, blank meaning none chosen', () => {
    const anchor = item({ area_id: 'area-1' })
    expect(areaIdOf(anchor, { ...draftFrom(anchor, shift()), area_id: 'area-2' }, false)).toBe('area-2')
    expect(areaIdOf(anchor, { ...draftFrom(anchor, shift()), area_id: '' }, false)).toBeNull()
  })

  it('is always the shift’s own settled Area once Completed, regardless of the draft', () => {
    const anchor = item({ area_id: 'area-1', state: 'done' })
    const draft = { ...draftFrom(anchor, shift()), area_id: 'area-2' }
    expect(areaIdOf(anchor, draft, true)).toBe('area-1')
  })
})

describe('costBasisOf', () => {
  it('a Draft uses the linked Vehicle’s current automatic fuel rate and the Area’s configured vehicle rate, never the shift’s own stale pinned one', () => {
    const day = shift({ rate_fuel_per_km: 0.9, rate_vehicle_per_km: 0.9 })
    const entities = [vehicle('v1')]
    const links = [about('l1', 'f1', 'v1'), about('l2', 'f2', 'v1')]
    // Two full tanks, 100 km apart, £10 spent between them: £0.10/km,
    // worked out fresh from the fill-ups — never the stale 0.9 the shift's
    // own row still carries.
    const { costBasis } = costBasisOf({
      shift: day,
      completed: false,
      areaId: 'area-B',
      vehicle: { kind: 'one', vehicleItemId: 'v1', linkId: 'l1' },
      expenses: [fuelExpense('f1', 1000, 0), fuelExpense('f2', 1100, 10)],
      links,
      entities,
      costs: [costs('area-B', 0.9, 0.05)],
    })
    expect(costBasis).toEqual({ fuel_per_km: 0.1, vehicle_per_km: 0.05 })
  })

  it('a Completed Workday uses exactly its own pinned rate, never the Area’s or Vehicle’s current one', () => {
    const day = shift({ rate_fuel_per_km: 0.9, rate_vehicle_per_km: 0.9 })
    const { costBasis } = costBasisOf({
      shift: day,
      completed: true,
      areaId: 'area-B',
      vehicle: { kind: 'one', vehicleItemId: 'v1', linkId: 'l1' },
      expenses: [],
      links: [],
      entities: [],
      costs: [costs('area-B', 0.1, 0.05)],
    })
    expect(costBasis).toEqual({ fuel_per_km: 0.9, vehicle_per_km: 0.9 })
  })

  it('no Vehicle linked, or an ambiguous one: fuel stays unknown, never guessed from the Area', () => {
    const day = shift()
    const entities = [vehicle('v1'), vehicle('v2')]
    const links = [about('l1', 'f1', 'v1'), about('l2', 'f1', 'v2')]
    const forNone = costBasisOf({
      shift: day,
      completed: false,
      areaId: 'area-B',
      vehicle: NO_VEHICLE,
      expenses: [fuelExpense('f1', 1000, 40)],
      links: [],
      entities: [],
      costs: [],
    })
    const forAmbiguous = costBasisOf({
      shift: day,
      completed: false,
      areaId: 'area-B',
      vehicle: { kind: 'ambiguous' },
      expenses: [fuelExpense('f1', 1000, 40)],
      links,
      entities,
      costs: [],
    })
    expect(forNone.costBasis.fuel_per_km).toBeNull()
    expect(forAmbiguous.costBasis.fuel_per_km).toBeNull()
  })
})
