import { describe, expect, it } from 'vitest'

import type { Entity } from './entity'
import type { Expense } from './expense'
import type { Item } from './item'
import type { Link } from './link'
import {
  fuelRateForVehicle,
  vehicleLinkIdsOf,
  vehicleLinkOf,
  vehiclesOf,
} from './vehicle'

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

function item(id: string, title = 'Vehicle'): Item {
  return {
    id,
    owner: 'me',
    kind: 'entity',
    state: 'active',
    title,
    due: null,
    done_at: null,
    area_id: null,
    waiting_since: null,
    version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
  }
}

function about(id: string, from_id: string, to_id: string): Link {
  return { id, owner: 'me', from_id, to_id, kind: 'about', created_at: '2026-01-01T00:00:00Z' }
}

function fuel(over: Partial<Expense> = {}): Expense {
  return {
    item_id: 'e1',
    owner: 'me',
    amount: 50,
    category: 'fuel',
    odo: 1000,
    full_tank: true,
    litres: null,
    covers_from: null,
    covers_to: null,
    business_pct: 100,
    ...over,
  }
}

describe('vehicleLinkOf', () => {
  it('none when nothing is linked', () => {
    expect(vehicleLinkOf([], [], 'w1')).toEqual({ kind: 'none' })
  })

  it('one when exactly one Vehicle is linked', () => {
    const links = [about('l1', 'w1', 'v1')]
    const entities = [vehicle('v1')]
    expect(vehicleLinkOf(links, entities, 'w1')).toEqual({ kind: 'one', vehicleItemId: 'v1', linkId: 'l1' })
  })

  it('ambiguous when two different Vehicles are linked', () => {
    const links = [about('l1', 'w1', 'v1'), about('l2', 'w1', 'v2')]
    const entities = [vehicle('v1'), vehicle('v2')]
    expect(vehicleLinkOf(links, entities, 'w1')).toEqual({ kind: 'ambiguous' })
  })

  it('ignores links to a non-Vehicle entity, and links belonging to another item', () => {
    const links = [about('l1', 'w1', 'company-1'), about('l2', 'other-item', 'v1')]
    const entities = [vehicle('v1')]
    expect(vehicleLinkOf(links, entities, 'w1')).toEqual({ kind: 'none' })
  })
})

describe('vehicleLinkIdsOf', () => {
  it('lists every Vehicle link an item carries, for replacing them all', () => {
    const links = [about('l1', 'w1', 'v1'), about('l2', 'w1', 'v2')]
    const entities = [vehicle('v1'), vehicle('v2')]
    expect(vehicleLinkIdsOf(links, entities, 'w1')).toEqual(['l1', 'l2'])
  })
})

describe('vehiclesOf', () => {
  it('names every Vehicle Entity from its own anchor item', () => {
    const items = [item('v1', 'Corsa'), item('v2', 'Van')]
    const entities = [vehicle('v1'), vehicle('v2')]
    expect(vehiclesOf(items, entities)).toEqual([
      { itemId: 'v1', name: 'Corsa' },
      { itemId: 'v2', name: 'Van' },
    ])
  })

  it('leaves out a Vehicle whose anchor is soft-deleted', () => {
    const items = [{ ...item('v1', 'Corsa'), deleted_at: '2026-01-02T00:00:00Z' }]
    const entities = [vehicle('v1')]
    expect(vehiclesOf(items, entities)).toEqual([])
  })
})

describe('fuelRateForVehicle', () => {
  it('no Vehicle selected: unknown, not a guess at any chain', () => {
    const rate = fuelRateForVehicle([fuel()], [], [], null)
    expect(rate.perKm).toBeNull()
    expect(rate.reason).toBe('no-fills')
  })

  it('two Vehicles in the same Area do not mix fill-ups', () => {
    const entities = [vehicle('v1'), vehicle('v2')]
    const links = [about('l1', 'e1', 'v1'), about('l2', 'e2', 'v2')]
    const expenses = [
      fuel({ item_id: 'e1', odo: 1000, amount: 40 }),
      fuel({ item_id: 'e1a', odo: 1200, amount: 40 }),
      fuel({ item_id: 'e2', odo: 1000, amount: 90 }),
      fuel({ item_id: 'e2a', odo: 1200, amount: 90 }),
    ]
    // e1a/e2a need their own links too, matching the same vehicle as e1/e2.
    const fullLinks = [
      ...links,
      about('l3', 'e1a', 'v1'),
      about('l4', 'e2a', 'v2'),
    ]
    const forV1 = fuelRateForVehicle(expenses, fullLinks, entities, 'v1')
    const forV2 = fuelRateForVehicle(expenses, fullLinks, entities, 'v2')
    expect(forV1.perKm).toBe(0.2)
    expect(forV2.perKm).toBe(0.45)
  })

  it('the same Vehicle used across Areas keeps one fuel chain', () => {
    // Fill-ups carry no Area of their own here — only their own Vehicle link
    // — so a Vehicle moved between Areas is not what could split the chain.
    const entities = [vehicle('v1')]
    const links = [about('l1', 'e1', 'v1'), about('l2', 'e2', 'v1')]
    const expenses = [
      fuel({ item_id: 'e1', odo: 1000, amount: 40 }),
      fuel({ item_id: 'e2', odo: 1200, amount: 40 }),
    ]
    const rate = fuelRateForVehicle(expenses, links, entities, 'v1')
    expect(rate.perKm).toBe(0.2)
    expect(rate.legs).toBe(1)
  })

  it('an unlinked fuel expense is left out — unknown, never guessed into a chain', () => {
    const entities = [vehicle('v1')]
    const links = [about('l1', 'e1', 'v1')]
    const expenses = [
      fuel({ item_id: 'e1', odo: 1000, amount: 40 }),
      // e2 is a fuel purchase with no Vehicle link at all.
      fuel({ item_id: 'e2', odo: 1200, amount: 999 }),
    ]
    const rate = fuelRateForVehicle(expenses, links, entities, 'v1')
    expect(rate.perKm).toBeNull()
    expect(rate.reason).toBe('one-full-tank-only')
  })

  it('a fuel expense with an ambiguous Vehicle link is left out too', () => {
    const entities = [vehicle('v1'), vehicle('v2')]
    const links = [
      about('l1', 'e1', 'v1'),
      about('l2', 'e2', 'v1'),
      about('l3', 'e2', 'v2'),
    ]
    const expenses = [
      fuel({ item_id: 'e1', odo: 1000, amount: 40 }),
      fuel({ item_id: 'e2', odo: 1200, amount: 40 }),
    ]
    const rate = fuelRateForVehicle(expenses, links, entities, 'v1')
    expect(rate.perKm).toBeNull()
  })
})
