// The Workday form as the owner actually fills it in: typed, previewed
// locally, and saved only when told to.
//
// A shift used to write every field the moment you left it, which is exactly
// the model this replaces — the owner cannot tell what has and has not been
// written, in a van, between drops. So the sheet now holds a draft: what is
// typed, not yet what is saved. The live summary reads the draft; Save draft
// and Complete Workday are the only two places that turn it into a write, and
// both write only the fields that actually changed.

import type { Item, Patch, Platform, Shift, ShiftPatch } from '../repository/items'
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
}

export type ParsedField =
  | { ok: true; value: number | null }
  | { ok: false; error: string }

/** A break is always a whole number when it parses — never unknown. */
export type ParsedBreak = { ok: true; value: number } | { ok: false; error: string }

export type ValidationError = { field: string; message: string }

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

/**
 * What the live summary reads: the saved shift, with every field the draft
 * changed swapped in. An invalid keystroke is not shown as a value — it falls
 * back to unknown rather than freezing on the last good number, the same rule
 * as everywhere else in the app: unknown is never zero and never a guess.
 *
 * The same `takeHome`, `kilometres` and `minutesWorked` the persisted shift
 * uses read this. There is no second formula for "while you are typing".
 */
export function previewShiftOf(shift: Shift, draft: Draft): Shift {
  const earnings = PLATFORMS.flatMap((platform) => {
    const parsed = parseMoney(draft.earnings[platform])
    if (!parsed.ok || parsed.value === null) return []
    return [{ platform, amount: parsed.value }]
  })
  const sessions = shift.sessions.map((session) => {
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
    earnings,
    sessions,
  }
}

/**
 * Everything wrong with the draft as it stands, checked before either Save
 * draft or Complete Workday is let through.
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
  for (const session of shift.sessions) {
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

  for (const session of shift.sessions) {
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

/** The item's own fields — title, date, Area — changed and worth writing. */
export function itemPatchOf(item: Item, draft: Draft): Patch {
  const patch: Patch = {}
  const title = draft.title.trim()
  if (title !== '' && title !== item.title) patch.title = title
  const due = draft.due === '' ? null : draft.due
  if (due !== item.due) patch.due = due
  const area_id = draft.area_id === '' ? null : draft.area_id
  if (area_id !== item.area_id) patch.area_id = area_id
  return patch
}

/** The shift's own numbers, changed and worth writing — never a bad parse. */
export function shiftPatchOf(shift: Shift, draft: Draft): ShiftPatch {
  const patch: ShiftPatch = {}
  const maybe = (key: keyof ShiftPatch, parsed: ParsedField, current: number | null) => {
    if (parsed.ok && parsed.value !== current) patch[key] = parsed.value
  }
  maybe('odo_start', parseReading(draft.odo_start), shift.odo_start)
  maybe('odo_end', parseReading(draft.odo_end), shift.odo_end)
  maybe('personal_km', parseReading(draft.personal_km), shift.personal_km)
  maybe('tips', parseMoney(draft.tips), shift.tips)
  maybe('bonuses', parseMoney(draft.bonuses), shift.bonuses)
  maybe('parking', parseMoney(draft.parking), shift.parking)
  maybe('tolls', parseMoney(draft.tolls), shift.tolls)
  maybe('other_cost', parseMoney(draft.other_cost), shift.other_cost)
  return patch
}

/** The platforms whose typed amount changed, each ready for its own write. */
export function earningsPatchOf(
  shift: Shift,
  draft: Draft,
): { platform: Platform; amount: number }[] {
  const changed: { platform: Platform; amount: number }[] = []
  for (const platform of PLATFORMS) {
    const parsed = parseMoney(draft.earnings[platform])
    if (!parsed.ok || parsed.value === null) continue
    const already = shift.earnings.find((earning) => earning.platform === platform)?.amount
    if (parsed.value !== already) changed.push({ platform, amount: parsed.value })
  }
  return changed
}

/** The sessions whose typed break changed, each ready for its own write. */
export function breaksPatchOf(
  shift: Shift,
  draft: Draft,
): { sessionId: string; minutes: number }[] {
  const changed: { sessionId: string; minutes: number }[] = []
  for (const session of shift.sessions) {
    const parsed = parseBreak(draft.breaks[session.id] ?? '')
    if (parsed.ok && parsed.value !== session.break_minutes) {
      changed.push({ sessionId: session.id, minutes: parsed.value })
    }
  }
  return changed
}

/** Whether anything typed differs from what is saved. */
export function isDirty(item: Item, shift: Shift, draft: Draft): boolean {
  return (
    Object.keys(itemPatchOf(item, draft)).length > 0 ||
    Object.keys(shiftPatchOf(shift, draft)).length > 0 ||
    earningsPatchOf(shift, draft).length > 0 ||
    breaksPatchOf(shift, draft).length > 0
  )
}
