// The shape of an item, and the two rules that must never be written twice:
// what day it is today, and when done_at gets set.
//
// The field names are the column names from the database, not translations. A
// second vocabulary for the same thing is a place where mistakes hide, and a
// patch has to line up with the columns without any conversion.

import { asRecord, optionalDay, optionalText, requiredText, stampsOf } from './row'
import type { Row } from './row'

export { isDay } from './row'

export type State = 'inbox' | 'active' | 'done'
// A thing — a car, a company, a person — is a kind too, and the only one that
// is not something that happened or something to do. It exists whether or not
// you touch it, which is why it has no date and why Today leaves it out.
export type Kind = 'task' | 'letter' | 'shift' | 'expense' | 'entity' | 'journal' | 'platform'

export type Item = Row & {
  kind: Kind | null
  state: State
  title: string
  /** What you planned. A date, not a date and time. */
  due: string | null
  /** What actually happened: the day you ticked it off. */
  done_at: string | null
  /** The area it belongs to. Null until it is processed out of the inbox. */
  area_id: string | null
  /** The day you started waiting on someone else. Null unless you are. */
  waiting_since: string | null
}

/**
 * What a client is allowed to change.
 *
 * The list is exactly the column list in `grant update` — id, owner, version,
 * created_at and updated_at do not appear, because the database refuses them
 * anyway. Here the type refuses them earlier.
 */
export type Patch = Partial<
  Pick<
    Item,
    | 'kind'
    | 'state'
    | 'title'
    | 'due'
    | 'done_at'
    | 'deleted_at'
    | 'area_id'
    | 'waiting_since'
  >
>

const STATES: readonly string[] = ['inbox', 'active', 'done']
const KINDS: readonly string[] = ['task', 'letter', 'shift', 'expense', 'entity', 'journal', 'platform']

/**
 * A row that came from the server, checked.
 *
 * A partial answer is never treated as the whole truth: a row missing a field
 * does not enter the cache as half an item.
 *
 * It asks of a row exactly what the database asks of it, and for a reason
 * beyond tidiness: the same check decides whether a cache is worth keeping. A
 * check that lets a broken row through declares that cache good, so the
 * rebuild never runs, and the row goes on to break a screen somewhere far from
 * where it came in.
 */
export function fromRow(row: unknown): Item {
  const raw = asRecord(row)

  const state = requiredText(raw, 'state')
  if (!STATES.includes(state)) throw new Error(`Unknown state: ${state}`)

  const kind = optionalText(raw, 'kind')
  if (kind !== null && !KINDS.includes(kind)) {
    throw new Error(`Unknown kind: ${kind}`)
  }

  // The constraint goes both ways in the database, so it goes both ways here:
  // not only "no leaving the inbox without a kind", but "in the inbox there is
  // no kind" — otherwise the state and the kind can contradict each other.
  if ((state === 'inbox') !== (kind === null)) {
    throw new Error(`State ${state} does not go with kind ${kind ?? 'null'}`)
  }

  const title = requiredText(raw, 'title')
  if (title.trim() === '') throw new Error('Title of nothing but spaces')

  const due = optionalDay(raw, 'due')
  const done_at = optionalDay(raw, 'done_at')
  const waiting_since = optionalDay(raw, 'waiting_since')

  // items_journal_active_only, mirrored: a journal anchor is permanently
  // active and carries none of due, done_at or waiting_since — it exists
  // whether or not you do anything about it, the same shape an entity
  // already has. A row saying otherwise did not come from the database as
  // it stands.
  if (
    kind === 'journal' &&
    (state !== 'active' || due !== null || done_at !== null || waiting_since !== null)
  ) {
    throw new Error(
      'A journal item carrying a due date, a done_at, a waiting_since, or a state other than active',
    )
  }

  return {
    id: requiredText(raw, 'id'),
    owner: requiredText(raw, 'owner'),
    kind: kind as Kind | null,
    state: state as State,
    title,
    due,
    done_at,
    area_id: optionalText(raw, 'area_id'),
    waiting_since,
    ...stampsOf(raw),
  }
}

/**
 * Today, from the device clock.
 *
 * Not from the database: `current_date` depends on the PostgreSQL session
 * timezone, and "today" is the day the person is in, not the server.
 */
export function localToday(now: Date): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * The patch, with done_at set by the repository — the only place that decides.
 *
 * When an item becomes done, done_at takes the local day. When it leaves done,
 * it is cleared. A done_at passed explicitly is respected: the item sheet is
 * allowed to correct the day.
 */
export function withDoneAt(item: Item, patch: Patch, today: string): Patch {
  if ('done_at' in patch) return patch

  const nextState = patch.state ?? item.state
  if (nextState === 'done' && item.state !== 'done') {
    return { ...patch, done_at: today }
  }
  if (nextState !== 'done' && item.state === 'done') {
    return { ...patch, done_at: null }
  }
  return patch
}
