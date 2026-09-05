// What a day's work leaves you, worked out in one place.
//
// One place because it will be asked in several: a shift's own sheet, and
// every total over a week, a month or a year that comes after it. The same
// question answered twice is the same question answered two ways eventually.
//
// It is a reserve, not a tax calculation, and it cannot be anything else. A
// flat percentage does not know that the first £12,570 of profit is untaxed,
// or that National Insurance falls to 2% above £50,270. It puts aside too
// much early in the year and too little late, and the right numbers come from
// an accountant, not from here.

import type { Reserve } from './reserve'
import { directCostsPence, earnedPence, kilometres } from './shift'
import type { Shift } from './shift'

export type TakeHome = {
  /** Platforms and tips, before anything is taken off. */
  grossPence: number
  /** Fuel and vehicle wear over the kilometres driven. */
  costsPence: number
  /**
   * Parking, tolls and whatever else the day cost on the road.
   *
   * Apart from `costsPence` because it is a different kind of number: that one
   * is an estimate from a rate per kilometre, this one is money that actually
   * left a pocket. Adding them into one line would hide which half is a guess.
   */
  directPence: number
  /** What the tax is worked out on: gross less the costs of earning it. */
  profitPence: number
  taxPence: number
  niPence: number
  /** What is actually yours. */
  netPence: number
  /**
   * What could not be worked out, and why the numbers above are short.
   *
   * Never silently zero. A shift with no rates set has an unknown reserve, not
   * a reserve of nothing, and a screen that shows £0 tax is lying in the
   * direction that costs money.
   */
  missing: ('rates' | 'costs' | 'kilometres')[]
}


/**
 * The whole sum for one shift.
 *
 * The costs come from the rates pinned on the shift, never from today's
 * settings: it was driven at the price the pump was charging then, and that is
 * what it keeps.
 *
 * The reserve does not, and cannot. What a day owes depends on where its
 * profit lands in the year, so it is worked out against the year rather than
 * frozen — which is why the caller hands in a way of asking. Without one, the
 * reserve is unknown, and unknown is said rather than shown as nothing.
 */
export function takeHome(
  shift: Shift,
  reserveOf?: (profitPence: number) => Reserve | null,
): TakeHome {
  const grossPence = earnedPence(shift)
  const km = kilometres(shift)
  const missing: TakeHome['missing'] = []

  const fuel = shift.rate_fuel_per_km
  const vehicle = shift.rate_vehicle_per_km

  let costsPence = 0
  if (fuel === null || vehicle === null) missing.push('costs')
  else if (km === null) missing.push('kilometres')
  else costsPence = Math.round(km * (fuel + vehicle) * 100)

  const directPence = directCostsPence(shift)
  const profitPence = grossPence - costsPence - directPence

  // A day that lost money owes nothing on it: `reserveFor` says so, and
  // handing money back is not how any of this works.
  const reserve = reserveOf === undefined ? null : reserveOf(profitPence)
  if (reserve === null) missing.push('rates')
  const taxPence = reserve?.taxPence ?? 0
  const niPence = reserve?.niPence ?? 0

  return {
    grossPence,
    costsPence,
    directPence,
    profitPence,
    taxPence,
    niPence,
    netPence: profitPence - taxPence - niPence,
    missing,
  }
}

/** The same sum over many shifts: every part added, then nothing re-rounded. */
export function takeHomeOfAll(
  shifts: readonly Shift[],
  reserveOf?: (profitPence: number) => Reserve | null,
): TakeHome {
  const total: TakeHome = {
    grossPence: 0,
    costsPence: 0,
    directPence: 0,
    profitPence: 0,
    taxPence: 0,
    niPence: 0,
    netPence: 0,
    missing: [],
  }
  const missing = new Set<TakeHome['missing'][number]>()
  for (const shift of shifts) {
    const one = takeHome(shift, reserveOf)
    total.grossPence += one.grossPence
    total.costsPence += one.costsPence
    total.directPence += one.directPence
    total.profitPence += one.profitPence
    total.taxPence += one.taxPence
    total.niPence += one.niPence
    total.netPence += one.netPence
    for (const gap of one.missing) missing.add(gap)
  }
  total.missing = [...missing]
  return total
}
