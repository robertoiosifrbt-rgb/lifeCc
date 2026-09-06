import { useState } from 'react'
import { Link } from 'react-router-dom'

import {
  deliveryLabel,
  deliveryStateOf,
  runDeliveryAction,
  shiftFor,
} from '../../items/deliveryQuickAction'
import { orderedOf } from '../../repository/items'
import type { Item, QuickAction } from '../../repository/items'
import type { ItemsHandle } from '../../items/useItems'
import { runQuickAction } from '../../items/quickActionRun'

type Props = {
  data: ItemsHandle
  openItem: (item: Item) => void
  today: string
  onSpend: () => void
}

/**
 * One configured action, run through the safe registry and nothing else.
 *
 * The switch is the whole point: `action.action_key` is a string that came
 * off a row, and this is the one place it is ever turned into something that
 * runs. A key outside the three cases below renders nothing — never a guess
 * at what it might have meant.
 */
function QuickActionButton(props: {
  action: QuickAction
  data: ItemsHandle
  openItem: (item: Item) => void
  today: string
  busy: boolean
  onSpend: () => void
  onRun: (body: () => Promise<void>) => void
}) {
  const { action, data, openItem, today, busy, onSpend, onRun } = props

  switch (action.action_key) {
    case 'journal.new':
      return (
        <Link className="today-shift" to="/journal">
          {action.label ?? 'Journal'}
        </Link>
      )

    case 'money.expense':
      return (
        <button type="button" name="spend" className="today-shift" onClick={onSpend}>
          {action.label ?? 'Money out'}
        </button>
      )

    case 'delivery.work': {
      // The database refuses a delivery.work row without an Area, and fromRow
      // mirrors that refusal — so a row that reached here already has one.
      const area_id = action.area_id
      if (area_id === null) return null
      const state = deliveryStateOf(data.items, data.shifts, data.areas, area_id, today)

      // The configured Area is gone from the live tree — deleted, or hidden
      // under a deleted ancestor. Nothing here may run past that; the only
      // honest action left is a way back to fix it.
      if (state.kind === 'unavailable') {
        return (
          <Link className="today-shift today-shift-unavailable" to="/quick-actions">
            {deliveryLabel(state, action.label)}
          </Link>
        )
      }

      return (
        <button
          type="button"
          name="delivery-work"
          className="today-shift"
          disabled={busy}
          onClick={() => {
            // Found now, before the write starts — not re-looked-up in a
            // snapshot that has not necessarily caught up with it yet.
            const existingItem = shiftFor(data.items, area_id, today)
            onRun(async () => {
              const item = await runDeliveryAction(state, area_id, today, existingItem, {
                startDeliveryWork: data.startDeliveryWork,
                clockOn: data.clockOn,
              })
              openItem(item)
            })
          }}
        >
          {deliveryLabel(state, action.label)}
        </button>
      )
    }

    default:
      return null
  }
}

/**
 * Home's configured actions, in the order the person chose — never the
 * three the application used to assume everyone wanted.
 *
 * An empty list is not an error and not a reason to invent defaults: it means
 * configure Quick Actions, and says so.
 */
export function QuickActionsRow({ data, openItem, today, onSpend }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const configured = orderedOf(data.quickActions)

  function run(body: () => Promise<void>) {
    setBusy(true)
    // Cleared at the start of every attempt, not just on success: a second
    // tap that also fails must not look like it is still showing the first
    // failure's message by coincidence.
    setError(null)
    void runQuickAction(body, setError).finally(() => setBusy(false))
  }

  if (configured.length === 0) {
    return (
      <p className="today-note">
        No Quick Actions set up yet.{' '}
        <Link to="/quick-actions">Choose what appears here</Link>.
      </p>
    )
  }

  return (
    <div className="today-quick-actions">
      <div className="today-buttons">
        {configured.map((action) => (
          <QuickActionButton
            key={action.id}
            action={action}
            data={data}
            openItem={openItem}
            today={today}
            busy={busy}
            onSpend={onSpend}
            onRun={run}
          />
        ))}
        <Link className="today-manage" to="/quick-actions">
          Edit
        </Link>
      </div>

      {error !== null && (
        <p className="today-quick-action-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
