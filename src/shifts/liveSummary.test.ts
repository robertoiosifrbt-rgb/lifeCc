import { describe, expect, it } from 'vitest'

import type { Expense } from '../repository/expense'
import type { Item } from '../repository/item'
import type { RunningCosts } from '../repository/settings'
import type { Shift } from '../repository/shift'
import type { TaxYearRow } from '../repository/hmrc-year'
import { draftFrom } from './draft'
import { areaIdOf, costBasisOf, liveSummaryOf, sliceFor } from './liveSummary'

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

// A year already past its allowance and basic band by the time "before"
// carries any real profit, so a late Draft date and an early one tax the
// same £100 differently — the marginal rate, not a flat percentage.
const YEAR: TaxYearRow = {
  owner: 'me',
  tax_year: '2026/27',
  personal_allowance: 12570,
  taper_from: 100000,
  basic_band: 37700,
  higher_band_to: 125140,
  basic_pct: 20,
  higher_pct: 40,
  additional_pct: 45,
  dividend_allowance: 500,
  dividend_basic_pct: 8.75,
  dividend_higher_pct: 33.75,
  dividend_additional_pct: 39.35,
  poa_threshold: 1000,
  class2_small_profits: 6750,
  class2_year: 179.4,
  class4_from: 12570,
  class4_to: 50270,
  class4_main_pct: 6,
  class4_upper_pct: 2,
  employment: 0,
  employment_tax_paid: 0,
  dividends: 0,
  paid_on_account: 0,
  version: 1,
  created_at: '2026-04-06T00:00:00Z',
  updated_at: '2026-04-06T00:00:00Z',
  deleted_at: null,
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
  it('a Draft uses the Area’s current automatic fuel rate and configured vehicle rate, never the shift’s own stale pinned one', () => {
    const anchor = item({ area_id: 'area-B' })
    const day = shift({ rate_fuel_per_km: 0.9, rate_vehicle_per_km: 0.9 })
    // Two full tanks, 100 km apart, £10 spent between them: £0.10/km,
    // worked out fresh from the fill-ups — never the stale 0.9 the shift's
    // own row still carries.
    const fill1 = item({ id: 'f1', kind: 'expense', area_id: 'area-B' })
    const fill2 = item({ id: 'f2', kind: 'expense', area_id: 'area-B' })
    const { costBasis } = costBasisOf({
      shift: day,
      completed: false,
      areaId: 'area-B',
      items: [anchor, fill1, fill2],
      expenses: [fuelExpense('f1', 1000, 0), fuelExpense('f2', 1100, 10)],
      costs: [costs('area-B', 0.9, 0.05)],
    })
    expect(costBasis).toEqual({ fuel_per_km: 0.1, vehicle_per_km: 0.05 })
  })

  it('a Completed Workday uses exactly its own pinned rate, never the Area’s current one', () => {
    const anchor = item({ area_id: 'area-B', state: 'done' })
    const day = shift({ rate_fuel_per_km: 0.9, rate_vehicle_per_km: 0.9 })
    const { costBasis } = costBasisOf({
      shift: day,
      completed: true,
      areaId: 'area-B',
      items: [anchor],
      expenses: [],
      costs: [costs('area-B', 0.1, 0.05)],
    })
    expect(costBasis).toEqual({ fuel_per_km: 0.9, vehicle_per_km: 0.9 })
  })
})

describe('sliceFor', () => {
  it('follows the Draft’s own date, not the persisted one', () => {
    const anchor = item({ due: '2026-09-05' })
    const bigEarlyProfit = item({ id: 'other1', due: '2026-09-10' })
    const bigEarlyShift = shift({
      item_id: 'other1',
      earnings: [{ platform: 'uber_eats', amount: 100000 }],
    })
    const base = {
      item: anchor,
      items: [anchor, bigEarlyProfit],
      shifts: [bigEarlyShift],
      expenses: [],
      taxYears: [YEAR],
    }
    // Moved earlier than the big month: none of it counts as "before".
    expect(sliceFor({ ...base, due: '2026-09-05', today: '2026-09-05' }).beforePence).toBe(0)
    // Moved later than the big month: all of it counts as "before".
    expect(
      sliceFor({ ...base, due: '2026-09-15', today: '2026-09-15' }).beforePence,
    ).toBeGreaterThan(0)
  })

  it('falls back to today when the draft carries no date at all', () => {
    const anchor = item({ due: '2026-09-05' })
    const slice = sliceFor({
      item: anchor,
      due: '',
      items: [anchor],
      shifts: [],
      expenses: [],
      taxYears: [YEAR],
      today: '2026-09-05',
    })
    expect(slice.figures).not.toBeNull()
  })

  it('excludes this Workday itself from what the year made before it', () => {
    // Moved from an early persisted date to a later Draft date: if the
    // anchor were not excluded, its own (stale) row would fall inside the
    // "before" window under its old date and double-count its own profit.
    const anchor = item({ due: '2026-09-01' })
    const day = shift({ earnings: [{ platform: 'uber_eats', amount: 500 }] })
    const base = {
      item: anchor,
      due: '2026-09-20',
      shifts: [day],
      expenses: [],
      taxYears: [YEAR],
      today: '2026-09-20',
    }
    expect(sliceFor({ ...base, items: [anchor] })).toEqual(sliceFor({ ...base, items: [] }))
  })
})

describe('liveSummaryOf', () => {
  it('reads exactly the cost basis and slice it is handed', () => {
    const anchor = item()
    const day = shift({ odo_start: 0, odo_end: 100, tips: 50 })
    const draft = draftFrom(anchor, day)
    const result = liveSummaryOf(day, draft, { fuel_per_km: 0.1, vehicle_per_km: 0.05 }, {
      figures: null,
      income: null,
      beforePence: 0,
    })
    expect(result.km).toBe(100)
    expect(result.sum.costsPence).toBe(1500)
    expect(result.sum.grossPence).toBe(5000)
  })

  it('with insufficient full-tank data, costs stay unknown — never priced as if the rate were nothing', () => {
    const anchor = item({ area_id: 'area-B' })
    const day = shift({ odo_start: 0, odo_end: 100 })
    const draft = draftFrom(anchor, day)
    // No fuel expenses at all: fuelRateForArea comes back with perKm null,
    // which is exactly what costBasisOf hands a Draft when data is missing.
    const { costBasis } = costBasisOf({
      shift: day,
      completed: false,
      areaId: 'area-B',
      items: [anchor],
      expenses: [],
      costs: [],
    })
    const result = liveSummaryOf(day, draft, costBasis, { figures: null, income: null, beforePence: 0 })
    expect(result.sum.missing).toContain('costs')
    expect(result.sum.costsPence).not.toBeGreaterThan(0)
  })
})
