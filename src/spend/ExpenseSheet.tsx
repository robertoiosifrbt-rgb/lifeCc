import { useState } from 'react'

import { CATEGORY_NAMES, pathOf, vehicleLinkOf, vehiclesOf } from '../repository/items'
import type { Area, Entity, Expense, Item, Link } from '../repository/items'
import { pounds } from '../shifts/money'
import { Sheet } from '../ui/Sheet'
import './ExpenseSheet.css'

type Props = {
  item: Item
  expense: Expense | null
  areas: Area[]
  items: Item[]
  links: Link[]
  things: Entity[]
  onRemove: () => Promise<void>
  onClose: () => void
}

/**
 * One expense, open.
 *
 * It shows and it removes; it does not offer to tick anything off or to
 * change what kind of thing it is. An expense is a fact with a date — the
 * item sheet's questions are for things you still have to do, and asking them
 * here was the screen forgetting what it was looking at.
 */
export function ExpenseSheet({ item, expense, areas, items, links, things, onRemove, onClose }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const vehicleLink = vehicleLinkOf(links, things, item.id)
  const vehicleName = (() => {
    if (vehicleLink.kind === 'none') return '—'
    if (vehicleLink.kind === 'ambiguous') return 'Multiple Vehicles linked'
    return vehiclesOf(items, things).find((v) => v.itemId === vehicleLink.vehicleItemId)?.name ?? 'Unknown Vehicle'
  })()

  function remove() {
    setBusy(true)
    setError(null)
    void onRemove()
      .then(onClose)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason))
        setBusy(false)
      })
  }

  return (
    <Sheet title={`Money out · ${item.due ?? ''}`} onClose={onClose}>
      {expense === null ? (
        <p className="spent-note">The numbers for this one have not arrived yet.</p>
      ) : (
        <dl className="spent-rows">
          <div className="spent-row spent-row-strong">
            <dt>{CATEGORY_NAMES[expense.category]}</dt>
            <dd>{pounds(Math.round(expense.amount * 100))}</dd>
          </div>
          {expense.odo !== null && (
            <div className="spent-row">
              <dt>Odometer</dt>
              <dd>{expense.odo.toFixed(1)}</dd>
            </div>
          )}
          {expense.category === 'fuel' && (
            <div className="spent-row">
              <dt>Tank</dt>
              <dd>{expense.full_tank === true ? 'Filled' : 'Part-fill'}</dd>
            </div>
          )}
          <div className="spent-row">
            <dt>Area</dt>
            <dd>{item.area_id === null ? '—' : pathOf(areas, item.area_id)}</dd>
          </div>
          <div className="spent-row">
            <dt>Vehicle</dt>
            <dd>{vehicleName}</dd>
          </div>
        </dl>
      )}

      {/* Said here because removing a fill-up moves the cost per kilometre,
          and that moves every shift written after it. */}
      {expense?.category === 'fuel' && expense.odo !== null && (
        <p className="spent-note">
          This reading is part of how the cost per kilometre is worked out.
          Removing it changes that number.
        </p>
      )}

      {error !== null && <p className="spent-error">{error}</p>}

      <button
        type="button"
        name="remove"
        className="spent-remove"
        disabled={busy}
        onClick={remove}
      >
        Remove it
      </button>
    </Sheet>
  )
}
