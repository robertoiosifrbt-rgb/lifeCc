// The writes to the journal: a personal entry, anchored like everything else.
//
// Declared here rather than in the hook, for the same reason coreActions is:
// a handle that lists its actions in one file and implements them in another
// ends up promising something the hook does not return.

import { createJournalEntry, discardJournalEntry, saveJournalEntry } from '../repository/items'
import type { Item, JournalEntry, JournalPatch } from '../repository/items'

export type JournalActions = {
  addJournal: (what: {
    title: string | null
    body: string
    journaled_at: string
    area_id: string | null
  }) => Promise<void>
  /** `area_id` left out leaves the entry's Area alone; passed, it replaces it
   *  (including back to `null`) — the one field of an entry that lives on
   *  its anchor, not on the entry itself. */
  saveJournal: (
    item: Item,
    entry: JournalEntry,
    patch: JournalPatch,
    area_id?: string | null,
  ) => Promise<void>
  discardJournal: (item: Item) => Promise<void>
}

export function journalActions(
  owner: string,
  write: (body: () => Promise<unknown>) => Promise<void>,
): JournalActions {
  return {
    addJournal: (what) => write(() => createJournalEntry(owner, what)),

    saveJournal: (item, entry, patch, area_id) =>
      write(() => saveJournalEntry(owner, item, entry, patch, area_id)),

    discardJournal: (item) => write(() => discardJournalEntry(owner, item, new Date())),
  }
}
