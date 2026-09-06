// The journal, as the screen asks for it: a quick way in, and the one write
// that covers both making an entry and changing it.

import { currentSession } from './auth'
import { anchorTitleFor, journalFromRow, resolveJournalWrite } from './journal-entry'
import type { JournalEntry, JournalPatch } from './journal-entry'
import { fromRow as fromItemRow, localToday } from './item'
import type { Item, Patch } from './item'
import { journalStore } from './journal-store'
import { supabaseJournal, supabaseJournalWriter, supabaseWriter } from './source'
import { store } from './store'
import { applyPatch } from './write'

const ITEMS = 'items'

async function requireAccount(owner: string): Promise<void> {
  const session = await currentSession()
  if (session === null) {
    throw new Error('Nobody is signed in. The cache is not read.')
  }
  if (session.userId !== owner) {
    throw new Error('The requested cache belongs to another account.')
  }
}

/** A body of nothing but whitespace is refused before it ever reaches the
 *  network — the database refuses it too, but there is no reason to wait for
 *  the round trip to say so. */
function requireBody(body: string): void {
  if (body.trim() === '') throw new Error('A journal entry needs something written in it.')
}

/** Reads every journal entry from the server and puts them in the cache. */
export async function syncJournalEntries(owner: string): Promise<JournalEntry[]> {
  const rows = (await supabaseJournal()).map(journalFromRow)
  await journalStore.replaceAll(owner, rows)
  return rows
}

export async function journalEntriesOf(owner: string): Promise<JournalEntry[]> {
  await requireAccount(owner)
  return journalStore.readAll(owner)
}

/**
 * An entry, written down.
 *
 * The anchor is made the same way a thing's is: it carries no due date,
 * because a journal entry is not a next action, it is something that
 * happened at a moment of its own choosing. Its title is never asked of the
 * person — it is derived from the body when they left their own blank, so
 * the database's "every item has a title" still holds without the Journal
 * composer ever needing a title field to satisfy it.
 */
export async function createJournalEntry(
  owner: string,
  what: {
    title: string | null
    body: string
    journaled_at: string
    area_id: string | null
  },
): Promise<Item> {
  await requireAccount(owner)
  requireBody(what.body)
  const anchor = fromItemRow(
    await supabaseWriter<Patch>(ITEMS, owner).insert({
      title: anchorTitleFor(what.body, what.title),
      kind: 'journal',
      state: 'active',
      area_id: what.area_id,
    }),
  )
  await supabaseJournalWriter().save({
    item_id: anchor.id,
    title: what.title,
    body: what.body,
    journaled_at: what.journaled_at,
  })
  await store.upsert(owner, [anchor], null)
  await syncJournalEntries(owner)
  return anchor
}

/**
 * What is written, changed — title, body, or when it is about.
 *
 * The anchor's own title is recomputed and only patched when it would
 * actually change: an edit that leaves the derived title the same must not
 * spend a version on it, the same way `applyPatch` never writes a field that
 * did not change.
 */
export async function saveJournalEntry(
  owner: string,
  anchor: Item,
  entry: JournalEntry,
  patch: JournalPatch,
): Promise<Item> {
  await requireAccount(owner)
  const write = resolveJournalWrite(entry, patch)
  requireBody(write.body)

  const anchorTitle = anchorTitleFor(write.body, write.title)
  const written =
    anchorTitle === anchor.title
      ? anchor
      : await applyPatch(
          supabaseWriter<Patch>(ITEMS, owner),
          anchor,
          { title: anchorTitle },
          localToday(new Date()),
        )

  // Named explicitly, never spread from `entry`: JournalEntry carries
  // `owner`, and the table grants no UPDATE on that column at all.
  await supabaseJournalWriter().save(write)
  await store.upsert(owner, [written], null)
  await syncJournalEntries(owner)
  return written
}
