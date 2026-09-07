// Save draft and Complete Workday's one shared sequence: write every field
// that changed, in the order that keeps the database's own rules honest, and
// settle the draft on the result. Its own file so the write order — and the
// reason for it — can be tested with injected writers, the same way
// `runSessionRecovery`/`runStartSessionSafely` already are for clocking on.

import type {
  Entity,
  Expense,
  Item,
  Link,
  RoadCostField,
  SaveWorkdayPayload,
  Shift,
} from '../repository/items'
import { CATEGORY_NAMES, ROAD_COST_FIELDS } from '../repository/items'
import type { Draft } from './draft'
import {
  breaksPatchOf,
  earningsPatchOf,
  earningsToRemoveOf,
  itemPatchOf,
  platformEarningsPatchOf,
  platformEarningsToRemoveOf,
  roadCostPatchOf,
  roadCostsToRemoveOf,
  sessionsToRemoveOf,
  shiftPatchOf,
  vehicleLinkPatchOf,
} from './draftPatches'

export type WorkdayWriters = {
  /** Everything the sheet changed, in one transaction — the item's own
   *  title/date/Area patch included. See `SaveWorkdayPayload`/`save_workday`
   *  for what each field becomes. */
  onCommit: (payload: SaveWorkdayPayload) => Promise<void>
}

/**
 * Writes every field the draft changed, then hands back an item and a shift
 * that reflect exactly what was just written — so the caller can settle a
 * fresh draft on the result without waiting for the next full sync.
 *
 * The item's own patch (title/date/Area) rides inside the same `onCommit`
 * transaction as everything else now, not a separate call ahead of it: a
 * separate call meant a rejected commit could still leave the title or date
 * changed with nothing else that was typed alongside it — a Workday saved
 * in two torn pieces, which is exactly what "Save draft" must never be. The
 * RPC itself still applies the item patch before the shift row: a Draft's
 * cost basis (fuel and vehicle wear alike) is re-derived the moment the
 * `shifts` row is written, by a database trigger that resolves "the" Vehicle
 * by joining `links` and reads the day off `items.due` — so a changed date
 * has to have already landed by then, same as a changed Vehicle link.
 * `expected_version` keeps the same protection the old separate call gave a
 * concurrent edit to the anchor, just as a check inside this one transaction
 * instead of a second round trip.
 *
 * `forceShiftTouch` is for Complete Workday alone: a shift with nothing
 * operational typed this round would otherwise never issue a write to
 * `shifts` at all, and a row never written is a row the pin trigger never
 * runs on — a Workday could complete with its cost basis still unpinned for
 * no reason but that no other field happened to change first. A commit with
 * an empty shift patch still runs that trigger, once `forceShiftTouch` says so.
 *
 * The returned `links` reflect the same Vehicle change, for the same reason:
 * the caller's own `links` prop is whatever arrived before this save ran, and
 * will not show the new link until the next full resync — reseeding a draft
 * from that stale array right after a successful save would flash the
 * Vehicle picker back to what it used to point at. Every other field the
 * sheet can save has nowhere else to read from and needed no such fix.
 */
export async function saveWorkday(
  item: Item,
  shift: Shift,
  draft: Draft,
  links: readonly Link[],
  entities: readonly Entity[],
  expenses: readonly Expense[],
  writers: WorkdayWriters,
  opts: { forceShiftTouch?: boolean } = {},
): Promise<{ item: Item; shift: Shift; links: Link[] }> {
  const itemPatch = itemPatchOf(item, draft)
  const vehiclePatch = vehicleLinkPatchOf(links, entities, item.id, draft)
  const shiftPatch = shiftPatchOf(shift, draft)
  const earningsPatch = earningsPatchOf(shift, draft)
  const earningsRemoved = earningsToRemoveOf(shift, draft)
  const platformEarningsPatch = platformEarningsPatchOf(shift, draft)
  const platformEarningsRemoved = platformEarningsToRemoveOf(shift, draft)
  const breaksPatch = breaksPatchOf(shift, draft)
  const roadCostPatch = roadCostPatchOf(shift, draft, expenses, links)
  const roadCostsRemoved = roadCostsToRemoveOf(shift, draft, expenses, links)
  // Defensive, not just the sheet's own promise: a still-open session named
  // here would be malformed draft data, and it is never deleted regardless.
  const sessionsRemoved = sessionsToRemoveOf(shift, draft)

  const forceShiftTouch = opts.forceShiftTouch === true
  const hasCommit =
    Object.keys(itemPatch).length > 0 ||
    vehiclePatch !== null ||
    Object.keys(shiftPatch).length > 0 ||
    earningsPatch.length > 0 ||
    earningsRemoved.length > 0 ||
    platformEarningsPatch.length > 0 ||
    platformEarningsRemoved.length > 0 ||
    breaksPatch.length > 0 ||
    sessionsRemoved.length > 0 ||
    roadCostPatch.length > 0 ||
    roadCostsRemoved.length > 0 ||
    forceShiftTouch

  if (hasCommit) {
    const day = draft.due !== '' ? draft.due : item.due ?? ''
    await writers.onCommit({
      item_id: item.id,
      item_patch: itemPatch,
      expected_version: item.version,
      force_shift_touch: forceShiftTouch,
      vehicle_unlink_ids: vehiclePatch?.toUnlink ?? [],
      vehicle_link_to: vehiclePatch?.toLinkVehicleId ?? null,
      shift_patch: shiftPatch,
      earnings_set: earningsPatch,
      earnings_remove: earningsRemoved,
      platform_earnings_set: platformEarningsPatch,
      platform_earnings_remove: platformEarningsRemoved,
      breaks_set: breaksPatch.map(({ sessionId, minutes }) => ({ session_id: sessionId, minutes })),
      sessions_remove: sessionsRemoved,
      road_cost_set: roadCostPatch.map(({ field, amount, existingExpenseItemId }) => ({
        category: ROAD_COST_FIELDS[field],
        title: CATEGORY_NAMES[ROAD_COST_FIELDS[field]],
        day,
        amount,
        existing_expense_item_id: existingExpenseItemId,
      })),
      road_cost_remove: roadCostsRemoved.map(({ expenseItemId }) => ({ expense_item_id: expenseItemId })),
    })
  }

  const nextItem: Item = { ...item, ...itemPatch }
  const roadCostPatchByField: Partial<Record<RoadCostField, number | null>> = {}
  for (const { field } of roadCostsRemoved) roadCostPatchByField[field] = null
  for (const { field, amount } of roadCostPatch) roadCostPatchByField[field] = amount
  const nextShift: Shift = {
    ...shift,
    ...shiftPatch,
    ...roadCostPatchByField,
    earnings: shift.earnings
      .filter((earning) => !earningsPatch.some((changed) => changed.platform === earning.platform))
      .filter((earning) => earning.platform === null || !earningsRemoved.includes(earning.platform))
      .filter((earning) =>
        !platformEarningsPatch.some((changed) => changed.platform_item_id === earning.platform_item_id),
      )
      .filter(
        (earning) =>
          earning.platform_item_id === null || !platformEarningsRemoved.includes(earning.platform_item_id),
      )
      .concat(earningsPatch.map((changed) => ({ ...changed, id: '', platform_item_id: null })))
      .concat(platformEarningsPatch.map((changed) => ({ ...changed, id: '', platform: null }))),
    sessions: shift.sessions
      .filter((session) => !sessionsRemoved.includes(session.id))
      .map((session) => {
        const changed = breaksPatch.find((entry) => entry.sessionId === session.id)
        return changed === undefined ? session : { ...session, break_minutes: changed.minutes }
      }),
  }
  const nextLinks: Link[] =
    vehiclePatch === null
      ? [...links]
      : [
          ...links.filter((link) => !vehiclePatch.toUnlink.includes(link.id)),
          ...(vehiclePatch.toLinkVehicleId === null
            ? []
            : [
                {
                  id: '',
                  owner: item.owner,
                  from_id: item.id,
                  to_id: vehiclePatch.toLinkVehicleId,
                  kind: 'uses' as const,
                  created_at: new Date().toISOString(),
                },
              ]),
        ]
  return { item: nextItem, shift: nextShift, links: nextLinks }
}
