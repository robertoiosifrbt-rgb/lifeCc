// The shape of a Quick Action: which safe action it names, its place among
// the others, and the Area context the action needs, if it needs one.
//
// The field names are the column names, like everywhere else in the
// repository. A second vocabulary for the same thing is a place for mistakes
// to hide.

import { asRecord, optionalNumber, optionalText, requiredText, stampsOf } from './row'
import type { Row } from './row'

/**
 * The finite, safe registry of actions the client will ever run for a Quick
 * Action row.
 *
 * A row's `action_key` only ever names one of these — it is never code, SQL
 * or an expression. Adding a fourth action means adding a case in code and a
 * value here and in the database's own check constraint together; it is not
 * something a row can invent on its own.
 */
export const QUICK_ACTION_KINDS = ['journal.new', 'money.expense', 'delivery.work'] as const
export type QuickActionKind = (typeof QUICK_ACTION_KINDS)[number]

/** Whether this action needs an Area chosen before it can run. */
export function needsArea(kind: QuickActionKind): boolean {
  return kind === 'delivery.work'
}

export type QuickAction = Row & {
  action_key: QuickActionKind
  /** Required exactly when `needsArea(action_key)`, null otherwise. */
  area_id: string | null
  /** Where it sits among the others. Lower comes first. */
  position: number
  /** A custom display name, or null to use the code-defined default for
   *  `action_key`. Display data only — it never changes what a tap does. */
  label: string | null
}

/**
 * What a client is allowed to change.
 *
 * `action_key` is absent on purpose: what an action row means is fixed at
 * creation, the same way an item's kind never changes once it leaves the
 * inbox. Changing which action a row runs is removing it and adding the one
 * you meant, not editing this one in place.
 */
export type QuickActionPatch = Partial<
  Pick<QuickAction, 'area_id' | 'position' | 'deleted_at' | 'label'>
>

/**
 * A custom label as typed, turned into what gets stored.
 *
 * Blank or whitespace-only is not a mistake to refuse — it is how a person
 * clears the field back to the code-defined default — so this never throws;
 * it normalizes instead. Anything else is trimmed, the same shape the
 * database's own check constraint expects back.
 */
export function normalizeLabel(input: string): string | null {
  const trimmed = input.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * A row, checked exactly as the database checks it.
 *
 * The same function decides whether a cached row is worth keeping, so a check
 * that lets a broken row through declares the cache good, the rebuild never
 * runs, and an unknown action_key goes on to reach the registry switch
 * somewhere far from here — which is exactly the row this function exists to
 * stop before that happens.
 */
export function fromRow(row: unknown): QuickAction {
  const raw = asRecord(row)

  const action_key = requiredText(raw, 'action_key')
  if (!(QUICK_ACTION_KINDS as readonly string[]).includes(action_key)) {
    throw new Error(`Unknown quick action: ${action_key}`)
  }
  const kind = action_key as QuickActionKind

  const area_id = optionalText(raw, 'area_id')
  if (needsArea(kind) && area_id === null) {
    throw new Error(`${kind} without its Area`)
  }
  if (!needsArea(kind) && area_id !== null) {
    throw new Error(`${kind} does not take an Area`)
  }

  const position = optionalNumber(raw, 'position')
  if (position === null) throw new Error('Row without position')
  if (!Number.isFinite(position)) throw new Error('Row with a non-finite position')

  const label = optionalText(raw, 'label')
  if (label !== null && label.trim() === '') {
    throw new Error('Row with a blank label')
  }

  return {
    id: requiredText(raw, 'id'),
    owner: requiredText(raw, 'owner'),
    action_key: kind,
    area_id,
    position,
    label,
    ...stampsOf(raw),
  }
}

/**
 * The configured actions, alive, in the order the person chose.
 *
 * One place for "what Home actually shows", the same reason `treeOf` exists
 * for areas: the ordering and the filtering are asked for from more than one
 * screen, and two ways of asking is how they drift apart.
 *
 * Sorted by position, `id` breaking a tie — never left to array input order
 * or a cache's own row order. Two positions can collide for a real reason:
 * two devices each appending from the same stale snapshot both compute the
 * same "one past the highest configured so far". Without an explicit
 * tie-breaker, that collision would make Home's order depend on whichever
 * order the rows happen to arrive in on a given device — the same list,
 * shown two different ways on two phones.
 */
export function orderedOf(actions: readonly QuickAction[]): QuickAction[] {
  return actions
    .filter((action) => action.deleted_at === null)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
}

/**
 * Where a newly added action goes: after the last one configured so far, or
 * null if no finite rank strictly after it can be produced.
 *
 * The same failure `positionForMove`'s edge moves already guard against: for
 * a sufficiently large finite double, `value + 1 === value`, so a plain "+1"
 * can silently fail to move past the current maximum and instead land right
 * on top of it — a second row at the same rank, sorted only by `orderedOf`'s
 * id tie-break rather than genuinely appended last. Refusing is the honest
 * answer here too, the same as everywhere else this file computes a rank.
 */
export function nextPositionOf(actions: readonly QuickAction[]): number | null {
  const highest = actions.reduce((max, a) => Math.max(max, a.position), -1)
  return above(highest)
}

/**
 * The one new position a move needs — never a second row to touch.
 *
 * A swap of two rows' positions is two version-checked writes, and one of
 * them can fail while the other already landed. This asks instead for a rank
 * that sits between the moved row's new neighbours, so only the moved row's
 * own position ever changes; whatever was on either side of it keeps the
 * value it already had. `null` means there is nowhere to move — already
 * first, already last, not found at all, or the two rows the moved one would
 * need to land between already share a position.
 *
 * That last case is a real one, not a theoretical one: two devices can each
 * append from the same stale snapshot and land on the same rank. When it
 * happens, a midpoint between two equal values is that same value again —
 * indistinguishable from the row already sitting there, so the move would
 * write a "new" position that leaves `orderedOf`'s tie-break (by `id`) to
 * decide whether anything visibly moved at all. Refusing is the honest
 * answer: this function never claims a move happened when the ranks it had
 * to work with could not actually express one. `ordered` should already be
 * `orderedOf`'s own output, so a caller sees the same tie-broken order this
 * decides against — one first move elsewhere breaks the collision and this
 * stops refusing on its own, without any rebalancing of its own.
 *
 * Two ranks that are not equal can still fail to have a midpoint: IEEE 754
 * double precision can round `(low + high) / 2` to exactly one of its two
 * inputs even when `low !== high`, once they are close enough together.
 * Refusing on exact equality alone would let that case through as a
 * "successful" move that actually lands on top of a neighbour it was never
 * supposed to collide with — so every candidate is checked for being finite
 * and strictly between the ranks it was computed from, not just distinct
 * from them.
 */
function strictMidpoint(low: number, high: number): number | null {
  const mid = (low + high) / 2
  if (!Number.isFinite(mid) || mid <= low || mid >= high) return null
  return mid
}

function below(target: number): number | null {
  const value = target - 1
  return Number.isFinite(value) && value < target ? value : null
}

function above(target: number): number | null {
  const value = target + 1
  return Number.isFinite(value) && value > target ? value : null
}

export function positionForMove(
  ordered: readonly QuickAction[],
  id: string,
  direction: 'up' | 'down',
): number | null {
  const index = ordered.findIndex((a) => a.id === id)
  if (index === -1) return null

  if (direction === 'up') {
    if (index === 0) return null
    const target = ordered[index - 1]!
    const before = ordered[index - 2]
    return before === undefined ? below(target.position) : strictMidpoint(before.position, target.position)
  }

  if (index === ordered.length - 1) return null
  const target = ordered[index + 1]!
  const after = ordered[index + 2]
  return after === undefined ? above(target.position) : strictMidpoint(target.position, after.position)
}
