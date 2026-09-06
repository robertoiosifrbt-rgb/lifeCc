// The shape of a shift: the readings, the sessions, and what each platform
// paid.
//
// It is one object here and three tables in the database, because that is
// what it is: nothing ever asks for a session on its own, only ever for the
// sessions of a shift. Holding it as one thing is what lets the cache replace
// a shift's parts wholesale, which is the sync strategy the migration
// declares.

import { asRecord, optionalNumber, optionalText, requiredText } from './row'

/**
 * The platforms, the same ones the check constraint names.
 *
 * `other` is the fourth because his own app carries otherPlatformEarnings as a
 * column. Here the earnings are one row per platform, so the same thing is one
 * more allowed value and no new column at all.
 */
export const PLATFORMS = ['uber_eats', 'deliveroo', 'just_eat', 'other'] as const
export type Platform = (typeof PLATFORMS)[number]

/** What the platform is called on screen. */
export const PLATFORM_NAMES: Record<Platform, string> = {
  uber_eats: 'Uber Eats',
  deliveroo: 'Deliveroo',
  just_eat: 'Just Eat',
  other: 'Somewhere else',
}

export type ShiftSession = {
  id: string
  /** A moment, not a clock time: a session can run past midnight. */
  started_at: string
  /** Empty while you are still out. */
  ended_at: string | null
  /**
   * The break inside this session, in minutes.
   *
   * On the session and not on the shift: a day with a lunch stint and an
   * evening stint has two breaks in different places, and one number on the
   * shift could not say which was which.
   */
  break_minutes: number
}

export type ShiftEarning = { platform: Platform; amount: number }

export type Shift = {
  item_id: string
  owner: string
  /** The odometer as read. Kilometres are the difference, worked out below. */
  odo_start: number | null
  odo_end: number | null
  tips: number | null
  /**
   * The part of the day's driving that was not work.
   *
   * The detour to the shops is on the same odometer and is not a cost of
   * earning. Null means none was set aside, not that none happened.
   */
  personal_km: number | null
  /**
   * What the day brought in beyond the platforms and the tips, and what it
   * cost on the road.
   *
   * Parking and tolls are here rather than in `expenses` because they are
   * spent inside one shift, never have a receipt worth filing, and belong to
   * that day's own profit rather than to the month's pile of bills.
   */
  bonuses: number | null
  parking: number | null
  tolls: number | null
  other_cost: number | null
  rate_fuel_per_km: number | null
  rate_vehicle_per_km: number | null
  sessions: ShiftSession[]
  earnings: ShiftEarning[]
}

export type ShiftPatch = Partial<
  Pick<
    Shift,
    | 'odo_start'
    | 'odo_end'
    | 'tips'
    | 'personal_km'
    | 'bonuses'
    | 'parking'
    | 'tolls'
    | 'other_cost'
  >
>

function requiredMomentText(raw: Record<string, unknown>, key: string): string {
  const value = requiredText(raw, key)
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${key} is not a moment in time: ${value}`)
  }
  return value
}

export function sessionFromRow(row: unknown): ShiftSession {
  const raw = asRecord(row)
  const started_at = requiredMomentText(raw, 'started_at')
  const ended_at = optionalText(raw, 'ended_at')
  if (ended_at !== null && Number.isNaN(Date.parse(ended_at))) {
    throw new Error(`ended_at is not a moment in time: ${ended_at}`)
  }
  // The database refuses this, so a row carrying it did not come from there.
  if (ended_at !== null && Date.parse(ended_at) <= Date.parse(started_at)) {
    throw new Error('A session that ends before it starts')
  }
  // Absent means none: the column arrived after the rows did, and a session
  // written before it existed had no break recorded, which is a break of
  // nothing rather than an unknown.
  const break_minutes = optionalNumber(raw, 'break_minutes') ?? 0
  if (break_minutes < 0) throw new Error(`A break of less than nothing: ${break_minutes}`)

  return { id: requiredText(raw, 'id'), started_at, ended_at, break_minutes }
}

export function earningFromRow(row: unknown): ShiftEarning {
  const raw = asRecord(row)
  const platform = requiredText(raw, 'platform')
  if (!(PLATFORMS as readonly string[]).includes(platform)) {
    throw new Error(`Unknown platform: ${platform}`)
  }
  const amount = optionalNumber(raw, 'amount')
  if (amount === null) throw new Error('Earning without an amount')
  if (amount < 0) throw new Error(`A platform paid less than nothing: ${amount}`)
  return { platform: platform as Platform, amount }
}

export function shiftFromRow(
  row: unknown,
  sessions: ShiftSession[],
  earnings: ShiftEarning[],
): Shift {
  const raw = asRecord(row)
  const odo_start = optionalNumber(raw, 'odo_start')
  const odo_end = optionalNumber(raw, 'odo_end')
  if (odo_start !== null && odo_end !== null && odo_end < odo_start) {
    throw new Error('The odometer runs backwards')
  }
  return {
    item_id: requiredText(raw, 'item_id'),
    owner: requiredText(raw, 'owner'),
    odo_start,
    odo_end,
    tips: optionalNumber(raw, 'tips'),
    personal_km: optionalNumber(raw, 'personal_km'),
    bonuses: optionalNumber(raw, 'bonuses'),
    parking: optionalNumber(raw, 'parking'),
    tolls: optionalNumber(raw, 'tolls'),
    other_cost: optionalNumber(raw, 'other_cost'),
    rate_fuel_per_km: optionalNumber(raw, 'rate_fuel_per_km'),
    rate_vehicle_per_km: optionalNumber(raw, 'rate_vehicle_per_km'),
    sessions,
    earnings,
  }
}

/**
 * The kilometres of work: the day's distance, less the personal part of it.
 *
 * Null until both readings are there. A shift with only a start has not driven
 * zero kilometres — it has driven an unknown number, and showing zero would be
 * the screen making something up.
 *
 * The detour to the shops is not a cost of earning, and every cost per
 * kilometre in the app is worked out from this. The database refuses a
 * personal figure larger than the day, so the answer cannot go below zero.
 */
export function kilometres(shift: Shift): number | null {
  if (shift.odo_start === null || shift.odo_end === null) return null
  return Math.max(0, shift.odo_end - shift.odo_start - (shift.personal_km ?? 0))
}

/** Everything on the odometer, work and otherwise. What the day cost the car. */
export function drivenKilometres(shift: Shift): number | null {
  if (shift.odo_start === null || shift.odo_end === null) return null
  return shift.odo_end - shift.odo_start
}

/**
 * Minutes worked, over every session that has finished.
 *
 * A session still running is left out rather than counted up to now: a total
 * that grows while you look at it cannot be checked against anything, and the
 * screen says separately that one is open.
 */
export function minutesWorked(shift: Shift): number {
  let total = 0
  for (const session of shift.sessions) {
    if (session.ended_at === null) continue
    const span = (Date.parse(session.ended_at) - Date.parse(session.started_at)) / 60000
    // The break comes off. An hour sitting in a car park is an hour you were
    // out and not an hour you worked, and every rate per hour on the app is
    // this number underneath.
    total += Math.max(0, span - session.break_minutes)
  }
  return Math.round(total)
}

/** Whether a session is still open — you are out now. */
export function isOut(shift: Shift): boolean {
  return shift.sessions.some((session) => session.ended_at === null)
}

/**
 * What Complete Workday and Delete Workday both say when they refuse.
 *
 * A shift is never finished or discarded while a session on it is still
 * running — Stop only ever closes the one session, never the day, so an open
 * session has to be closed first, in words, not by finishing it for you.
 * True for two or more open sessions the same as for one: `isOut` does not
 * count them, and neither does this.
 */
export const STOP_SESSION_FIRST = 'Stop the active session first.'

/**
 * What the shift made: the platforms and the tips together.
 *
 * In pence, so the addition is exact. Money added as floating point drifts,
 * and it drifts in the direction nobody notices until a month is out.
 */
export function earnedPence(shift: Shift): number {
  let total = pence(shift.tips) + pence(shift.bonuses)
  for (const earning of shift.earnings) total += Math.round(earning.amount * 100)
  return total
}

/** Pounds to pence, treating "not filled in" as nothing rather than as NaN. */
function pence(amount: number | null): number {
  return amount === null ? 0 : Math.round(amount * 100)
}

/**
 * What the day cost on the road: parking, tolls, and whatever else.
 *
 * Apart from the fuel and the wear, which are worked out per kilometre from a
 * rate. These are money that actually left a pocket on the day, so they are
 * counted as they were paid.
 */
export function directCostsPence(shift: Shift): number {
  return pence(shift.parking) + pence(shift.tolls) + pence(shift.other_cost)
}
