// The atomic write behind Save draft/Complete Workday: the item's own
// title/date/Area patch and everything a shift changed beyond it — its
// numbers, its earnings (legacy and configurable-Platform alike), its
// session breaks/drops, its Vehicle link and its road-cost Expenses — as one
// Postgres transaction, so a rejected step partway through leaves nothing
// written instead of half the sequence.
//
// The item patch keeps the same protection its own separate version-checked
// write used to give it — a concurrent edit to the anchor is still refused,
// not silently overwritten — but as a single check inside this transaction
// (`expected_version`) rather than a second network round trip with its own
// retry: see `20260907100000_atomic_item_patch` for why the two writes had
// to become one to close the D1 audit's atomicity gap, and why the ordering
// (item patch before the shift row) is not incidental.

import type { Category } from './expense'
import { currentSession } from './auth'
import { SyncPending } from './not-cached'
import type { Patch } from './item'
import type { Platform, ShiftPatch } from './shift'
import { supabaseSaveWorkday } from './source'
import { syncCore } from './core'
import { syncExpenses } from './expenses'
import { syncShifts } from './shifts'

async function requireAccount(owner: string): Promise<void> {
  const session = await currentSession()
  if (session === null) {
    throw new Error('Nobody is signed in. The cache is not read.')
  }
  if (session.userId !== owner) {
    throw new Error(`The requested cache belongs to ${owner}, but the current account is another.`)
  }
}

/** What `save_workday` (the Postgres function) expects — see
 *  `20260907060000_save_workday_rpc` for exactly what each field becomes. */
export type SaveWorkdayPayload = {
  item_id: string
  /** Only ever title/due/area_id — the fields `itemPatchOf` produces. Empty
   *  means nothing on the anchor itself changed this round. */
  item_patch: Patch
  /** The item's version as this device last saw it. Checked only when
   *  `item_patch` is not empty — a stale version then aborts the whole
   *  transaction, the same refusal `writeChecked` used to give this write
   *  on its own. */
  expected_version: number
  force_shift_touch: boolean
  vehicle_unlink_ids: string[]
  vehicle_link_to: string | null
  shift_patch: ShiftPatch
  earnings_set: { platform: Platform; amount: number }[]
  earnings_remove: Platform[]
  platform_earnings_set: { platform_item_id: string; amount: number }[]
  platform_earnings_remove: string[]
  breaks_set: { session_id: string; minutes: number }[]
  sessions_remove: string[]
  road_cost_set: {
    category: Category
    title: string
    day: string
    amount: number
    existing_expense_item_id: string | null
  }[]
  road_cost_remove: { expense_item_id: string }[]
}

/**
 * One database round trip for the whole payload, then one full resync —
 * not one per write, the same shape `runStartDeliveryWork` already uses for
 * its own multi-write sequence.
 *
 * `supabaseSaveWorkday` committing and the resync afterwards are two
 * different things that can each fail on their own — the RPC is one
 * Postgres transaction, but the three reads that follow it are not part of
 * that transaction, and a dropped connection here does not undo it. A
 * failure past this point is `SyncPending`, the same soft-success shape
 * `clockOn`'s own recovery already throws: the Workday's numbers are on the
 * server, only this device could not refresh, and the shared `write()`
 * wrapper already knows to treat that as "saved", not as a reason to retry
 * the whole payload and risk a second road-cost Expense on top of the one
 * that already landed.
 */
export async function saveWorkdayAtomic(owner: string, payload: SaveWorkdayPayload): Promise<void> {
  await requireAccount(owner)
  await supabaseSaveWorkday(payload)
  try {
    await Promise.all([syncShifts(owner), syncCore(owner), syncExpenses(owner)])
  } catch (reason) {
    throw new SyncPending(payload.item_id, reason)
  }
}
