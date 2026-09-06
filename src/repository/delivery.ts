// The delivery.work Quick Action's "start" state: a shift made and its
// first session already running, in one tap.
//
// Kept separate from moneyActions.ts (its only caller) so the sequence
// itself — what NotCached partway through it means, and that a session is
// never claimed started unless it really was — can be proven with injected
// effects instead of a real network. moneyActions calls this exact function
// with the real writes; there is no second copy of the decision anywhere.

import { NotCached, SyncPending } from './not-cached'
import type { Item } from './item'
import type { Shift } from './shift'

export type StartDeliveryWorkEffects = {
  createShift: (day: string, area_id: string) => Promise<Item>
  /** The exact function clockOn itself calls: ensures the shift row, starts
   *  the session, syncs once — never ensure and start each syncing on their
   *  own, which is what made this and clockOn cost three full shift-part
   *  syncs for one clock-on before. */
  startSessionSafely: (item_id: string, at: Date) => Promise<Shift[]>
}

export type StartDeliveryWorkResult = {
  item: Item
  /** True when either half of the sequence reported that the write reached
   *  the server but this device could not keep or refresh its own copy —
   *  `createShift` throwing NotCached, or `startSessionSafely` throwing
   *  SyncPending. Either way the session genuinely started, on the right
   *  row; the caller decides what to do about the missing local copy, the
   *  same way for both. */
  recovered: boolean
}

/**
 * A shift made and started, as one sequence: create it, make sure its
 * `shifts` row exists, then start the first session.
 *
 * `createShift` can succeed on the server and still throw NotCached. Letting
 * that stop the sequence here would report a shift that was never actually
 * started — the one thing this action must not do. The error always carries
 * the item it failed to cache, so the sequence keeps going on the real row
 * instead of guessing at one.
 *
 * `startSessionSafely` can likewise succeed — the session is committed — and
 * still throw SyncPending, when only the sync that follows it did not reach
 * this device. That is not a failed clock-on either: the row exists, and a
 * caller told otherwise would be handed no way to open it that does not
 * start a second session. Any other failure — from `createShift` or from
 * `startSessionSafely` for a real reason — is not caught here, and stops the
 * sequence: a session is never claimed started unless it really was.
 */
export async function runStartDeliveryWork(
  day: string,
  area_id: string,
  now: Date,
  effects: StartDeliveryWorkEffects,
): Promise<StartDeliveryWorkResult> {
  let item: Item
  let recovered = false
  try {
    item = await effects.createShift(day, area_id)
  } catch (error) {
    if (!(error instanceof NotCached)) throw error
    item = error.item
    recovered = true
  }
  try {
    await effects.startSessionSafely(item.id, now)
  } catch (error) {
    if (!(error instanceof SyncPending)) throw error
    recovered = true
  }
  return { item, recovered }
}
