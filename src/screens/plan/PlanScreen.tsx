import { Link } from 'react-router-dom'

import { forTasks, forWaiting } from '../../repository/items'
import type { Item } from '../../repository/items'
import { useScreen } from '../../items/context'
import { ItemRow } from '../../ui/ItemRow'
import './PlanScreen.css'

type ListProps = {
  heading: string
  empty: string
  items: Item[]
  today: string
  unsavedFor: (item: Item) => string | undefined
  onOpen: (item: Item) => void
}

function List({ heading, empty, items, today, unsavedFor, onOpen }: ListProps) {
  return (
    <section className="plan-section">
      <h2 className="plan-heading">{heading}</h2>
      {items.length === 0 ? (
        <p className="plan-empty">{empty}</p>
      ) : (
        <ul className="plan-list">
          {items.map((item) => (
            <li key={item.id}>
              <ItemRow item={item} today={today} unsaved={unsavedFor(item)} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * What to do and when, over the same items Home already shows.
 *
 * Nothing here is a second copy: Tasks reads `forTasks`, the one selector for
 * "every active task, whatever its date" — Home's own `forToday` stops at
 * "due today or earlier" on purpose, so it cannot answer this. Waiting is the
 * same `waiting_since` field. The Calendar is its own screen already, one tap
 * away — it does not need to be redrawn here to be "in Plan".
 */
export function PlanScreen() {
  const { data, openItem, today } = useScreen()

  // Before the snapshot has loaded, an empty list here is not "nothing
  // planned" — it is "not read yet". Saying so instead of showing an empty
  // Tasks/Waiting is the same rule Home already follows for its own summary.
  if (data.loading) {
    return (
      <div className="plan">
        <p className="plan-note">Loading…</p>
      </div>
    )
  }

  const unsavedFor = (item: Item) =>
    data.unsaved.find((u) => u.item.id === item.id)?.reason

  // Most urgent first: overdue, then due today, then upcoming, then undated.
  // A task due next month stays in this list — forTasks does not cut it off.
  const groups = forTasks(data.items, today)
  const tasks = [...groups.overdue, ...groups.today, ...groups.upcoming, ...groups.undated]
  const waiting = forWaiting(data.items)

  return (
    <div className="plan">
      <Link className="plan-calendar" to="/calendar">
        Calendar
      </Link>

      <List
        heading="Tasks"
        empty="Nothing on the list."
        items={tasks}
        today={today}
        unsavedFor={unsavedFor}
        onOpen={openItem}
      />

      <List
        heading="Waiting"
        empty="Nothing waiting on somebody else."
        items={waiting}
        today={today}
        unsavedFor={unsavedFor}
        onOpen={openItem}
      />
    </div>
  )
}
