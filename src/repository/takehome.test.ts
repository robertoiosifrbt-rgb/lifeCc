import { describe, expect, it } from 'vitest'

import type { Shift } from './shift'
import { takeHome, takeHomeOfAll } from './takehome'

/** A day already past the year's allowance: 20% and 6% on what it adds. */
const RESERVE = (profitPence: number) =>
  profitPence <= 0
    ? { taxPence: 0, niPence: 0, totalPence: 0 }
    : {
        taxPence: Math.round(profitPence * 0.2),
        niPence: Math.round(profitPence * 0.06),
        totalPence: Math.round(profitPence * 0.26),
      }

/** The day the owner showed: £126.45 over 167.4 km, at £0.116 the kilometre. */
function day(over: Partial<Shift> = {}): Shift {
  return {
    item_id: 'i1',
    owner: 'me',
    odo_start: 120345,
    odo_end: 120512.4,
    tips: 12.5,
    personal_km: null,
    bonuses: null,
    parking: null,
    tolls: null,
    other_cost: null,
    rate_fuel_per_km: 0.116,
    rate_vehicle_per_km: 0.116,
    sessions: [],
    earnings: [
      { id: 'e1', platform: 'uber_eats', platform_item_id: null, amount: 64.2 },
      { id: 'e2', platform: 'deliveroo', platform_item_id: null, amount: 31 },
      { id: 'e3', platform: 'just_eat', platform_item_id: null, amount: 18.75 },
    ],
    ...over,
  }
}

describe('takeHome', () => {
  it('takes the reserves off the profit, not off the takings', () => {
    const sum = takeHome(day(), RESERVE)
    expect(sum.grossPence).toBe(12645)
    // 167.4 km at £0.232 the kilometre.
    expect(sum.costsPence).toBe(3884)
    expect(sum.profitPence).toBe(8761)
    expect(sum.taxPence).toBe(1752)
    expect(sum.niPence).toBe(526)
    expect(sum.netPence).toBe(6483)
    expect(sum.missing).toEqual([])
  })

  it('says what it could not work out instead of calling it zero', () => {
    // No way of asking the year: what is owed is unknown, not nothing.
    const noYear = takeHome(day())
    expect(noYear.taxPence).toBe(0)
    expect(noYear.missing).toContain('rates')

    const noCosts = takeHome(
      day({ rate_fuel_per_km: null, rate_vehicle_per_km: null }),
      RESERVE,
    )
    expect(noCosts.costsPence).toBe(0)
    expect(noCosts.missing).toContain('costs')

    const noReading = takeHome(day({ odo_end: null }), RESERVE)
    expect(noReading.costsPence).toBe(0)
    expect(noReading.missing).toContain('kilometres')
  })

  it('reserves nothing on a day that lost money', () => {
    // Two hundred kilometres and almost nothing earned: the costs are more
    // than the takings, and a percentage of a loss is not money coming back.
    const bad = takeHome(
      day({ odo_start: 0, odo_end: 200, tips: null, earnings: [] }),
      RESERVE,
    )
    expect(bad.profitPence).toBeLessThan(0)
    expect(bad.taxPence).toBe(0)
    expect(bad.niPence).toBe(0)
    expect(bad.netPence).toBe(bad.profitPence)
  })

  it('keeps the driving rates the shift was worked under', () => {
    // The pinning is the database's job; this only proves the costs come off
    // the shift and never off a setting. What a kilometre cost in October is
    // history, and the pump does not re-price last month.
    const cheap = takeHome(day({ rate_fuel_per_km: 0.1, rate_vehicle_per_km: 0.1 }), RESERVE)
    const dear = takeHome(day({ rate_fuel_per_km: 0.2, rate_vehicle_per_km: 0.2 }), RESERVE)
    expect(cheap.costsPence).toBe(3348)
    expect(dear.costsPence).toBe(6696)
  })
})

describe('takeHomeOfAll', () => {
  it('adds the parts up, and carries every gap forward', () => {
    const total = takeHomeOfAll(
      [day(), day({ rate_fuel_per_km: null, rate_vehicle_per_km: null })],
      RESERVE,
    )
    expect(total.grossPence).toBe(25290)
    expect(total.missing).toEqual(['costs'])
  })

  it('is nothing at all over no shifts', () => {
    expect(takeHomeOfAll([])).toEqual({
      grossPence: 0,
      costsPence: 0,
      directPence: 0,
      profitPence: 0,
      taxPence: 0,
      niPence: 0,
      netPence: 0,
      missing: [],
    })
  })
})

describe('what the day cost on the road', () => {
  it('takes parking, tolls and the rest off the profit', () => {
    // £126.45 made, £19.42 of fuel and wear over 167.4 km, then £4.50 of
    // parking and £2 of tolls that actually left a pocket.
    const bare = takeHome(day())
    const withCosts = takeHome(day({ parking: 4.5, tolls: 2, other_cost: 1.25 }))
    expect(withCosts.directPence).toBe(775)
    expect(withCosts.profitPence).toBe(bare.profitPence - 775)
  })

  it('counts a bonus as money made, like a tip', () => {
    const bare = takeHome(day())
    const withBonus = takeHome(day({ bonuses: 15 }))
    expect(withBonus.grossPence).toBe(bare.grossPence + 1500)
  })

  it('treats a blank as nothing, not as a broken sum', () => {
    // Every one of these columns arrived after the rows did, so most shifts
    // carry null. Null must read as zero here or every old day goes to NaN.
    expect(takeHome(day()).directPence).toBe(0)
  })
})
