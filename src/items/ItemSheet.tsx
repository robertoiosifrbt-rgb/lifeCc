import { useState } from 'react'

import type { Item, Link, LinkKind, Patch } from '../repository/items'
import { JoinedTo } from '../things/JoinedTo'
import { Sheet } from '../ui/Sheet'
import { headingFor } from './heading'
import './ItemSheet.css'

type Props = {
  item: Item
  today: string
  /** Every item and every arrow, so this one can be joined to another. */
  items: readonly Item[]
  links: readonly Link[]
  unsaved?: string | undefined
  onUpdate: (item: Item, patch: Patch) => Promise<void>
  onLink: (to_id: string, kind: LinkKind) => Promise<void>
  onUnlink: (id: string) => Promise<void>
  onDiscard: (item: Item) => Promise<void>
  /** Writes the stuck patch again, over whatever version the row is on now. */
  onRetry: (item: Item) => Promise<void>
  onClose: () => void
}

/**
 * The item sheet — the whole cycle, in one place.
 *
 * The same sheet opens from Today and from the Calendar. Without it, `done`
 * would exist in the database with no defined way to produce it, and a
 * processed item could never be corrected again.
 */
export function ItemSheet({
  item,
  today,
  items,
  links,
  unsaved,
  onUpdate,
  onLink,
  onUnlink,
  onDiscard,
  onRetry,
  onClose,
}: Props) {
  const [title, setTitle] = useState(item.title)
  const [due, setDue] = useState(item.due ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(body: () => Promise<void>, closeAfter: boolean) {
    setBusy(true)
    setError(null)
    try {
      await body()
      if (closeAfter) onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const patch = (changes: Patch, closeAfter = false) =>
    void run(() => onUpdate(item, changes), closeAfter)

  const heading = headingFor(item)

  return (
    <Sheet title={heading} onClose={onClose}>
      {/* A patch that could not be written stays here, with the way to write
          it again. Without the button there is no "until you retry it", and a
          thing that cannot be reached is a thing that has been lost. */}
      {unsaved !== undefined && (
        <div className="item-unsaved" role="alert">
          <p className="item-unsaved-text">Not saved — {unsaved}</p>
          <button
            className="item-button"
            type="button"
            name="retry"
            disabled={busy}
            onClick={() => void run(() => onRetry(item), false)}
          >
            Try again
          </button>
        </div>
      )}

      <label className="item-field">
        <span className="item-label">Title</span>
        <input
          className="item-input"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      {title !== item.title && (
        <button
          className="item-button"
          type="button"
          disabled={busy}
          onClick={() => patch({ title })}
        >
          Save the title
        </button>
      )}

      <label className="item-field">
        <span className="item-label">Date</span>
        <input
          className="item-input"
          type="date"
          name="due"
          value={due}
          onChange={(event) => setDue(event.target.value)}
        />
        <span className="item-hint">
          A task with no date does not disappear. It sits under Undated.
        </span>
      </label>

      {item.state === 'inbox' ? (
        <div className="item-actions">
          {/* Leaving the inbox needs a kind: the choice is the action. */}
          <button
            className="item-button item-primary"
            type="button"
            name="as-task"
            disabled={busy}
            onClick={() =>
              patch({ kind: 'task', state: 'active', due: due === '' ? null : due }, true)
            }
          >
            It is a task
          </button>
          <button
            className="item-button"
            type="button"
            name="as-letter"
            disabled={busy}
            onClick={() =>
              patch({ kind: 'letter', state: 'active', due: due === '' ? null : due }, true)
            }
          >
            It is a letter
          </button>
        </div>
      ) : (
        <div className="item-actions">
          {due !== (item.due ?? '') && (
            <button
              className="item-button"
              type="button"
              name="save-due"
              disabled={busy}
              onClick={() => patch({ due: due === '' ? null : due })}
            >
              Save the date
            </button>
          )}
          {item.state === 'active' ? (
            <button
              className="item-button item-primary"
              type="button"
              name="mark-done"
              disabled={busy}
              onClick={() => patch({ state: 'done' }, true)}
            >
              Mark it done
            </button>
          ) : (
            <button
              className="item-button item-primary"
              type="button"
              name="reopen"
              disabled={busy}
              onClick={() => patch({ state: 'active' }, true)}
            >
              Reopen it
            </button>
          )}
        </div>
      )}

      {item.done_at !== null && (
        <p className="item-hint">Ticked off on {item.done_at}. Today is {today}.</p>
      )}

      {/* The arrows, above the destructive button and below everything that
          changes this item alone: joining a renewal to the car is the reason
          the app is not seven lists. */}
      <JoinedTo
        itemId={item.id}
        items={items}
        links={links}
        busy={busy}
        onLink={onLink}
        onUnlink={onUnlink}
        onError={setError}
      />

      <button
        className="item-button item-danger"
        type="button"
        name="discard"
        disabled={busy}
        onClick={() => void run(() => onDiscard(item), true)}
      >
        Delete it
      </button>

      {error !== null && (
        <p className="item-error" role="alert">
          {error}
        </p>
      )}
    </Sheet>
  )
}
