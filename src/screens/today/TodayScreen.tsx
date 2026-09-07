import { useState } from 'react'

import { SpendSheet } from '../../spend/SpendSheet'

import { currentYearMoney, forToday, vehiclesOf } from '../../repository/items'
import type { Item } from '../../repository/items'
import { useScreen } from '../../items/context'
import { ItemRow } from '../../ui/ItemRow'
import { QuickActionsRow } from './QuickActionsRow'
import { Summary } from './Summary'
import { oldOverdueLabel, splitOverdue, undatedLabel } from './collapse'
import './TodayScreen.css'

type GroupProps = {
  heading: string
  items: Item[]
  today: string
  unsavedFor: (item: Item) => string | undefined
  onOpen: (item: Item) => void
}

function Group({ heading, items, today, unsavedFor, onOpen }: GroupProps) {
  if (items.length === 0) return null
  return (
    <section className="group">
      <h2 className="group-heading">{heading}</h2>
      <ul className="group-list">
        {items.map((item) => (
          <li key={item.id}>
            <ItemRow
              item={item}
              today={today}
              unsaved={unsavedFor(item)}
              onOpen={onOpen}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

type CollapsedProps = GroupProps & { label: string }

/**
 * A group folded down to a number.
 *
 * It is tappable, because a thing that cannot be reached is a thing that has
 * been lost — and the plan allows no flow without an exit.
 */
function Collapsed({ heading, label, ...rest }: CollapsedProps) {
  const [open, setOpen] = useState(false)
  if (rest.items.length === 0) return null

  return (
    <section className="group">
      <button
        className="group-summary"
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="group-heading">{heading}</span>
        <span className="group-count">{label}</span>
      </button>
      {open && <Group heading="" {...rest} />}
    </section>
  )
}

/**
 * What you have to do now.
 *
 * Overdue items from the last seven days stay expanded — one that was due
 * yesterday has to be seen. Older ones, and everything undated, fold down to a
 * count with a date, so the screen is neither a wall of red nor a hiding
 * place.
 */
export function TodayScreen() {
  const { data, openItem, today } = useScreen()
  const [spending, setSpending] = useState(false)
  const groups = forToday(data.items, today)
  const overdue = splitOverdue(groups.overdue, today)

  const unsavedFor = (item: Item) =>
    data.unsaved.find((u) => u.item.id === item.id)?.reason

  const shared = { today, unsavedFor, onOpen: openItem }

  // The tax year as it stands, for the money at the top. The same helper
  // Money reads, so the two cannot drift into two different answers.
  const { money: soFar } = currentYearMoney({
    items: data.items,
    shifts: data.shifts,
    expenses: data.expenses,
    links: data.links,
    taxYears: data.taxYears,
    today,
  })

  const nothing =
    groups.inbox.length === 0 &&
    groups.today.length === 0 &&
    groups.overdue.length === 0 &&
    groups.undated.length === 0

  return (
    <div className="today">
      {data.loading && <p className="today-note">Loading…</p>}

      {!data.loading && (
        <Summary items={data.items} things={data.things} year={soFar} today={today} />
      )}

      {!data.loading && nothing && (
        <p className="today-note">
          Nothing for today. Write a line and it lands in the Inbox.
        </p>
      )}

      {/* Whichever actions the person configured, in the order they chose —
          never the three the application used to assume everyone wanted. */}
      <QuickActionsRow
        data={data}
        openItem={openItem}
        today={today}
        onSpend={() => setSpending(true)}
      />

      {spending && (
        // No suggested Area: "the day's shift" stopped being one thing the
        // moment more than one Area's delivery.work could exist for the same
        // day, and guessing which one would be worse than asking.
        <SpendSheet
          day={today}
          areas={data.areas}
          vehicles={vehiclesOf(data.items, data.things)}
          suggestedArea={null}
          onSpend={(what) => data.spend(what)}
          onClose={() => setSpending(false)}
        />
      )}

      <Group heading="Inbox" items={groups.inbox} {...shared} />
      <Group heading="Today" items={groups.today} {...shared} />
      <Group heading="Overdue" items={overdue.recent} {...shared} />
      <Collapsed
        heading="Older overdue"
        label={oldOverdueLabel(overdue.old, today)}
        items={overdue.old}
        {...shared}
      />
      <Collapsed
        heading="Undated"
        label={undatedLabel(groups.undated, today)}
        items={groups.undated}
        {...shared}
      />
    </div>
  )
}
