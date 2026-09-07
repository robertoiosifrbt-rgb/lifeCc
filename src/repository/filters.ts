// Today and the Calendar are filters over the snapshot, here, in one place.
//
// The rule "no filtering in JavaScript" still holds: what it forbade was logic
// scattered across screens, not where it runs.
//
// An item moved to next week does not leave the snapshot, it only leaves the
// Today result — "no longer in Today" cannot be confused with "no longer
// exists".

import type { Item } from './item'

/** The deleted_at is null filter, in exactly one place. */
export function alive(items: readonly Item[]): Item[] {
  return items.filter((item) => item.deleted_at === null)
}

const byCreated = (a: Item, b: Item) => a.created_at.localeCompare(b.created_at)

const byDue = (a: Item, b: Item) =>
  (a.due ?? '').localeCompare(b.due ?? '') || byCreated(a, b)

/**
 * Neither a thing (entity), a journal entry, nor a Platform record — none of
 * the three is ever a next action, and none carries a `due` that would let
 * it leave "undated" on its own. A car counted as a task would sit in
 * "undated" for ever; a journal entry counted the same way would sit right
 * beside it, under a heading that means work; a Platform (Uber Eats, a
 * courier firm) is a record you configure once, not a thing you complete —
 * counting it here would let it be opened in the generic ItemSheet and put
 * Waiting, marked done or deleted, exactly what a configuration record must
 * never be.
 */
function isTaskable(item: Item): boolean {
  return item.kind !== 'entity' && item.kind !== 'journal' && item.kind !== 'platform'
}

export type TodayGroups = {
  /** Things captured, that you do not yet know the shape of. */
  inbox: Item[]
  today: Item[]
  overdue: Item[]
  undated: Item[]
}

/**
 * What you have to do now.
 *
 * The OR on state is mandatory: Capture creates an item with no due, and
 * `null <= today` is false — without it you write "call X" and it appears
 * nowhere.
 *
 * The OR on "due is null" is just as mandatory: you process "buy a drill" as a
 * task with no date, it leaves the inbox, becomes active — and without it, it
 * would vanish. A correct action must never make a thing evaporate.
 */
export function forToday(items: readonly Item[], today: string): TodayGroups {
  const relevant = alive(items).filter(
    (item) =>
      // Law 6 is still satisfied: a thing is found on the Things screen and a
      // journal entry on the Journal screen, which is where each lives.
      isTaskable(item) &&
      (item.state === 'inbox' ||
        (item.state === 'active' && (item.due === null || item.due <= today))),
  )

  return {
    inbox: relevant.filter((item) => item.state === 'inbox').sort(byCreated),
    today: relevant
      .filter((item) => item.state === 'active' && item.due === today)
      .sort(byDue),
    overdue: relevant
      .filter(
        (item) => item.state === 'active' && item.due !== null && item.due < today,
      )
      .sort(byDue),
    undated: relevant
      .filter((item) => item.state === 'active' && item.due === null)
      .sort(byCreated),
  }
}

export type TaskGroups = {
  overdue: Item[]
  today: Item[]
  /** Due later than today. Today's own groups stop before this one exists. */
  upcoming: Item[]
  undated: Item[]
}

/**
 * Every active task, whatever its date — the full backlog Plan asks about.
 *
 * Today deliberately stops at "due today or earlier": `forToday` excludes a
 * task due next month on purpose, because Today only answers "what needs
 * doing right now". Plan asks a different question — everything that is on
 * the plate at all — so it cannot reuse Today's result and must not apply
 * the same cutoff, or a future-dated task would disappear from the whole app
 * until the day it became due.
 */
export function forTasks(items: readonly Item[], today: string): TaskGroups {
  const relevant = alive(items).filter((item) => isTaskable(item) && item.state === 'active')

  return {
    overdue: relevant.filter((item) => item.due !== null && item.due < today).sort(byDue),
    today: relevant.filter((item) => item.due === today).sort(byDue),
    upcoming: relevant.filter((item) => item.due !== null && item.due > today).sort(byDue),
    undated: relevant.filter((item) => item.due === null).sort(byCreated),
  }
}

/**
 * Active items stuck on somebody else's answer, oldest wait first.
 *
 * The same field Today's summary already reads, `waiting_since` — not a
 * fourth state of the item cycle, just one more date like `due`. A thing or
 * a journal entry never carries one in practice; `isTaskable` makes that
 * explicit here too, the same as in forToday, forTasks and forCalendar,
 * rather than leaving it to depend on a row nobody ever writes that way.
 */
export function forWaiting(items: readonly Item[]): Item[] {
  return alive(items)
    .filter((item) => isTaskable(item) && item.state === 'active' && item.waiting_since !== null)
    .sort((a, b) => (a.waiting_since as string).localeCompare(b.waiting_since as string))
}

export type CalendarDay = {
  /** The day, as 'YYYY-MM-DD'. */
  day: string
  /** What you planned for this day: due. */
  planned: Item[]
  /** What happened on this day: done_at. */
  done: Item[]
}

/**
 * The days, with what you planned and what you did. No new table.
 *
 * A task due Monday and finished Wednesday shows up in both — that is the
 * point: you see the difference between the plan and what happened. When both
 * fall on the same day there is no difference to see, only the same row twice,
 * so it stays once, under done: done is what actually happened.
 *
 * A task with no date, finished, shows up on Wednesday — that is why done_at
 * exists, so that nothing finished disappears from every screen.
 *
 * A thing or a journal entry never carries a due or a done_at in practice, so
 * this filter changes nothing either has ever shown here — it only makes
 * that guarantee explicit rather than accidental.
 */
export function forCalendar(items: readonly Item[]): CalendarDay[] {
  const days = new Map<string, CalendarDay>()

  const dayOf = (day: string): CalendarDay => {
    const existing = days.get(day)
    if (existing !== undefined) return existing
    const fresh: CalendarDay = { day, planned: [], done: [] }
    days.set(day, fresh)
    return fresh
  }

  for (const item of alive(items).filter(isTaskable)) {
    const sameDay = item.due !== null && item.due === item.done_at
    if (item.due !== null && !sameDay) dayOf(item.due).planned.push(item)
    if (item.done_at !== null) dayOf(item.done_at).done.push(item)
  }

  for (const day of days.values()) {
    day.planned.sort(byCreated)
    day.done.sort(byCreated)
  }

  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day))
}
