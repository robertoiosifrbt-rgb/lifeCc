// The "close with unsaved changes?" prompt — pulled out of ShiftSheet.tsx at
// the 300-line limit. Its classes are ShiftSheet.css's own; it carries none.

type Props = {
  onKeepEditing: () => void
  onDiscard: () => void
}

export function UnsavedChangesBanner({ onKeepEditing, onDiscard }: Props) {
  return (
    <div className="shift-unsaved" role="alert">
      <p>You have unsaved changes. Close anyway?</p>
      <div className="shift-actions">
        <button type="button" className="shift-button" onClick={onKeepEditing}>
          Keep editing
        </button>
        <button type="button" className="shift-button shift-danger" onClick={onDiscard}>
          Discard changes
        </button>
      </div>
    </div>
  )
}
