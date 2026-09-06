// sliceFor and liveSummaryOf's own tests — split out of liveSummary.test.ts
// at the 300-line limit; costBasisOf stays there.

import { describe, expect, it } from 'vitest'

import type { Item } from '../repository/item'
import type { Shift } from '../repository/shift'
import type { TaxYearRow } from '../repository/hmrc-year'
import { draftFrom } from './draft'
import { costBasisOf, liveSummaryOf, sliceFor } from './liveSummary'
import type { VehicleLink } from '../repository/vehicle'

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

describe('sliceFor', () => {
  it('follows the Draft’s own date, not the persisted one', () => {
    const anchor = item({ due: '2026-09-05' })
    const bigEarlyProfit = item({ id: 'other1', due: '2026-09-10' })
    const bigEarlyShift = shift({
      item_id: 'other1',
      earnings: [{ id: 'e1', platform: 'uber_eats', platform_item_id: null, amount: 100000 }],
    })
    const base = {
      item: anchor,
      items: [anchor, bigEarlyProfit],
      shifts: [bigEarlyShift],
      expenses: [],
      taxYears: [YEAR],
    }
    // Moved earlier than the big month: none of it counts as "before".
    expect(sliceFor({ ...base, due: '2026-09-05' }).beforePence).toBe(0)
    // Moved later than the big month: all of it counts as "before".
    expect(sliceFor({ ...base, due: '2026-09-15' }).beforePence).toBeGreaterThan(0)
  })

  it('a blank date is never today in disguise: the slice comes back unknown, not computed against today', () => {
    const anchor = item({ due: '2026-09-05' })
    const slice = sliceFor({
      item: anchor,
      due: '',
      items: [anchor],
      shifts: [],
      expenses: [],
      taxYears: [YEAR],
    })
    expect(slice.figures).toBeNull()
    expect(slice.income).toBeNull()
  })

  it('entering a date immediately produces a real slice; clearing it again returns to unknown', () => {
    const anchor = item({ due: '2026-09-05' })
    const dated = sliceFor({
      item: anchor,
      due: '2026-09-05',
      items: [anchor],
      shifts: [],
      expenses: [],
      taxYears: [YEAR],
    })
    expect(dated.figures).not.toBeNull()
    const cleared = sliceFor({
      item: anchor,
      due: '',
      items: [anchor],
      shifts: [],
      expenses: [],
      taxYears: [YEAR],
    })
    expect(cleared.figures).toBeNull()
  })

  it('excludes this Workday itself from what the year made before it', () => {
    // Moved from an early persisted date to a later Draft date: if the
    // anchor were not excluded, its own (stale) row would fall inside the
    // "before" window under its old date and double-count its own profit.
    const anchor = item({ due: '2026-09-01' })
    const day = shift({ earnings: [{ id: 'e1', platform: 'uber_eats', platform_item_id: null, amount: 500 }] })
    const base = {
      item: anchor,
      due: '2026-09-20',
      shifts: [day],
      expenses: [],
      taxYears: [YEAR],
    }
    expect(sliceFor({ ...base, items: [anchor] })).toEqual(sliceFor({ ...base, items: [] }))
  })
})

describe('liveSummaryOf', () => {
  it('reads exactly the cost basis and slice it is handed', () => {
    const anchor = item()
    const day = shift({ odo_start: 0, odo_end: 100, tips: 50 })
    const draft = draftFrom(anchor, day, [], [])
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
    const draft = draftFrom(anchor, day, [], [])
    // No fuel expenses at all: fuelRateForVehicle comes back with perKm
    // null, which is exactly what costBasisOf hands a Draft when data is
    // missing.
    const { costBasis } = costBasisOf({
      shift: day,
      completed: false,
      vehicle: NO_VEHICLE,
      expenses: [],
      links: [],
      entities: [],
      vehicleCostRates: [],
      today: '2026-09-05',
    })
    const result = liveSummaryOf(day, draft, costBasis, { figures: null, income: null, beforePence: 0 })
    expect(result.sum.missing).toContain('costs')
    expect(result.sum.costsPence).not.toBeGreaterThan(0)
  })
})
