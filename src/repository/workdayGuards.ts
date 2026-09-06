// Whether Complete Workday and Delete Workday are allowed, purely on session
// state — split out of shift.ts at the 300-line limit.
//
// This is only ever the session gate. It says nothing about whether the
// workday is otherwise ready to complete — dates, odometer, the cost basis,
// at least one finished session — which is `validateCompletion`'s job in
// `src/shifts/draftValidate.ts`, checked separately. A shift with no
// sessions at all passes this gate; it may still fail completion for having
// nothing to complete.

import { isOut } from './shift'
import type { Shift } from './shift'

/**
 * What Complete Workday and Delete Workday say when exactly one session is
 * still open. Stop only ever closes the one session, never the day, so that
 * has to happen first, in words, not by finishing it for you.
 */
export const STOP_SESSION_FIRST = 'Stop the active session first.'

/**
 * What every part of the sheet says when two or more sessions are open at
 * once — the known live incident this exists for. There is no "the" open
 * session to stop or drop in that state, so nothing here ever guesses one:
 * not Start (a third would only make the ambiguity worse), not Stop (there
 * is no single session to close), not the × (removing the wrong one of two
 * indistinguishable rows is not a correction, it is a coin flip on real
 * data), not Complete, not Delete. The only way out is a repair nobody here
 * performs automatically.
 */
export const MULTIPLE_OPEN_SESSIONS =
  'Multiple active sessions were found. This workday needs data repair before it can continue.'

/**
 * The one open session to show Stop for, or why there is no such thing.
 *
 * Never `.find()`-and-pick when there is more than one: that would choose
 * arbitrarily between two rows nobody can currently tell apart, and closing
 * the wrong one on real, already-ambiguous data is worse than closing none.
 */
export type SessionControls =
  | { kind: 'closed' }
  | { kind: 'one-open'; sessionId: string }
  | { kind: 'ambiguous' }

export function sessionControlsOf(shift: Shift): SessionControls {
  const open = shift.sessions.filter((session) => session.ended_at === null)
  const only = open[0]
  if (only === undefined) return { kind: 'closed' }
  if (open.length > 1) return { kind: 'ambiguous' }
  return { kind: 'one-open', sessionId: only.id }
}

/** What Complete/Delete's session hint says, or null when nothing blocks them. */
export function sessionMessageOf(shift: Shift): string | null {
  const controls = sessionControlsOf(shift)
  if (controls.kind === 'ambiguous') return MULTIPLE_OPEN_SESSIONS
  if (controls.kind === 'one-open') return STOP_SESSION_FIRST
  return null
}

/** Whether Complete Workday is allowed at all, as far as session state goes. */
export function canCompleteWorkday(shift: Shift): boolean {
  return !isOut(shift)
}

/** The session gate for Delete Workday — the same rule as Complete. */
export function canDeleteWorkday(shift: Shift): boolean {
  return !isOut(shift)
}
