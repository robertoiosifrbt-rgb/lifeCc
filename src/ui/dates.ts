// Dates, written out. One place, so "20 August" looks the same everywhere.

import { localToday } from '../repository/item'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

function parts(day: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (match === null) throw new Error(`Not a day: ${day}`)
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
}

/**
 * "20 August", or "20 August 2025" when it falls in another year than today.
 *
 * The year appears only when leaving it out could mislead.
 */
export function formatDay(day: string, today: string): string {
  const { year, month, day: date } = parts(day)
  const monthName = MONTHS[month - 1]
  if (monthName === undefined) throw new Error(`Invalid month: ${day}`)

  return year === parts(today).year
    ? `${date} ${monthName}`
    : `${date} ${monthName} ${year}`
}

/** "Friday, 4 September" — the heading of a day in the Calendar. */
export function formatWeekday(day: string, today: string): string {
  const { year, month, day: date } = parts(day)
  // Noon UTC: far enough from midnight that a timezone cannot shift the day.
  const name = WEEKDAYS[new Date(Date.UTC(year, month - 1, date, 12)).getUTCDay()]
  if (name === undefined) throw new Error(`Invalid day: ${day}`)
  return `${name}, ${formatDay(day, today)}`
}

/** The day `days` days before the given one, as 'YYYY-MM-DD'. */
export function minusDays(day: string, days: number): string {
  const { year, month, day: date } = parts(day)
  const at = new Date(Date.UTC(year, month - 1, date, 12))
  at.setUTCDate(at.getUTCDate() - days)
  const y = at.getUTCFullYear()
  const m = String(at.getUTCMonth() + 1).padStart(2, '0')
  const d = String(at.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * The day a timestamp fell on, where you are, as 'YYYY-MM-DD'.
 *
 * Not the first ten characters. Timestamps come out of the database in UTC, so
 * anything you write after 21:00 in the summer here carries the day before,
 * and the label saying when the oldest thing was written would name a day you
 * never wrote on.
 */
export function dayOf(timestamp: string): string {
  const at = new Date(timestamp)
  if (Number.isNaN(at.getTime())) throw new Error(`Not a timestamp: ${timestamp}`)
  return localToday(at)
}

function monthParts(month: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (match === null) throw new Error(`Not a month: ${month}`)
  return { year: Number(match[1]), month: Number(match[2]) }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** The month a day falls in, as 'YYYY-MM'. */
export function monthOf(day: string): string {
  const { year, month } = parts(day)
  return `${year}-${pad(month)}`
}

/** The month `by` months away, as 'YYYY-MM'. Negative goes back. */
export function shiftMonth(month: string, by: number): string {
  const { year, month: m } = monthParts(month)
  const at = new Date(Date.UTC(year, m - 1 + by, 1, 12))
  return `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}`
}

/**
 * "September", or "September 2027" when it falls in another year than today.
 *
 * The same rule as formatDay: the year appears only when leaving it out could
 * mislead. It also buys the heading room it genuinely needs — three buttons
 * and a title share 320px on the narrowest phone.
 */
export function formatMonth(month: string, today: string): string {
  const { year, month: m } = monthParts(month)
  const name = MONTHS[m - 1]
  if (name === undefined) throw new Error(`Invalid month: ${month}`)
  return year === parts(today).year ? name : `${name} ${year}`
}

/** Every day of the month, in order, as 'YYYY-MM-DD'. */
export function monthDays(month: string): string[] {
  const { year, month: m } = monthParts(month)
  const days: string[] = []
  const at = new Date(Date.UTC(year, m - 1, 1, 12))
  while (at.getUTCMonth() === m - 1) {
    days.push(`${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`)
    at.setUTCDate(at.getUTCDate() + 1)
  }
  return days
}

/** The day `days` days after the given one, as 'YYYY-MM-DD'. */
export function plusDays(day: string, days: number): string {
  return minusDays(day, -days)
}

/**
 * Which column the day sits in, with the week starting on Monday: 0 for
 * Monday, 6 for Sunday.
 */
export function weekdayIndex(day: string): number {
  const { year, month, day: date } = parts(day)
  const sunday = new Date(Date.UTC(year, month - 1, date, 12)).getUTCDay()
  return (sunday + 6) % 7
}

/**
 * A moment, as an `<input type="datetime-local">` wants it: the device's own
 * wall clock, not UTC. A phone in Bucharest journalling "now" must show its
 * own 22:14, not London's 20:14 — the input has no timezone of its own, so
 * whichever one is used to fill it is the one the person reads back.
 */
export function localDateTimeInput(at: Date): string {
  const y = at.getFullYear()
  const m = pad(at.getMonth() + 1)
  const d = pad(at.getDate())
  const h = pad(at.getHours())
  const min = pad(at.getMinutes())
  return `${y}-${m}-${d}T${h}:${min}`
}

/**
 * The moment a datetime-local value names, read on this device's own clock,
 * as an ISO string the database can store.
 *
 * `new Date(y, m, d, h, min)` reads its arguments in the device's timezone,
 * which is exactly what undoes localDateTimeInput: the same wall-clock
 * reading goes in that came out.
 */
export function momentFromLocalInput(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (match === null) throw new Error(`Not a local date and time: ${value}`)
  const [, y, mo, d, h, mi] = match
  const at = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi))
  return at.toISOString()
}

/** "20 August, 14:32" — a journalled moment, on the device's own clock. */
export function formatMoment(moment: string, today: string): string {
  const at = new Date(moment)
  if (Number.isNaN(at.getTime())) throw new Error(`Not a moment: ${moment}`)
  return `${formatDay(localToday(at), today)}, ${pad(at.getHours())}:${pad(at.getMinutes())}`
}
