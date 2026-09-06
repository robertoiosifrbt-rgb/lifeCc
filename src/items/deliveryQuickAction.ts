// What the delivery.work Quick Action actually does, worked out from the
// day's shifts rather than assumed — the same care Today already takes
// finding "the day's shift", now also asking which Area it belongs to.
//
// Pure, and tested on its own: a wrong label here is a person told "Start"
// when they are already out, or a tap that quietly opens somebody else's day.

import type { Area } from '../repository/area'
import { treeOf } from '../repository/area'
import { isOut } from '../repository/shift'
import type { Item } from '../repository/item'
import type { Shift } from '../repository/shift'

export type DeliveryQuickActionState =
  | { kind: 'start' }
  | { kind: 'resume'; shiftId: string }
  | { kind: 'open'; shiftId: string }
  /** The configured Area is deleted, hidden under a deleted ancestor, or
   *  otherwise not in the live tree — this action cannot run until it is
   *  reconfigured, and must not be offered as though it still could. */
  | { kind: 'unavailable' }

/**
 * The shift this Quick Action means, if the day already has one.
 *
 * Matched on both day *and* the configured Area — never on the date alone,
 * which would open whichever shift happens to be due today regardless of
 * where it belongs, and never by guessing an Area from its name: the
 * configured `area_id` is the only context this action is allowed to use.
 *
 * Exported so the component can hand the same row to `runDeliveryAction`
 * without waiting on a post-write snapshot that has not necessarily arrived
 * yet — the item a freshly started shift belongs to is not this lookup's
 * job; `startDeliveryWork` already hands that one back directly.
 */
export function shiftFor(
  items: readonly Item[],
  area_id: string,
  today: string,
): Item | null {
  return (
    items.find(
      (item) =>
        item.kind === 'shift' &&
        item.due === today &&
        item.area_id === area_id &&
        item.deleted_at === null,
    ) ?? null
  )
}

/**
 * The state delivery.work is in right now, for one configured Area.
 *
 * `unavailable` first, before anything else is even asked: an Area gone
 * from the live tree (deleted, or hidden under a deleted ancestor) is not a
 * fact this action may act past, whatever the day's shifts look like.
 *
 * Past that, three states: no shift yet today in this Area, a shift with
 * nobody currently out, or a shift with an open session. Missing shift parts
 * are not "nobody is out" — that is a guess this function refuses to make.
 * A shift item can exist locally before its `shifts` row has synced, and
 * treating that gap as "safe to start a session" is exactly how two
 * sessions end up open on the same day. Unknown is handled the same as
 * "someone might already be out": expose the record, start nothing.
 */
export function deliveryStateOf(
  items: readonly Item[],
  shifts: readonly Shift[],
  areas: readonly Area[],
  area_id: string,
  today: string,
): DeliveryQuickActionState {
  const live = treeOf(areas).some((row) => row.area.id === area_id)
  if (!live) return { kind: 'unavailable' }

  const shift = shiftFor(items, area_id, today)
  if (shift === null) return { kind: 'start' }

  const parts = shifts.find((one) => one.item_id === shift.id)
  if (parts === undefined || isOut(parts)) return { kind: 'open', shiftId: shift.id }
  return { kind: 'resume', shiftId: shift.id }
}

/**
 * The label Home shows — spelled out, because Home is outside the Delivery
 * domain and a bare "Start" there does not say what it starts.
 *
 * `label` is the configured Quick Action's own custom label, or null for the
 * code-defined default below. It only ever supplies the subject a verb is
 * put in front of — which verb (Start / Resume / Open) stays entirely
 * `deliveryStateOf`'s decision, never something a label's text could steer.
 * `unavailable` is a system message about the Area itself, not a subject a
 * custom label stands in for, so it is never affected by one.
 */
export function deliveryLabel(state: DeliveryQuickActionState, label: string | null): string {
  switch (state.kind) {
    case 'start':
      return label === null ? 'Start delivery work' : `Start ${label}`
    case 'resume':
      return label === null ? 'Resume delivery work' : `Resume ${label}`
    case 'open':
      return label === null ? 'Open delivery shift' : `Open ${label}`
    case 'unavailable':
      return 'Delivery work needs an Area'
  }
}

/** The two writes a resolved state may ever call — nothing else. */
export type DeliveryQuickActionEffects = {
  startDeliveryWork: (day: string, area_id: string) => Promise<Item>
  clockOn: (item_id: string) => Promise<void>
}

/**
 * What a tap on the Quick Action does, for a state already resolved —
 * pulled out of the component that renders it so the decision can be proven
 * without a DOM: `start` calls `startDeliveryWork` and nothing else,
 * `resume` calls `clockOn` and nothing else, `open` calls neither.
 *
 * Returns the shift to open, always the definitive row rather than a lookup
 * in a snapshot that may not have caught up with the write yet: freshly
 * made, it is exactly what `startDeliveryWork` handed back; already there,
 * it is `existingItem`, found before the write ever started. `existingItem`
 * is only ever null for `start`, the one state that does not need it —
 * `deliveryStateOf` does not return `resume` or `open` without having found
 * the same row, so its absence there is a caller that skipped the lookup,
 * not a real gap.
 *
 * `unavailable` never reaches here: the component renders a link back to
 * Quick Actions for it instead of a tappable action, so there is nothing
 * for this function to run.
 */
export async function runDeliveryAction(
  state: Exclude<DeliveryQuickActionState, { kind: 'unavailable' }>,
  area_id: string,
  today: string,
  existingItem: Item | null,
  effects: DeliveryQuickActionEffects,
): Promise<Item> {
  if (state.kind === 'start') {
    return effects.startDeliveryWork(today, area_id)
  }
  // Checked before clockOn is ever called, not after: a resume with nothing
  // confirmed to resume must not start a session first and only notice the
  // problem while deciding what to open.
  if (existingItem === null) {
    throw new Error('The shift could not be found to open.')
  }
  if (state.kind === 'resume') {
    await effects.clockOn(state.shiftId)
  }
  return existingItem
}
