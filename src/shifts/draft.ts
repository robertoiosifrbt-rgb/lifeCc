// The Workday form as the owner actually fills it in: typed, previewed
// locally, and saved only when told to.
//
// A shift used to write every field the moment you left it, which is exactly
// the model this replaces — the owner cannot tell what has and has not been
// written, in a van, between drops. So the sheet now holds a draft: what is
// typed, not yet what is saved. The live summary reads the draft; Save draft
// and Complete Workday are the only two places that turn it into a write, and
// both write only the fields that actually changed.
//
// This file is the draft itself and the one preview built from it. What to
// write (`draftPatches.ts`) and what is wrong with it (`draftValidate.ts`)
// are their own files — the same split the structure checker already asks
// every other 300-line file in this codebase to make.

import type { Item, Platform, Shift } from '../repository/items'
import { PLATFORMS } from '../repository/items'
import { penceOf, readingOf } from './money'

export type Draft = {
  title: string
  due: string
  area_id: string
  odo_start: string
  odo_end: string
  personal_km: string
  tips: string
  bonuses: string
  parking: string
  tolls: string
  other_cost: string
  earnings: Record<Platform, string>
  breaks: Record<string, string>
  /**
   * Sessions marked to go, not yet gone.
   *
   * Removing a session is a real delete, same as dropping a platform's
   * earning — it belongs in the draft rather than firing on the click, so a
   * mis-tapped × does not delete anything until Save draft actually runs.
   */
  removedSessions: string[]
}

export type ParsedField =
  | { ok: true; value: number | null }
  | { ok: false; error: string }

/** A break is always a whole number when it parses — never unknown. */
export type ParsedBreak = { ok: true; value: number } | { ok: false; error: string }

function moneyText(value: number | null): string {
  return value === null ? '' : value.toFixed(2)
}

function readingText(value: number | null): string {
  return value === null ? '' : String(value)
}

/** The draft as it starts: exactly what is already saved, as typed text. */
export function draftFrom(item: Item, shift: Shift): Draft {
  const earnings = {} as Record<Platform, string>
  for (const platform of PLATFORMS) {
    const found = shift.earnings.find((earning) => earning.platform === platform)
    earnings[platform] = found === undefined ? '' : found.amount.toFixed(2)
  }
  const breaks: Record<string, string> = {}
  for (const session of shift.sessions) {
    breaks[session.id] = session.break_minutes === 0 ? '' : String(session.break_minutes)
  }
  return {
    title: item.title,
    due: item.due ?? '',
    area_id: item.area_id ?? '',
    odo_start: readingText(shift.odo_start),
    odo_end: readingText(shift.odo_end),
    personal_km: readingText(shift.personal_km),
    tips: moneyText(shift.tips),
    bonuses: moneyText(shift.bonuses),
    parking: moneyText(shift.parking),
    tolls: moneyText(shift.tolls),
    other_cost: moneyText(shift.other_cost),
    earnings,
    breaks,
    removedSessions: [],
  }
}

export function parseMoney(typed: string): ParsedField {
  try {
    const pence = penceOf(typed)
    return { ok: true, value: pence === null ? null : pence / 100 }
  } catch (reason) {
    return { ok: false, error: reason instanceof Error ? reason.message : String(reason) }
  }
}

export function parseReading(typed: string): ParsedField {
  try {
    return { ok: true, value: readingOf(typed) }
  } catch (reason) {
    return { ok: false, error: reason instanceof Error ? reason.message : String(reason) }
  }
}

/** A break, in whole minutes. Blank is a break of nothing, not unknown. */
export function parseBreak(typed: string): ParsedBreak {
  const trimmed = typed.trim()
  if (trimmed === '') return { ok: true, value: 0 }
  const minutes = Number(trimmed)
  if (!Number.isInteger(minutes) || minutes < 0) {
    return { ok: false, error: `A break has to be whole minutes: ${typed}` }
  }
  return { ok: true, value: minutes }
}

function orNull(field: ParsedField): number | null {
  return field.ok ? field.value : null
}

/** The cost basis a preview should use — never a second take-home formula,
 *  only ever a different pair of numbers fed into the one that exists. */
export type CostBasis = { fuel_per_km: number | null; vehicle_per_km: number | null }

/**
 * What the live summary reads: the saved shift, with every field the draft
 * changed swapped in. An invalid keystroke is not shown as a value — it falls
 * back to unknown rather than freezing on the last good number, the same rule
 * as everywhere else in the app: unknown is never zero and never a guess.
 *
 * `costBasis` is the caller's job to pick: the Area's current automatic rate
 * while still a Draft (so changing the Area, or the fuel data behind it,
 * shows up immediately — never a stale rate pinned under a different Area),
 * or the shift's own pinned, frozen rate once Completed. Either way this
 * function only ever swaps numbers into the same `Shift` shape; the same
 * `takeHome`, `kilometres` and `minutesWorked` the persisted shift uses read
 * the result. There is no second formula for "while you are typing".
 */
export function previewShiftOf(shift: Shift, draft: Draft, costBasis: CostBasis): Shift {
  const earnings = PLATFORMS.flatMap((platform) => {
    const parsed = parseMoney(draft.earnings[platform])
    if (!parsed.ok || parsed.value === null) return []
    return [{ platform, amount: parsed.value }]
  })
  const sessions = shift.sessions
    .filter((session) => !draft.removedSessions.includes(session.id))
    .map((session) => {
      const parsed = parseBreak(draft.breaks[session.id] ?? '')
      return { ...session, break_minutes: parsed.ok ? parsed.value : session.break_minutes }
    })
  return {
    ...shift,
    odo_start: orNull(parseReading(draft.odo_start)),
    odo_end: orNull(parseReading(draft.odo_end)),
    personal_km: orNull(parseReading(draft.personal_km)),
    tips: orNull(parseMoney(draft.tips)),
    bonuses: orNull(parseMoney(draft.bonuses)),
    parking: orNull(parseMoney(draft.parking)),
    tolls: orNull(parseMoney(draft.tolls)),
    other_cost: orNull(parseMoney(draft.other_cost)),
    rate_fuel_per_km: costBasis.fuel_per_km,
    rate_vehicle_per_km: costBasis.vehicle_per_km,
    earnings,
    sessions,
  }
}
