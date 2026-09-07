// The atomic write behind Save draft/Complete Workday: everything a shift
// changed beyond its own item — its numbers, its earnings (legacy and
// configurable-Platform alike), its session breaks/drops, its Vehicle link
// and its road-cost Expenses — as one Postgres transaction, so a rejected
// step partway through leaves nothing written instead of half the sequence.
//
// The item's own title/date/Area patch is not part of this: it keeps its
// existing version-checked write (`items.ts`'s `update`), a different
// concern — concurrent edits to the anchor — from whether a Workday's own
// numbers land as one piece.

import { currentSession } from './auth'
import type { Category } from './expense'
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
 */
export async function saveWorkdayAtomic(owner: string, payload: SaveWorkdayPayload): Promise<void> {
  await requireAccount(owner)
  await supabaseSaveWorkday(payload)
  await Promise.all([syncShifts(owner), syncCore(owner), syncExpenses(owner)])
}
