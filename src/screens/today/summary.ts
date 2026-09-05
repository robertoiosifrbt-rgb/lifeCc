// The four lines at the top of the day, and where each number comes from.
//
// The owner drew this screen: a count of what needs attention, of what is
// coming, of what is unprocessed, and the money underneath. Everything here is
// read from rows that already exist — nothing is stored, so nothing can go
// stale, and nothing had to be invented to fill a line in the drawing.
//
// 📜 One line of that drawing is deliberately missing: "Available £1,840".
// The app has never known what is in a bank account, and a screen that shows a
// balance it guessed is worse than a screen without one.

import type { Entity } from '../../repository/entity'
import { dueOn } from '../../repository/entity'
import type { Item } from '../../repository/item'

/** How far ahead "coming up" reaches. A week is what a week of work plans. */
export const SOON_DAYS = 7

export type Coming = {
  /** What it is, as the row already calls it. */
  title: string
  /** The day it lands, as 'YYYY-MM-DD'. */
  day: string
  /** Negative once it has passed. */
  inDays: number
}

export type Summary = {
  /** Past their day, and still not done. */
  overdue: Item[]
  /** Landing inside the week: tasks, and what a vehicle owes. */
  coming: Coming[]
  /** Caught and not yet given a shape. */
  inbox: Item[]
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000,
  )
}

/**
 * Everything the top of the day is counting.
 *
 * A vehicle's MOT sits in the same list as a task, because from where you are
 * standing they are the same thing: something with a date that will cost you
 * if it passes. Keeping them in separate lists is what made the car invisible
 * until the day it was too late.
 */
export function summarise(input: {
  items: readonly Item[]
  things: readonly Entity[]
  today: string
}): Summary {
  const { today } = input
  const alive = input.items.filter((item) => item.deleted_at === null)

  const overdue = alive.filter(
    (item) =>
      item.state === 'active' &&
      item.kind !== 'entity' &&
      item.due !== null &&
      item.due < today,
  )

  const coming: Coming[] = []
  for (const item of alive) {
    if (item.state !== 'active' || item.kind === 'entity' || item.due === null) continue
    const inDays = daysBetween(today, item.due)
    if (inDays >= 0 && inDays <= SOON_DAYS) {
      coming.push({ title: item.title, day: item.due, inDays })
    }
  }

  // What the cars owe. Overdue ones are included rather than dropped: an MOT
  // that ran out last week is the most urgent line on the screen, and pushing
  // it out of "coming up" would hide it exactly when it matters.
  const named = new Map(input.items.map((item) => [item.id, item.title]))
  for (const thing of input.things) {
    const title = named.get(thing.item_id)
    if (title === undefined) continue
    for (const one of dueOn(thing, today)) {
      if (one.inDays > SOON_DAYS) continue
      coming.push({ title: `${title} — ${one.label}`, day: one.day, inDays: one.inDays })
    }
  }

  return {
    overdue,
    coming: coming.sort((one, other) => one.inDays - other.inDays),
    inbox: alive.filter((item) => item.state === 'inbox'),
  }
}
