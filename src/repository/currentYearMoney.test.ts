// currentYearMoney and monthRange's own tests — split out of period.test.ts
// at the 300-line limit; periodMoney itself stays there.

import { describe, expect, it } from 'vitest'

import type { Item } from './item'
import { currentYearMoney, monthRange } from './period'
import type { Shift } from './shift'
import type { TaxYearRow } from './hmrc-year'

function item(id: string, kind: Item['kind'], due: string, over: Partial<Item> = {}): Item {
  return {
    id,
    owner: 'me',
    kind,
    state: 'active',
    title: 'x',
    due,
    done_at: null,
    area_id: null,
    waiting_since: null,
    version: 1,
    created_at: '2026-09-01T00:00:00+00:00',
    updated_at: '2026-09-01T00:00:00+00:00',
    deleted_at: null,
    ...over,
  }
}

function shift(item_id: string, pounds: number, over: Partial<Shift> = {}): Shift {
  return {
    item_id,
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
    earnings: [{ id: 'e1', platform: 'uber_eats', platform_item_id: null, amount: pounds }],
    ...over,
  }
}

function taxYearRow(label: string, over: Partial<TaxYearRow> = {}): TaxYearRow {
  return {
    owner: 'me',
    tax_year: label,
    version: 1,
    created_at: '2026-04-06T00:00:00+00:00',
    updated_at: '2026-04-06T00:00:00+00:00',
    deleted_at: null,
    personal_allowance: 12570,
    taper_from: 100000,
    basic_band: 37700,
    higher_band_to: 125140,
    dividend_allowance: 500,
    class4_from: 12570,
    class4_to: 50270,
    class2_small_profits: 6750,
    class2_year: 179.4,
    employment: 0,
    employment_tax_paid: 0,
    dividends: 0,
    poa_threshold: 1000,
    paid_on_account: 0,
    basic_pct: 20,
    higher_pct: 40,
    additional_pct: 45,
    dividend_basic_pct: 8.75,
    dividend_higher_pct: 33.75,
    dividend_additional_pct: 39.35,
    class4_main_pct: 6,
    class4_upper_pct: 2,
    ...over,
  }
}

describe('currentYearMoney', () => {
  it('reads the tax year "today" falls in, and sums that year alone', () => {
    // s2 is in March, the tax year before — 6 April is where one year ends
    // and the next begins.
    const result = currentYearMoney({
      items: [item('s1', 'shift', '2026-09-05'), item('s2', 'shift', '2026-03-01')],
      shifts: [shift('s1', 1000), shift('s2', 1000)],
      expenses: [],
      links: [],
      taxYears: [],
      today: '2026-09-10',
    })
    expect(result.year.label).toBe('2026/27')
    expect(result.money.grossPence).toBe(100000)
  })

  it('says the reserve is unknown when the year has no settings row', () => {
    const result = currentYearMoney({
      items: [item('s1', 'shift', '2026-09-05')],
      shifts: [shift('s1', 1000)],
      links: [],
      expenses: [],
      taxYears: [],
      today: '2026-09-10',
    })
    expect(result.money.missingRates).toBe(true)
  })

  it("reserves against the year's own settings row, once one exists", () => {
    // Well past the personal allowance for the year, so the basic rate has
    // something real to bite on rather than landing on an untaxed £0.
    const result = currentYearMoney({
      items: [item('s1', 'shift', '2026-09-05')],
      shifts: [shift('s1', 20000)],
      expenses: [],
      links: [],
      taxYears: [taxYearRow('2026/27')],
      today: '2026-09-10',
    })
    expect(result.money.missingRates).toBe(false)
    expect(result.money.taxPence).toBeGreaterThan(0)
  })

  it("ignores a different year's row, and one that was deleted", () => {
    const result = currentYearMoney({
      items: [item('s1', 'shift', '2026-09-05')],
      shifts: [shift('s1', 1000)],
      expenses: [],
      links: [],
      taxYears: [
        taxYearRow('2025/26'),
        taxYearRow('2026/27', { deleted_at: '2026-09-01T00:00:00+00:00' }),
      ],
      today: '2026-09-10',
    })
    expect(result.money.missingRates).toBe(true)
  })
})

describe('monthRange', () => {
  it('ends the month where the month ends', () => {
    expect(monthRange('2026-09')).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
    expect(monthRange('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' })
  })
})
