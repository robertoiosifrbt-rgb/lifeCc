// The finite, safe registry of Quick Actions Home is allowed to offer —
// which one a row names is data, but what each one means and whether it
// needs an Area first is fixed here, in code, once.
//
// Configuring Home never means picking a name and hoping the client knows
// what to do with it: adding a fourth action means adding a case here, in the
// database's own check constraint, and in the switch that actually runs one
// — never a row inventing a new key on its own.

import { needsArea, QUICK_ACTION_KINDS } from '../repository/items'
import type { QuickActionKind } from '../repository/items'

export type QuickActionDescriptor = {
  key: QuickActionKind
  /** Shown when adding an action to Home. */
  name: string
  /** Whether adding this action asks for an Area first. */
  needsArea: boolean
}

const NAMES: Record<QuickActionKind, string> = {
  'journal.new': 'Journal — write a line',
  'money.expense': 'Money out — log a spend',
  'delivery.work': 'Delivery work',
}

/** Every action a user may configure, in the order offered when adding one. */
export const QUICK_ACTION_REGISTRY: readonly QuickActionDescriptor[] = QUICK_ACTION_KINDS.map(
  (key) => ({ key, name: NAMES[key], needsArea: needsArea(key) }),
)
