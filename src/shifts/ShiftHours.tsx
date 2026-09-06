import { MULTIPLE_OPEN_SESSIONS, sessionControlsOf } from '../repository/items'
import type { Shift } from '../repository/items'
import { clock } from './money'

type Props = {
  shift: Shift
  busy: boolean
  readOnly: boolean
  breaks: Record<string, string>
  /** Sessions marked to go this round — hidden here, gone once Save draft runs. */
  removedSessions: string[]
  onChangeBreak: (sessionId: string, typed: string) => void
  /** Marks a session for removal in the draft — not a write on its own. */
  onRemoveSession: (sessionId: string) => void
  onClockOn: () => Promise<void>
  onClockOff: (sessionId: string) => Promise<void>
  onRun: (body: () => Promise<void>) => void
}

/**
 * The clock: every stint of the day, its break, and the one button that either
 * starts a stint or stops the one running.
 *
 * Start and Stop write immediately — they are real events, not a form field —
 * so they are the one part of this sheet that is never held back for Save
 * draft. Everything else here, break included, is typed like the rest of the
 * form and only takes effect when the draft is saved — removing a session
 * included: the × marks it gone in the draft, Save draft is what deletes it.
 *
 * The × only ever appears on a session that has already ended. An open
 * session is a real event still in progress — Stop is what ends it, not a
 * delete — so removing one is never offered, not even as a draft-only mark.
 *
 * Start/Stop read `sessionControlsOf`, over the shift's real, unfiltered
 * sessions: a session marked for removal but not yet saved must not be able
 * to make this look more finished than it is, and two or more open sessions
 * — the known live incident — must never let this pick one of them to guess
 * is "the" session to stop.
 */
export function ShiftHours(props: Props) {
  const { shift, busy, readOnly } = props
  const run = props.onRun
  const controls = sessionControlsOf(shift)
  // Defensive, same reasoning as the preview: a still-open session named in
  // `removedSessions` would be malformed draft data, never hidden as if it
  // were already gone.
  const visible = shift.sessions.filter(
    (session) => !props.removedSessions.includes(session.id) || session.ended_at === null,
  )

  return (
    <section className="shift-block">
      <h3 className="shift-heading">Hours</h3>
      <ul className="shift-sessions">
        {visible.map((session) => (
          <li key={session.id} className="shift-session">
            <span className="shift-when">
              {clock(session.started_at)} —{' '}
              {session.ended_at === null ? 'now' : clock(session.ended_at)}
            </span>
            <label className="shift-break">
              <span className="shift-break-label">Break</span>
              <input
                className="shift-break-input"
                name={`break-${session.id}`}
                inputMode="numeric"
                value={props.breaks[session.id] ?? ''}
                disabled={busy || readOnly}
                aria-label={`Break in minutes, in the session starting at ${clock(session.started_at)}`}
                onChange={(event) => props.onChangeBreak(session.id, event.target.value)}
              />
              <span className="shift-break-unit">min</span>
            </label>
            {!readOnly && session.ended_at !== null && (
              <button
                type="button"
                name="drop-session"
                className="shift-drop"
                disabled={busy}
                aria-label={`Remove the session that started at ${clock(session.started_at)}`}
                onClick={() => props.onRemoveSession(session.id)}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>

      {!readOnly && controls.kind === 'closed' && (
        <button
          type="button"
          name="clock-on"
          className="shift-clock"
          disabled={busy}
          onClick={() => run(props.onClockOn)}
        >
          Start
        </button>
      )}

      {!readOnly && controls.kind === 'one-open' && (
        <button
          type="button"
          name="clock-off"
          className="shift-clock shift-clock-off"
          disabled={busy}
          onClick={() => run(() => props.onClockOff(controls.sessionId))}
        >
          Stop
        </button>
      )}

      {controls.kind === 'ambiguous' && <p className="shift-error">{MULTIPLE_OPEN_SESSIONS}</p>}
    </section>
  )
}
