// The writes to Home's Quick Actions: adding a supported action, reordering
// one of them, taking one away.
//
// Declared here rather than in the hook, for the same reason journalActions
// is — except this one also needs the current list, to append after the
// highest position configured and to work out a neighbouring rank. Passed
// in rather than read from a store of its own, the same way the hook itself
// holds every other array the screens see.

import {
  createQuickAction,
  discardQuickAction,
  nextPositionOf,
  normalizeLabel,
  orderedOf,
  positionForMove,
  updateQuickAction,
} from '../repository/items'
import type { QuickAction, QuickActionKind } from '../repository/items'

export type QuickActionActions = {
  /** Adds a supported action to Home, at the end of the configured order. */
  addQuickAction: (action_key: QuickActionKind, area_id: string | null) => Promise<void>
  /** Moves this action past its neighbour in the configured order, in one
   *  write to this row alone. A no-op at either end of the list. */
  moveQuickAction: (action: QuickAction, direction: 'up' | 'down') => Promise<void>
  /**
   * Re-points a configured action at a different Area — the recovery path
   * for one whose Area was deleted, and the same capability for changing
   * your mind about it. The existing update path, not a second one: no
   * need to remove the action and guess what it was before.
   */
  setQuickActionArea: (action: QuickAction, area_id: string) => Promise<void>
  /**
   * Sets, changes or clears this action's custom display label — display
   * data only, never what a tap does. A blank or whitespace-only input
   * clears it back to the code-defined default rather than being refused.
   */
  setQuickActionLabel: (action: QuickAction, label: string) => Promise<void>
  removeQuickAction: (action: QuickAction) => Promise<void>
}

export function quickActionActions(
  owner: string,
  quickActions: readonly QuickAction[],
  write: (body: () => Promise<unknown>) => Promise<void>,
): QuickActionActions {
  return {
    // Appended, never inserted: the position after the highest one configured
    // so far, so adding a second action never has to renumber the first.
    // `nextPositionOf` refuses (null) only when no finite rank past the
    // current maximum exists — vanishingly unlikely, but a visible error is
    // still the honest answer, never a silent add at the wrong place.
    addQuickAction: (action_key, area_id) => {
      const position = nextPositionOf(quickActions)
      if (position === null) {
        return Promise.reject(
          new Error('Could not add this action right now — try again after reordering.'),
        )
      }
      return write(() => createQuickAction(owner, action_key, area_id, position))
    },

    // One version-checked write, to the moved row alone: its new position is
    // a rank between its new neighbours, so nothing beside it ever has to
    // change. There is no second write to half-succeed — a conflict here
    // leaves the list exactly as it was, not half-reordered.
    //
    // `positionForMove` returns null for two different reasons, and only one
    // of them is silent: already first or already last is the ordinary,
    // expected shape of "there is nowhere to move" — the button there is
    // already disabled, and a stray call resolves quietly. A null in the
    // middle of the list is a rank collision it could not compute a value
    // for — the button there is not disabled, so resolving quietly would be
    // exactly the fake success a visible tap must never produce. That case
    // rejects instead, with a message the screen's error banner shows.
    moveQuickAction: (action, direction) => {
      const ordered = orderedOf(quickActions)
      const index = ordered.findIndex((a) => a.id === action.id)
      const atBoundary = index === -1 || (direction === 'up' ? index === 0 : index === ordered.length - 1)
      const position = positionForMove(ordered, action.id, direction)
      if (position === null) {
        if (atBoundary) return Promise.resolve()
        return Promise.reject(
          new Error('Could not reorder right now — try moving a neighbouring action first.'),
        )
      }
      return write(() => updateQuickAction(owner, action, { position }))
    },

    setQuickActionArea: (action, area_id) =>
      write(() => updateQuickAction(owner, action, { area_id })),

    setQuickActionLabel: (action, label) =>
      write(() => updateQuickAction(owner, action, { label: normalizeLabel(label) })),

    removeQuickAction: (action) =>
      write(() => discardQuickAction(owner, action, new Date())),
  }
}
