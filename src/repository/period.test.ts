import { describe, expect, it } from 'vitest'

import type { Expense } from './expense'
import type { Item } from './item'
import { currentYearMoney, monthRange, periodMoney } from './period'
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

function expense(item_id: string, pounds: number): Expense {
  return {
    item_id,
    owner: 'me',
    amount: pounds,
    category: 'fuel',
    odo: null,
    full_tank: null,
    litres: null,
    covers_from: null,
    covers_to: null,
    business_pct: 100,
  }
}

const SEPTEMBER = { from: '2026-09-01', to: '2026-09-30' }

// A year already past its allowance, so a month inside it is taxed at the
// basic rate with Class 4 on top and nothing has to be argued about bands.
const YEAR = {
  figures: {
    personalAllowancePence: 1_257_000,
    taperFromPence: 10_000_000,
    basicBandPence: 3_770_000,
    higherBandToPence: 12_514_000,
    basicPct: 20,
    higherPct: 40,
    additionalPct: 45,
    dividendAllowancePence: 50_000,
    dividendBasicPct: 8.75,
    dividendHigherPct: 33.75,
    dividendAdditionalPct: 39.35,
    poaThresholdPence: 100_000,
    class2SmallProfitsPence: 675_000,
    class2YearPence: 17_940,
    class4FromPence: 1_257_000,
    class4ToPence: 5_027_000,
    class4MainPct: 6,
    class4UpperPct: 2,
  },
  income: {
    tradingPence: 0,
    employmentPence: 0,
    employmentTaxPaidPence: 0,
    dividendsPence: 0,
    paidOnAccountPence: 0,
  },
  beforePence: 2_000_000,
}

describe('periodMoney', () => {
  it('counts what came in, what went out, and reserves on the difference', () => {
    const sum = periodMoney({
      items: [item('s1', 'shift', '2026-09-05'), item('e1', 'expense', '2026-09-03')],
      shifts: [shift('s1', 1000)],
      expenses: [expense('e1', 200)],
      ...SEPTEMBER,
      ...YEAR,
    })
    expect(sum.grossPence).toBe(100000)
    expect(sum.spentPence).toBe(20000)
    expect(sum.profitPence).toBe(80000)
    // £800 of profit landing in the basic band: a fifth of it, and 6% Class 4.
    expect(sum.taxPence).toBe(16000)
    expect(sum.niPence).toBe(4800)
    expect(sum.leftPence).toBe(59200)
    expect(sum.shifts).toBe(1)
  })

  it('never counts a shift consumption as well as the money spent', () => {
    // The shift carries a full set of pinned rates and 500 km driven, which
    // its own sheet turns into a cost. This sum must ignore all of it and use
    // the fill-up instead, or the same fuel is paid for twice.
    const driven = shift('s1', 1000, {
      odo_start: 100000,
      odo_end: 100500,
      rate_fuel_per_km: 0.5,
      rate_vehicle_per_km: 0.5,
    })
    const sum = periodMoney({
      items: [item('s1', 'shift', '2026-09-05'), item('e1', 'expense', '2026-09-03')],
      shifts: [driven],
      expenses: [expense('e1', 200)],
      ...SEPTEMBER,
    })
    // 500 km at £1 would be £500 of consumption. Only the £200 counts.
    expect(sum.spentPence).toBe(20000)
    expect(sum.km).toBe(500)
  })

  it('leaves out days outside the range, and rows that were deleted', () => {
    const sum = periodMoney({
      items: [
        item('s1', 'shift', '2026-08-31'),
        item('s2', 'shift', '2026-10-01'),
        item('s3', 'shift', '2026-09-15', { deleted_at: '2026-09-16T00:00:00+00:00' }),
        item('s4', 'shift', '2026-09-30'),
      ],
      shifts: [shift('s1', 100), shift('s2', 100), shift('s3', 100), shift('s4', 100)],
      expenses: [],
      ...SEPTEMBER,
    })
    expect(sum.shifts).toBe(1)
    expect(sum.grossPence).toBe(10000)
  })

  it('reserves nothing on a month that lost money', () => {
    const sum = periodMoney({
      items: [item('s1', 'shift', '2026-09-05'), item('e1', 'expense', '2026-09-03')],
      shifts: [shift('s1', 100)],
      expenses: [expense('e1', 500)],
      ...SEPTEMBER,
      ...YEAR,
    })
    expect(sum.profitPence).toBe(-40000)
    expect(sum.taxPence).toBe(0)
    expect(sum.leftPence).toBe(-40000)
  })

  it('says the reserve is unknown rather than calling it nothing', () => {
    // No figures for the year: what is owed is unknown, and a screen showing
    // £0.00 would be lying in the direction that costs money.
    const sum = periodMoney({
      items: [item('s1', 'shift', '2026-09-05')],
      shifts: [shift('s1', 100)],
      expenses: [],
      ...SEPTEMBER,
    })
    expect(sum.missingRates).toBe(true)
    expect(sum.taxPence).toBe(0)
  })

  it('adds the hours of finished sessions only', () => {
    const sum = periodMoney({
      items: [item('s1', 'shift', '2026-09-05')],
      shifts: [
        shift('s1', 100, {
          sessions: [
            {
              id: 'a',
              started_at: '2026-09-05T09:00:00+00:00',
              ended_at: '2026-09-05T12:30:00+00:00',
              break_minutes: 0,
            },
            { id: 'b', started_at: '2026-09-05T17:00:00+00:00', ended_at: null, break_minutes: 0 },
          ],
        }),
      ],
      expenses: [],
      ...SEPTEMBER,
    })
    expect(sum.minutes).toBe(210)
  })
})

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
