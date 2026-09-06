import type { Item } from '../repository/items'
import { formatDay } from './dates'
import './ItemRow.css'

type Props = {
  item: Item
  today: string
  /** Why this row is not saved, when a patch is stuck on it. */
  unsaved?: string | undefined
  onOpen: (item: Item) => void
}

function meta(item: Item, today: string): string {
  const bits: string[] = []
  if (item.state === 'inbox') bits.push('inbox')
  if (item.kind !== null) bits.push(item.kind)
  if (item.due !== null) bits.push(`due ${formatDay(item.due, today)}`)
  if (item.done_at !== null) bits.push(`done ${formatDay(item.done_at, today)}`)
  if (item.waiting_since !== null) bits.push('waiting')
  return bits.join(' · ')
}

/**
 * One item, as a row you can tap.
 *
 * The whole row is the tap target, and it always opens the same sheet — from
 * Today and from the Calendar alike.
 */
export function ItemRow({ item, today, unsaved, onOpen }: Props) {
  return (
    <button
      className={`row${item.state === 'done' ? ' row-done' : ''}`}
      type="button"
      onClick={() => onOpen(item)}
    >
      {/* A ring while it is open, a tick once it is done. */}
      <span className="row-mark" aria-hidden="true">
        {item.state === 'done' ? '✓' : ''}
      </span>
      <span className="row-text">
        <span className="row-title">{item.title}</span>
        <span className="row-meta">{meta(item, today)}</span>
        {unsaved !== undefined && (
          <span className="row-unsaved">Not saved — {unsaved}</span>
        )}
      </span>
    </button>
  )
}
