import { describe, expect, it } from 'vitest'

import type { Expense } from './expense'
import { fuelRateForArea } from './expenses'
import type { Item } from './item'

function item(id: string, area_id: string | null): Item {
  return {
    id,
    owner: 'me',
    kind: 'expense',
    state: 'active',
    title: 'Fuel',
    due: '2026-09-01',
    done_at: null,
    area_id,
    waiting_since: null,
    version: 1,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    deleted_at: null,
  }
}

function fuel(item_id: string, over: Partial<Expense> = {}): Expense {
  return {
    item_id,
    owner: 'me',
    amount: 50,
    category: 'fuel',
    odo: null,
    full_tank: null,
    litres: null,
    covers_from: null,
    covers_to: null,
    business_pct: 100,
    ...over,
  }
}

describe('fuelRateForArea', () => {
  it('is unknown, not zero, with no fuel expenses at all in this Area', () => {
    expect(fuelRateForArea([], [], 'area-1').perKm).toBeNull()
  })

  it('is unknown for a shift with no Area', () => {
    const items = [item('e1', null)]
    const expenses = [fuel('e1', { odo: 1000, full_tank: true })]
    expect(fuelRateForArea(items, expenses, null).perKm).toBeNull()
  })

  it('is the automatic full-tank-to-full-tank rate once two full fills exist', () => {
    const items = [item('e1', 'area-1'), item('e2', 'area-1')]
    const expenses = [
      fuel('e1', { odo: 1000, full_tank: true, amount: 60 }),
      fuel('e2', { odo: 1100, full_tank: true, amount: 12 }),
    ]
    const rate = fuelRateForArea(items, expenses, 'area-1')
    expect(rate.perKm).toBeCloseTo(0.12)
  })

  it('never mixes another Area’s fill-ups into this one’s rate', () => {
    const items = [item('e1', 'area-1'), item('e2', 'area-2')]
    const expenses = [
      fuel('e1', { odo: 1000, full_tank: true }),
      fuel('e2', { odo: 2000, full_tank: true }),
    ]
    // Only one fill-up per Area here — one full tank alone closes no leg.
    expect(fuelRateForArea(items, expenses, 'area-1').perKm).toBeNull()
    expect(fuelRateForArea(items, expenses, 'area-1').reason).toBe('one-full-tank-only')
  })
})
