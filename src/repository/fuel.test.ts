import { describe, expect, it } from 'vitest'

import { fuelRate } from './fuel'
import type { Fill } from './fuel'

const fill = (odo: number, pounds: number, full = true): Fill => ({
  odo,
  pence: Math.round(pounds * 100),
  full,
})

describe('fuelRate', () => {
  it('works the rate out between two full tanks', () => {
    // Filled at 120000, filled again at 120500 having paid £58: the 500 km in
    // between burnt exactly that tank.
    const rate = fuelRate([fill(120000, 70), fill(120500, 58)])
    expect(rate.perKm).toBeCloseTo(0.116)
    expect(rate.legs).toBe(1)
    expect(rate.km).toBe(500)
    expect(rate.reason).toBe('ok')
  })

  it('ignores what was paid at the first full tank', () => {
    // That tank is burnt over the leg that follows, and its money is counted
    // there. Counting it here would charge one tank to no distance at all.
    expect(fuelRate([fill(120000, 999), fill(120500, 58)]).perKm).toBeCloseTo(0.116)
  })

  it('counts a partial fill without letting it close a leg', () => {
    // £30 splashed in at 120250 is money spent on this leg; the leg still
    // runs full tank to full tank.
    const rate = fuelRate([fill(120000, 70), fill(120250, 30, false), fill(120500, 28)])
    expect(rate.legs).toBe(1)
    expect(rate.km).toBe(500)
    expect(rate.perKm).toBeCloseTo(0.116)
  })

  it('averages over every leg, not over the last one', () => {
    const rate = fuelRate([
      fill(0, 50),
      fill(1000, 100), // £100 over 1000 km
      fill(2000, 300), // £300 over 1000 km
    ])
    expect(rate.legs).toBe(2)
    expect(rate.km).toBe(2000)
    // £400 over 2000 km, not the £0.30 of the second leg alone.
    expect(rate.perKm).toBeCloseTo(0.2)
  })

  it('reads by odometer, so a receipt entered late does not reorder anything', () => {
    const late = fuelRate([fill(120500, 58), fill(120000, 70)])
    expect(late.perKm).toBeCloseTo(0.116)
  })

  it('says why there is no rate rather than answering zero', () => {
    expect(fuelRate([])).toMatchObject({ perKm: null, reason: 'no-fills' })
    expect(fuelRate([fill(120000, 70)])).toMatchObject({
      perKm: null,
      reason: 'one-full-tank-only',
    })
    expect(fuelRate([fill(1, 30, false), fill(2, 30, false)])).toMatchObject({
      perKm: null,
      reason: 'one-full-tank-only',
    })
    // Two full tanks, same reading: nothing was measured, and the money that
    // went in stays out of the average with it.
    expect(fuelRate([fill(120000, 70), fill(120000, 58)])).toMatchObject({
      perKm: null,
      reason: 'no-distance',
    })
  })
})

describe('what the car drinks', () => {
  it('works out l/100km and UK MPG between two full tanks', () => {
    // 500 km on 40 litres: 8 l/100km, which is 35.3 mpg imperial.
    const rate = fuelRate([
      { pence: 6000, odo: 120000, full: true, litres: 45 },
      { pence: 5600, odo: 120500, full: true, litres: 40 },
    ])
    expect(rate.litresPer100Km).toBe(8)
    expect(rate.mpg).toBe(35.3)
  })

  it('says nothing about thirst when the litres were not written down', () => {
    // The money still prices a kilometre. An unrecorded fill is not a car that
    // runs on air, so the thirst is unknown rather than flattering.
    const rate = fuelRate([
      { pence: 6000, odo: 120000, full: true },
      { pence: 5600, odo: 120500, full: true },
    ])
    expect(rate.perKm).toBe(0.112)
    expect(rate.litresPer100Km).toBeNull()
    expect(rate.mpg).toBeNull()
  })

  it('drops a leg from the thirst but keeps it in the price', () => {
    // The middle receipt lost its litres. That leg can still say what a
    // kilometre cost; counting its distance against the litres it does have
    // would make the car look a third more economical than it is.
    const rate = fuelRate([
      { pence: 6000, odo: 120000, full: true, litres: 45 },
      { pence: 5600, odo: 120500, full: true },
      { pence: 5600, odo: 121000, full: true, litres: 40 },
    ])
    expect(rate.legs).toBe(2)
    expect(rate.km).toBe(1000)
    expect(rate.litresPer100Km).toBe(8)
  })
})
