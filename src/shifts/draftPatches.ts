// What Save draft actually writes, and whether there is anything to write at
// all — split out of `draft.ts` at the 300-line limit.
//
// Every function here answers the same shape of question: of everything the
// draft holds, what part of it differs from what is already saved? Each
// patch is only ever the changed part, on purpose — a patch that resent
// everything would overwrite a field changed from another device in the time
// this sheet has been open.

import type { Entity, Item, Link, Patch, Platform, Shift, ShiftPatch } from '../repository/items'
import { PLATFORMS, vehicleLinkIdsOf } from '../repository/items'
import type { Draft, ParsedField } from './draft'
import { parseBreak, parseMoney, parseReading } from './draft'

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

/**
 * The Vehicle link change worth writing, or null when the draft still
 * matches whatever is actually linked.
 *
 * "Set" is always "replace every existing Vehicle link with this one" — the
 * same choice `onChangeVehicle` in the header already commits to — so an
 * ambiguous starting state (two stale links) is resolved the moment a single
 * Vehicle is chosen and saved, never left to guess which of the old ones to
 * keep.
 */
export type VehicleLinkPatch = { toUnlink: string[]; toLinkVehicleId: string | null }

export function vehicleLinkPatchOf(
  links: readonly Link[],
  entities: readonly Entity[],
  itemId: string,
  draft: Draft,
): VehicleLinkPatch | null {
  const current = vehicleLinkIdsOf(links, entities, itemId, 'uses')
  const wanted = draft.vehicle_item_id === '' ? null : draft.vehicle_item_id

  if (wanted !== null) {
    const currentSingle = current.length === 1 ? links.find((l) => l.id === current[0]) : undefined
    if (currentSingle?.to_id === wanted) return null
    return { toUnlink: current, toLinkVehicleId: wanted }
  }

  // The draft names no Vehicle. Only a real "clear it" instruction when
  // there was exactly one linked to clear — a blank draft next to zero, or
  // next to an ambiguous pair, changes nothing: an untouched, still-ambiguous
  // state must never be resolved by the side effect of an unrelated Save
  // draft. Ambiguity is only ever resolved by picking one concrete Vehicle,
  // the branch above.
  if (current.length === 1) return { toUnlink: current, toLinkVehicleId: null }
  return null
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

/**
 * The platforms a saved amount was cleared from — blank, not zero — each
 * ready for an actual removal.
 *
 * `earningsPatchOf` only ever writes a value that parsed to a real number, so
 * clearing a box to blank was previously invisible to Save draft: the field
 * looked empty but the old amount was still sitting there unchanged, ready to
 * reappear the moment the sheet reopened. This is what tells Save draft the
 * difference between "not yet said" and "said, then taken back".
 */
export function earningsToRemoveOf(shift: Shift, draft: Draft): Platform[] {
  const removed: Platform[] = []
  for (const platform of PLATFORMS) {
    const parsed = parseMoney(draft.earnings[platform])
    if (!parsed.ok || parsed.value !== null) continue
    const already = shift.earnings.some((earning) => earning.platform === platform)
    if (already) removed.push(platform)
  }
  return removed
}

/** The sessions whose typed break changed, each ready for its own write. */
export function breaksPatchOf(
  shift: Shift,
  draft: Draft,
): { sessionId: string; minutes: number }[] {
  const removed = sessionsToRemoveOf(shift, draft)
  const changed: { sessionId: string; minutes: number }[] = []
  for (const session of shift.sessions) {
    if (removed.includes(session.id)) continue
    const parsed = parseBreak(draft.breaks[session.id] ?? '')
    if (parsed.ok && parsed.value !== session.break_minutes) {
      changed.push({ sessionId: session.id, minutes: parsed.value })
    }
  }
  return changed
}

/**
 * The sessions actually worth deleting: marked for removal in the draft, and
 * already ended.
 *
 * The one place this is decided, deliberately narrower than "whatever the
 * draft says": the sheet never offers a × on an open session in the first
 * place, but a write must not trust that it was reached only through the
 * sheet. A still-open session named in `removedSessions` — malformed draft
 * data, not a real request — is silently dropped here rather than deleted; a
 * real event still in progress is Stop's to end, never a delete's.
 */
export function sessionsToRemoveOf(shift: Shift, draft: Draft): string[] {
  return draft.removedSessions.filter((id) =>
    shift.sessions.some((session) => session.id === id && session.ended_at !== null),
  )
}

/** Whether anything typed, cleared or marked for removal differs from what is saved. */
export function isDirty(
  item: Item,
  shift: Shift,
  draft: Draft,
  links: readonly Link[],
  entities: readonly Entity[],
): boolean {
  return (
    Object.keys(itemPatchOf(item, draft)).length > 0 ||
    Object.keys(shiftPatchOf(shift, draft)).length > 0 ||
    earningsPatchOf(shift, draft).length > 0 ||
    earningsToRemoveOf(shift, draft).length > 0 ||
    breaksPatchOf(shift, draft).length > 0 ||
    sessionsToRemoveOf(shift, draft).length > 0 ||
    vehicleLinkPatchOf(links, entities, item.id, draft) !== null
  )
}
