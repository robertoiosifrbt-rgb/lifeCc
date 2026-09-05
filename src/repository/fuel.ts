// What a kilometre of fuel actually costs, worked out from the pump.
//
// Full tank to full tank, and nothing else. Between two full tanks the amount
// burnt is known exactly — the tank was full at both ends — so the money
// spent in between divided by the distance is a real number. Between partial
// fills it is not: some of what you paid for is still in the tank.
//
// A partial fill still counts its money. It just does not close a leg: it
// belongs to the leg that ends at the next full tank.

export type Fill = {
  /** What was paid, in pence, so the addition is exact. */
  pence: number
  /** The odometer at the pump. */
  odo: number
  /** Whether the tank was filled to the top. */
  full: boolean
  /** How much went in, when it was written down. */
  litres?: number | null
}

export type FuelRate = {
  /** Pounds per kilometre, or null when no complete leg exists yet. */
  perKm: number | null
  /** How many full-tank-to-full-tank legs it is worked out from. */
  legs: number
  /** The distance those legs covered. */
  km: number
  /**
   * What the car actually drinks, over the legs that recorded their litres.
   *
   * Null when the litres are missing, never zero: an unrecorded fill is not a
   * car that runs on nothing. Money per kilometre and litres per kilometre are
   * different questions — the pump price moves, the car's thirst does not —
   * so a leg can count for one and not the other.
   */
  litresPer100Km: number | null
  /** The same thirst in the units the MOT and the forums use. */
  mpg: number | null
  /**
   * Why there is no rate, when there is none.
   *
   * Said rather than left as a bare null: "no rate yet" and "your readings
   * are unusable" need different answers from the person reading it.
   */
  reason: 'ok' | 'no-fills' | 'one-full-tank-only' | 'no-distance'
}

/**
 * The rate over every complete leg.
 *
 * Every leg together rather than the last one: a single tank measures the
 * week it was burnt in — motorway one week, town the next — and a rate that
 * jumps forty percent between fill-ups is not a rate, it is the weather.
 */
export function fuelRate(fills: readonly Fill[]): FuelRate {
  if (fills.length === 0) {
    return {
      perKm: null,
      legs: 0,
      km: 0,
      litresPer100Km: null,
      mpg: null,
      reason: 'no-fills',
    }
  }

  // By odometer, not by date: the odometer is what the distance is measured
  // in, and a receipt entered a week late must not reorder the legs.
  const ordered = [...fills].sort((one, other) => one.odo - other.odo)

  let legs = 0
  let km = 0
  let pence = 0
  let sinceFull: number | null = null
  let pending = 0
  // The thirst is measured over its own legs: a leg where one receipt forgot
  // its litres can still price a kilometre, and counting its distance against
  // the litres it does have would make the car look economical.
  let litreKm = 0
  let litres = 0
  let pendingLitres: number | null = 0

  for (const fill of ordered) {
    if (sinceFull !== null) {
      pending += fill.pence
      const poured = fill.litres ?? null
      pendingLitres = poured === null || pendingLitres === null ? null : pendingLitres + poured
    }
    if (!fill.full) continue

    if (sinceFull !== null) {
      const distance = fill.odo - sinceFull
      // Two full tanks at the same reading measure nothing. Skipping the leg
      // keeps its money out of the average as well — counting the money
      // without the distance would push the rate up for nothing.
      if (distance > 0) {
        legs += 1
        km += distance
        pence += pending
        if (pendingLitres !== null) {
          litreKm += distance
          litres += pendingLitres
        }
      }
    }
    sinceFull = fill.odo
    pending = 0
    pendingLitres = 0
  }

  if (legs === 0) {
    const fullTanks = ordered.filter((fill) => fill.full).length
    return {
      perKm: null,
      legs: 0,
      km: 0,
      litresPer100Km: null,
      mpg: null,
      reason: fullTanks >= 2 ? 'no-distance' : 'one-full-tank-only',
    }
  }

  // Four decimals, which is what the column holds: at £0.116 a kilometre,
  // rounding to the penny would throw away most of the number.
  // 4.54609 litres to the imperial gallon, and 1.609344 km to the mile: UK MPG,
  // which is the number on the forecourt sign and in every forum, not the US
  // gallon that would flatter the car by a fifth.
  const perHundred = litres > 0 && litreKm > 0 ? (litres / litreKm) * 100 : null

  return {
    perKm: Math.round((pence / 100 / km) * 10000) / 10000,
    legs,
    km,
    litresPer100Km: perHundred === null ? null : Math.round(perHundred * 100) / 100,
    mpg:
      perHundred === null
        ? null
        : Math.round((100 / perHundred) * (4.54609 / 1.609344) * 10) / 10,
    reason: 'ok',
  }
}
