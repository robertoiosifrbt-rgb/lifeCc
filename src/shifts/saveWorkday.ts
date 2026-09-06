// Save draft and Complete Workday's one shared sequence: write every field
// that changed, in the order that keeps the database's own rules honest, and
// settle the draft on the result. Its own file so the write order — and the
// reason for it — can be tested with injected writers, the same way
// `runSessionRecovery`/`runStartSessionSafely` already are for clocking on.

import type { Entity, Item, Link, LinkKind, Patch, Platform, Shift, ShiftPatch } from '../repository/items'
import type { Draft } from './draft'
import {
  breaksPatchOf,
  earningsPatchOf,
  earningsToRemoveOf,
  itemPatchOf,
  sessionsToRemoveOf,
  shiftPatchOf,
  vehicleLinkPatchOf,
} from './draftPatches'

export type WorkdayWriters = {
  onUpdateItem: (patch: Patch) => Promise<void>
  onSaveShiftParts: (patch: ShiftPatch) => Promise<void>
  onSetPaid: (platform: Platform, amount: number) => Promise<void>
  onRemoveEarning: (platform: Platform) => Promise<void>
  onSetBreak: (sessionId: string, minutes: number) => Promise<void>
  onDropSession: (sessionId: string) => Promise<void>
  onLink: (to_id: string, kind: LinkKind) => Promise<void>
  onUnlink: (id: string) => Promise<void>
}

/**
 * Writes every field the draft changed, then hands back an item and a shift
 * that reflect exactly what was just written — so the caller can settle a
 * fresh draft on the result without waiting for the next full sync.
 *
 * The item is written first, always — even when nothing about it changed.
 * The Vehicle link, in turn, is written before the `shifts` row itself: a
 * Draft's cost basis (fuel and vehicle wear alike) is re-derived at the
 * moment that row is written, and the database's pin trigger resolves "the"
 * Vehicle by joining `links` for this shift's item — never by its Area, which
 * the trigger no longer reads at all. A changed Vehicle link has to have
 * already landed before that write, or the pin still resolves against the
 * old one.
 *
 * `forceShiftTouch` is for Complete Workday alone: a shift with nothing
 * operational typed this round would otherwise never issue a write to
 * `shifts` at all, and a row never written is a row the pin trigger never
 * runs on — a Workday could complete with its cost basis still unpinned for
 * no reason but that no other field happened to change first. An upsert with
 * no patched columns still runs that trigger.
 */
export async function saveWorkday(
  item: Item,
  shift: Shift,
  draft: Draft,
  links: readonly Link[],
  entities: readonly Entity[],
  writers: WorkdayWriters,
  opts: { forceShiftTouch?: boolean } = {},
): Promise<{ item: Item; shift: Shift }> {
  const itemPatch = itemPatchOf(item, draft)
  const vehiclePatch = vehicleLinkPatchOf(links, entities, item.id, draft)
  const shiftPatch = shiftPatchOf(shift, draft)
  const earningsPatch = earningsPatchOf(shift, draft)
  const earningsRemoved = earningsToRemoveOf(shift, draft)
  const breaksPatch = breaksPatchOf(shift, draft)
  // Defensive, not just the sheet's own promise: a still-open session named
  // here would be malformed draft data, and it is never deleted regardless.
  const sessionsRemoved = sessionsToRemoveOf(shift, draft)

  if (Object.keys(itemPatch).length > 0) await writers.onUpdateItem(itemPatch)

  // Before the shift row itself: the pin trigger resolves "the" Vehicle by
  // joining `links` at the moment that row is written, the same reason a
  // changed Area already has to land on the anchor first.
  if (vehiclePatch !== null) {
    for (const linkId of vehiclePatch.toUnlink) await writers.onUnlink(linkId)
    if (vehiclePatch.toLinkVehicleId !== null) await writers.onLink(vehiclePatch.toLinkVehicleId, 'uses')
  }

  if (Object.keys(shiftPatch).length > 0) {
    await writers.onSaveShiftParts(shiftPatch)
  } else if (opts.forceShiftTouch === true) {
    await writers.onSaveShiftParts({})
  }

  for (const { platform, amount } of earningsPatch) await writers.onSetPaid(platform, amount)
  for (const platform of earningsRemoved) await writers.onRemoveEarning(platform)
  for (const { sessionId, minutes } of breaksPatch) await writers.onSetBreak(sessionId, minutes)
  for (const sessionId of sessionsRemoved) await writers.onDropSession(sessionId)

  const nextItem: Item = { ...item, ...itemPatch }
  const nextShift: Shift = {
    ...shift,
    ...shiftPatch,
    earnings: shift.earnings
      .filter((earning) => !earningsPatch.some((changed) => changed.platform === earning.platform))
      .filter((earning) => earning.platform === null || !earningsRemoved.includes(earning.platform))
      .concat(earningsPatch.map((changed) => ({ ...changed, id: '', platform_item_id: null }))),
    sessions: shift.sessions
      .filter((session) => !sessionsRemoved.includes(session.id))
      .map((session) => {
        const changed = breaksPatch.find((entry) => entry.sessionId === session.id)
        return changed === undefined ? session : { ...session, break_minutes: changed.minutes }
      }),
  }
  return { item: nextItem, shift: nextShift }
}
