// Everything that can be wrong with a draft, checked before either Save draft
// or Complete Workday is let through — split out of `draft.ts` at the
// 300-line limit.

import type { Shift } from '../repository/items'
import { PLATFORMS } from '../repository/items'
import type { Draft } from './draft'
import { parseBreak, parseMoney, parseReading } from './draft'
import { sessionsToRemoveOf } from './draftPatches'

export type ValidationError = { field: string; message: string }

/**
 * Everything wrong with the draft as it stands.
 *
 * Unknown values are never flagged — a blank field is a thing not yet said,
 * not an error. Only what was actually typed, and typed wrongly, stops a
 * save: a reading that runs backwards, personal kilometres beyond the day,
 * or a break longer than the session that holds it.
 */
export function validateDraft(shift: Shift, draft: Draft): ValidationError[] {
  const errors: ValidationError[] = []

  if (draft.title.trim() === '') {
    errors.push({ field: 'title', message: 'A workday needs a title.' })
  }

  const fields: [string, { ok: boolean; error?: string }][] = [
    ['odo_start', parseReading(draft.odo_start)],
    ['odo_end', parseReading(draft.odo_end)],
    ['personal_km', parseReading(draft.personal_km)],
    ['tips', parseMoney(draft.tips)],
    ['bonuses', parseMoney(draft.bonuses)],
    ['parking', parseMoney(draft.parking)],
    ['tolls', parseMoney(draft.tolls)],
    ['other_cost', parseMoney(draft.other_cost)],
  ]
  for (const platform of PLATFORMS) {
    fields.push([`earning:${platform}`, parseMoney(draft.earnings[platform])])
  }
  const removed = sessionsToRemoveOf(shift, draft)
  const remaining = shift.sessions.filter((session) => !removed.includes(session.id))
  for (const session of remaining) {
    fields.push([`break:${session.id}`, parseBreak(draft.breaks[session.id] ?? '')])
  }
  for (const [field, parsed] of fields) {
    if (!parsed.ok && parsed.error !== undefined) errors.push({ field, message: parsed.error })
  }

  const start = parseReading(draft.odo_start)
  const end = parseReading(draft.odo_end)
  const personal = parseReading(draft.personal_km)
  if (start.ok && end.ok && start.value !== null && end.value !== null && end.value < start.value) {
    errors.push({ field: 'odo_end', message: 'The end reading cannot be below the start.' })
  }
  if (
    start.ok && end.ok && personal.ok &&
    start.value !== null && end.value !== null && personal.value !== null &&
    personal.value > end.value - start.value
  ) {
    errors.push({
      field: 'personal_km',
      message: 'Personal kilometres cannot be more than the distance driven.',
    })
  }

  for (const session of remaining) {
    if (session.ended_at === null) continue
    const parsed = parseBreak(draft.breaks[session.id] ?? '')
    if (!parsed.ok) continue
    const spanMinutes = (Date.parse(session.ended_at) - Date.parse(session.started_at)) / 60000
    if (parsed.value > spanMinutes) {
      errors.push({
        field: `break:${session.id}`,
        message: 'A break cannot be longer than the session it sits in.',
      })
    }
  }

  return errors
}

/**
 * What Complete Workday needs beyond a valid draft.
 *
 * Save draft never checks any of this — an incomplete workday still saves,
 * exactly as typed so far. Complete is the one action that says a day is
 * finished, so it is the one that asks for a date, at least one session
 * that actually happened, both odometer readings, and a cost basis that is
 * actually known — not a guess, not a silent zero. HMRC's year figures are
 * deliberately not asked here: `sum.missing` already says when tax cannot be
 * worked out, and that is a fact about the year's settings, not about
 * whether this day is done.
 */
export function validateCompletion(input: {
  draft: Draft
  shift: Shift
  fuelPerKm: number | null
  vehiclePerKm: number | null
}): ValidationError[] {
  const { draft, shift, fuelPerKm, vehiclePerKm } = input
  const errors: ValidationError[] = []

  if (draft.due.trim() === '') {
    errors.push({ field: 'due', message: 'A completed workday needs a date.' })
  }

  const removed = sessionsToRemoveOf(shift, draft)
  const closedSessions = shift.sessions.filter(
    (session) => !removed.includes(session.id) && session.ended_at !== null,
  )
  if (closedSessions.length === 0) {
    errors.push({
      field: 'sessions',
      message: 'A completed workday needs at least one finished work session.',
    })
  }

  const start = parseReading(draft.odo_start)
  if (!start.ok || start.value === null) {
    errors.push({ field: 'odo_start', message: 'A completed workday needs a starting odometer reading.' })
  }
  const end = parseReading(draft.odo_end)
  if (!end.ok || end.value === null) {
    errors.push({ field: 'odo_end', message: 'A completed workday needs an ending odometer reading.' })
  }

  if (fuelPerKm === null) {
    errors.push({ field: 'fuel', message: 'The automatic fuel rate is not known yet.' })
  }
  if (vehiclePerKm === null) {
    errors.push({ field: 'vehicle', message: 'The vehicle cost is not configured yet.' })
  }

  return errors
}
