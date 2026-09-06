// The shape of a personal journal entry, anchored to an item like a shift's
// numbers or an expense's amount — so it can be linked, found and synced the
// same way as everything else in Life Core, instead of living apart from it.

import type { Item } from './item'
import { asRecord, optionalText, requiredMoment, requiredText } from './row'

export type JournalEntry = {
  item_id: string
  owner: string
  /**
   * What the person typed as a title. Genuinely optional — unlike the
   * anchor's own title, which the database still requires nonblank.
   */
  title: string | null
  body: string
  /**
   * When this is about, not when it was written. Distinct from the anchor's
   * created_at/updated_at on purpose: an entry written tonight about this
   * morning still belongs this morning on the timeline.
   */
  journaled_at: string
}

export type JournalPatch = Partial<Omit<JournalEntry, 'item_id' | 'owner'>>

/** The one shape the journal_entries write may ever send. No `owner`: the
 *  grant does not cover it, and the row is not the client's to move. */
export type JournalWrite = {
  item_id: string
  title: string | null
  body: string
  journaled_at: string
}

/**
 * What a patch resolves to, over an existing entry — and the payload for the
 * write, named explicitly rather than spread from the entry.
 *
 * `{ ...entry, ...patch }` would carry `owner` along for the ride: harmless
 * while it matches the row already there, but one line away from sending a
 * column the client has no grant to write at all. Naming exactly what goes
 * out is what keeps that true on purpose, not by accident.
 */
export function resolveJournalWrite(
  entry: JournalEntry,
  patch: JournalPatch,
): JournalWrite {
  return {
    item_id: entry.item_id,
    title: 'title' in patch ? (patch.title ?? null) : entry.title,
    body: 'body' in patch ? (patch.body ?? entry.body) : entry.body,
    journaled_at:
      'journaled_at' in patch ? (patch.journaled_at ?? entry.journaled_at) : entry.journaled_at,
  }
}

/**
 * A title, or nothing — but never a title of nothing but whitespace.
 *
 * `journal_entries_title_not_blank` refuses that same shape at the database.
 * A cache that accepted it anyway would validate a row the database itself
 * can never produce, which is exactly the gap `fromRow` exists to close.
 */
function titleOf(raw: Record<string, unknown>): string | null {
  const value = optionalText(raw, 'title')
  if (value === null) return null
  if (value.trim() === '') throw new Error('A journal entry with a title of nothing but spaces')
  return value
}

export function journalFromRow(row: unknown): JournalEntry {
  const raw = asRecord(row)

  const body = requiredText(raw, 'body')
  if (body.trim() === '') throw new Error('A journal entry with no body')

  return {
    item_id: requiredText(raw, 'item_id'),
    owner: requiredText(raw, 'owner'),
    title: titleOf(raw),
    body,
    journaled_at: requiredMoment(raw, 'journaled_at'),
  }
}

const MAX_ANCHOR_TITLE = 80

/**
 * A title for the anchor item, which must have a nonblank one, when the
 * person left their own blank.
 *
 * The first line of the body, so the anchor reads as something a person
 * wrote rather than a placeholder — and so a title is never asked for in the
 * Journal composer itself, which only ever asks for a body.
 *
 * Callers must have already refused a blank body: this trusts that there is
 * a first line to take.
 */
export function anchorTitleFor(body: string, title: string | null): string {
  if (title !== null && title.trim() !== '') return title.trim()
  const firstLine = body.trim().split('\n')[0]?.trim() ?? ''
  return firstLine.length > MAX_ANCHOR_TITLE
    ? `${firstLine.slice(0, MAX_ANCHOR_TITLE - 1)}…`
    : firstLine
}

/** Newest journalled moment first — the timeline's own order, not created_at. */
export function timelineOf(entries: readonly JournalEntry[]): JournalEntry[] {
  return [...entries].sort((a, b) => b.journaled_at.localeCompare(a.journaled_at))
}

/**
 * Whatever is typed, matched against the title and the body alike, oldest
 * match last — the timeline's own order, kept even while searching.
 */
export function searchJournal(
  entries: readonly JournalEntry[],
  query: string,
): JournalEntry[] {
  const needle = query.trim().toLowerCase()
  const ordered = timelineOf(entries)
  if (needle === '') return ordered
  return ordered.filter(
    (entry) =>
      entry.body.toLowerCase().includes(needle) ||
      (entry.title ?? '').toLowerCase().includes(needle),
  )
}

export type JournalSelection =
  | { found: false }
  | { found: true; entry: JournalEntry; item: Item }

/**
 * The entry a `/journal?entry=<id>` request names, if the snapshot holds it.
 *
 * A pure lookup, so the screen stays a thin "call this, then load what it
 * found" rather than carrying the matching logic itself — the same reason
 * the search and the timeline order live here and not in the component.
 */
export function findRequestedEntry(
  requestedId: string | null,
  journal: readonly JournalEntry[],
  items: readonly Item[],
): JournalSelection {
  if (requestedId === null) return { found: false }
  const entry = journal.find((one) => one.item_id === requestedId)
  const item = items.find((one) => one.id === requestedId)
  if (entry === undefined || item === undefined) return { found: false }
  return { found: true, entry, item }
}
