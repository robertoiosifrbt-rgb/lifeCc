import { isOut } from '../repository/items'
import type { Shift } from '../repository/items'
import { clock } from './money'

type Props = {
  shift: Shift
  busy: boolean
  readOnly: boolean
  breaks: Record<string, string>
  onChangeBreak: (sessionId: string, typed: string) => void
  onClockOn: () => Promise<void>
  onClockOff: (sessionId: string) => Promise<void>
  onDropSession: (sessionId: string) => Promise<void>
  onRun: (body: () => Promise<void>) => void
}

/**
 * The clock: every stint of the day, its break, and the one button that either
 * starts a stint or stops the one running.
 *
 * Start and Stop write immediately — they are real events, not a form field —
 * so they are the one part of this sheet that is never held back for Save
 * draft. The break is not: it is typed like everything else and only saved
 * when the draft is.
 */
export function ShiftHours(props: Props) {
  const { shift, busy, readOnly } = props
  const run = props.onRun
  const out = isOut(shift)
  const open = shift.sessions.find((session) => session.ended_at === null)

  return (
    <section className="shift-block">
      <h3 className="shift-heading">Hours</h3>
      <ul className="shift-sessions">
        {shift.sessions.map((session) => (
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
            {!readOnly && (
              <button
                type="button"
                name="drop-session"
                className="shift-drop"
                disabled={busy}
                aria-label={`Remove the session that started at ${clock(session.started_at)}`}
                onClick={() => run(() => props.onDropSession(session.id))}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>

      {!readOnly &&
        (out && open !== undefined ? (
          <button
            type="button"
            name="clock-off"
            className="shift-clock shift-clock-off"
            disabled={busy}
            onClick={() => run(() => props.onClockOff(open.id))}
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            name="clock-on"
            className="shift-clock"
            disabled={busy}
            onClick={() => run(props.onClockOn)}
          >
            Start
          </button>
        ))}
    </section>
  )
}
