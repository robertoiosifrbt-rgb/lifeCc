import type { ValidationError } from './draftValidate'

type Props = {
  completed: boolean
  dirty: boolean
  busy: boolean
  blockedByOpenSession: boolean
  /** What to say about session state when it blocks Complete/Delete — one
   *  open session ("Stop the active session first") or several ("data
   *  repair"). Null when nothing about session state is blocking anything. */
  sessionMessage: string | null
  /** Draft-invalid data: blocks both Save draft and Complete Workday. */
  errors: ValidationError[]
  /** What Complete Workday needs beyond a valid draft — date, at least one
   *  finished session, odometer, a known cost basis. Save draft ignores
   *  these entirely: an incomplete workday still saves. */
  completionErrors: ValidationError[]
  onSaveDraft: () => void
  onComplete: () => void
  onDelete: () => void
}

/** Save draft, Complete Workday, Delete Workday — the three ways out of the form. */
export function ShiftActions(props: Props) {
  const { completed, dirty, busy, blockedByOpenSession, errors, completionErrors } = props
  const invalid = errors.length > 0
  const incomplete = completionErrors.length > 0

  return (
    <section className="shift-actions">
      {!completed && (
        <button
          type="button"
          name="save-draft"
          className="shift-button"
          disabled={!dirty || busy || invalid}
          onClick={props.onSaveDraft}
        >
          Save draft
        </button>
      )}

      {!completed && (
        <button
          type="button"
          name="complete-workday"
          className="shift-button shift-primary"
          disabled={busy || invalid || incomplete || blockedByOpenSession}
          onClick={props.onComplete}
        >
          Complete workday
        </button>
      )}

      <button
        type="button"
        name="delete-workday"
        className="shift-button shift-danger"
        disabled={busy || blockedByOpenSession}
        onClick={props.onDelete}
      >
        Delete workday
      </button>

      {props.sessionMessage !== null && <p className="shift-hint">{props.sessionMessage}</p>}

      {invalid && (
        <ul className="shift-errors">
          {errors.map((error) => (
            <li key={error.field}>{error.message}</li>
          ))}
        </ul>
      )}

      {!completed && incomplete && (
        <ul className="shift-errors">
          {completionErrors.map((error) => (
            <li key={error.field}>{error.message}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
