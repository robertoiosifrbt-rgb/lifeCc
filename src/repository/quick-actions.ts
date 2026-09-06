// The Quick Actions, as the screens ask for them.
//
// Separate from items.ts because they are a separate table with a cursor of
// its own, not because they are a separate layer: the rule still holds, the
// UI never sees Supabase.

import { currentSession } from './auth'
import { fromRow } from './quick-action'
import type { QuickAction, QuickActionKind, QuickActionPatch } from './quick-action'
import { supabaseWriter } from './source'
import { quickActionStore } from './store'
import { writeChecked } from './write'

const QUICK_ACTIONS = 'quick_actions'

async function requireAccount(owner: string): Promise<void> {
  const session = await currentSession()
  if (session === null) {
    throw new Error('Nobody is signed in. The cache is not read.')
  }
  if (session.userId !== owner) {
    throw new Error('The requested cache belongs to another account.')
  }
}

/** Everything cached for this account, deleted rows included. */
export async function quickActionsOf(owner: string): Promise<QuickAction[]> {
  await requireAccount(owner)
  return quickActionStore.readAll(owner)
}

/**
 * Adding a supported action to Home. Refused by the database if this action
 * is already configured, or if the Area a `needsArea` action requires is
 * missing — a second opinion here would be a second place for the same rule.
 */
export async function createQuickAction(
  owner: string,
  action_key: QuickActionKind,
  area_id: string | null,
  position: number,
): Promise<QuickAction> {
  await requireAccount(owner)
  const writer = supabaseWriter<QuickActionPatch & { action_key: QuickActionKind }>(
    QUICK_ACTIONS,
    owner,
  )
  return cache(owner, fromRow(await writer.insert({ action_key, area_id, position })))
}

/** Reordering or re-hanging an action's Area, with the same version check items get. */
export async function updateQuickAction(
  owner: string,
  action: QuickAction,
  patch: QuickActionPatch,
): Promise<QuickAction> {
  await requireAccount(owner)
  const writer = supabaseWriter<QuickActionPatch>(QUICK_ACTIONS, owner)
  return cache(owner, await writeChecked(writer, action, patch, fromRow))
}

/** Removing is an UPDATE on deleted_at, as everywhere else. */
export function discardQuickAction(
  owner: string,
  action: QuickAction,
  now: Date,
): Promise<QuickAction> {
  return updateQuickAction(owner, action, { deleted_at: now.toISOString() })
}

async function cache(owner: string, action: QuickAction): Promise<QuickAction> {
  // The cursor does not move: this row comes back on the next delta anyway,
  // and a cursor moved on one write can skip what somebody else wrote.
  await quickActionStore.upsert(owner, [action], null)
  return action
}
