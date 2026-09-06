// Everything that can be wrong with a draft, checked before either Save draft
// or Complete Workday is let through — split out of `draft.ts` at the
// 300-line limit.

import type { Shift } from '../repository/items'
import { PLATFORMS } from '../repository/items'
import type { Draft } from './draft'
import { parseBreak, parseMoney, parseReading } from './draft'

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
  const remaining = shift.sessions.filter((session) => !draft.removedSessions.includes(session.id))
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
