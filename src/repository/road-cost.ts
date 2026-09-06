// Road-cost fields (parking/tolls/other_cost), split out of shift.ts at the
// 300-line limit — the same split every other 300-line file in this
// codebase already gets.

import type { Expense } from './expense'
import type { Link } from './link'
import type { Shift } from './shift'

/**
 * The three road-cost fields, each keyed to its own Expense category — never
 * written to `shifts.parking`/`tolls`/`other_cost` any more (see
 * `withRoadCostExpenses` below for why those columns still exist and are
 * still read).
 */
export const ROAD_COST_FIELDS = {
  parking: 'parking',
  tolls: 'tolls',
  other_cost: 'other',
} as const
export type RoadCostField = keyof typeof ROAD_COST_FIELDS

/**
 * The Expense, if any, an `about` link ties to this shift for one road-cost
 * category — never more than one is expected, the same "resolved, not
 * assumed" shape every other Vehicle/link lookup in this codebase already
 * uses. More than one existing (only possible through direct database
 * tampering, never through this app's own writes) is read as the first
 * found rather than guessed between, since there is no "current" concept
 * for a plain Expense the way there is for a rate.
 */
export function roadCostExpenseOf(
  links: readonly Link[],
  expenses: readonly Expense[],
  shiftItemId: string,
  category: Expense['category'],
): Expense | null {
  for (const l of links) {
    if (l.kind !== 'about' || l.to_id !== shiftItemId) continue
    const expense = expenses.find((e) => e.item_id === l.from_id && e.category === category)
    if (expense !== undefined) return expense
  }
  return null
}

/**
 * Shifts with each road-cost field replaced by its linked Expense's amount,
 * when one exists — the one place this merge happens, so every reader
 * downstream (`takeHome`, every screen, every weekly/monthly total) sees the
 * same effective number without knowing an Expense is involved at all.
 *
 * A Workday whose field has never been touched since road costs moved to
 * Expense keeps showing whatever `shifts.parking`/`tolls`/`other_cost`
 * already held — real figures from before this change, on live data, that
 * nothing here may guess into a fabricated Expense. The moment a real
 * Expense exists for that category, it wins outright; the legacy column is
 * never read again for that field, and never written to either.
 */
export function withRoadCostExpenses(
  shifts: readonly Shift[],
  expenses: readonly Expense[],
  links: readonly Link[],
): Shift[] {
  return shifts.map((shift) => {
    const patch: Partial<Shift> = {}
    for (const [field, category] of Object.entries(ROAD_COST_FIELDS) as [RoadCostField, Expense['category']][]) {
      const linked = roadCostExpenseOf(links, expenses, shift.item_id, category)
      if (linked !== null) patch[field] = linked.amount
    }
    return Object.keys(patch).length === 0 ? shift : { ...shift, ...patch }
  })
}
