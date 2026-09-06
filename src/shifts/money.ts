// Money and hours, written for reading rather than for arithmetic.
//
// The arithmetic happens in pence and in minutes, in the repository. These
// only turn a number into something a person recognises at a glance, on a
// phone, in the dark, after nine hours of driving.

import type { Shift } from '../repository/items'

/** Pence as pounds: 12645 → '£126.45'. Never rounded away to whole pounds. */
export function pounds(pence: number): string {
  const sign = pence < 0 ? '-' : ''
  const whole = Math.floor(Math.abs(pence) / 100)
  const rest = String(Math.abs(pence) % 100).padStart(2, '0')
  return `${sign}£${whole}.${rest}`
}

/**
 * Minutes as hours and minutes: 210 → '3h 30m'.
 *
 * Not '3.5h'. Nobody reads a decimal hour and knows what time it is; the two
 * numbers are the ones the day was actually made of.
 */
export function hoursAndMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}m`
}

/** The clock time of a moment, in the device's own timezone: '21:04'. */
export function clock(moment: string): string {
  const at = new Date(moment)
  const hours = String(at.getHours()).padStart(2, '0')
  const minutes = String(at.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * What the person typed, as pence.
 *
 * Empty is nothing, not zero — clearing a field means "I have not said", and
 * writing zero would be the screen answering on your behalf. Anything that is
 * not a number is refused rather than guessed at.
 */
export function penceOf(typed: string): number | null {
  const trimmed = typed.trim().replace(/^£/, '')
  if (trimmed === '') return null
  if (!/^\d+([.,]\d{0,2})?$/.test(trimmed)) {
    throw new Error(`That is not an amount: ${typed}`)
  }
  return Math.round(Number(trimmed.replace(',', '.')) * 100)
}

/** What the person typed, as a reading on the odometer. */
export function readingOf(typed: string): number | null {
  const trimmed = typed.trim()
  if (trimmed === '') return null
  if (!/^\d+([.,]\d)?$/.test(trimmed)) {
    throw new Error(`That is not an odometer reading: ${typed}`)
  }
  return Number(trimmed.replace(',', '.'))
}

/** What the person typed, as a rate per kilometre — four decimal places. */
export function rateOf(typed: string): number | null {
  const trimmed = typed.trim().replace(/^£/, '').replace(',', '.')
  if (trimmed === '') return null
  if (!/^\d+(\.\d{1,4})?$/.test(trimmed)) {
    throw new Error(`That is not an amount per kilometre: ${typed}`)
  }
  return Number(trimmed)
}

/**
 * A shift with nothing in it yet.
 *
 * The anchor item exists before its numbers do — the row is written a moment
 * after the item — so the sheet needs something to draw in between. Empty
 * fields, not zeros: a shift that has not been filled in has no takings, and
 * £0.00 is a claim.
 */
export const EMPTY_SHIFT: Shift = {
  item_id: '',
  owner: '',
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
}
