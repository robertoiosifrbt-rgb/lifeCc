import { isOut } from '../repository/items'
import type { Shift } from '../repository/items'
import { clock } from './money'

type Props = {
  shift: Shift
  busy: boolean
  onClockOn: () => Promise<void>
  onClockOff: (sessionId: string) => Promise<void>
  onDropSession: (sessionId: string) => Promise<void>
  onSetBreak: (sessionId: string, minutes: number) => Promise<void>
  onRun: (body: () => Promise<void>) => void
  onError: (reason: string) => void
}

/**
 * The clock: every stint of the day, its break, and the one button that either
 * starts a stint or stops the one running.
 *
 * Its own file because the sheet crossed the 300 lines the structure checker
 * allows the moment the break arrived — and the split is the honest one: this
 * is the only part of a shift you touch while you are still out.
 */
export function ShiftHours(props: Props) {
  const { shift, busy } = props
  const run = props.onRun
  const setError = props.onError
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
                defaultValue={session.break_minutes === 0 ? '' : String(session.break_minutes)}
                disabled={busy}
                aria-label={`Break in minutes, in the session starting at ${clock(session.started_at)}`}
                onBlur={(event) => {
                  const typed = event.target.value.trim()
                  const minutes = typed === '' ? 0 : Number(typed)
                  if (!Number.isInteger(minutes) || minutes < 0) {
                    setError(`A break has to be whole minutes: ${typed}`)
                    return
                  }
                  if (minutes === session.break_minutes) return
                  run(() => props.onSetBreak(session.id, minutes))
                }}
              />
              <span className="shift-break-unit">min</span>
            </label>
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
          </li>
        ))}
      </ul>

      {out && open !== undefined ? (
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
      )}
    </section>
  )
}
