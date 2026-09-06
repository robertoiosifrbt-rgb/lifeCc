import { STOP_SESSION_FIRST } from '../repository/items'
import type { ValidationError } from './draftValidate'

type Props = {
  completed: boolean
  dirty: boolean
  busy: boolean
  blockedByOpenSession: boolean
  errors: ValidationError[]
  onSaveDraft: () => void
  onComplete: () => void
  onDelete: () => void
}

/** Save draft, Complete Workday, Delete Workday — the three ways out of the form. */
export function ShiftActions(props: Props) {
  const { completed, dirty, busy, blockedByOpenSession, errors } = props
  const invalid = errors.length > 0

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
          disabled={busy || invalid || blockedByOpenSession}
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

      {blockedByOpenSession && <p className="shift-hint">{STOP_SESSION_FIRST}</p>}

      {invalid && (
        <ul className="shift-errors">
          {errors.map((error) => (
            <li key={error.field}>{error.message}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
