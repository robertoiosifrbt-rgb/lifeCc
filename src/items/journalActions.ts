// The writes to the journal: a personal entry, anchored like everything else.
//
// Declared here rather than in the hook, for the same reason coreActions is:
// a handle that lists its actions in one file and implements them in another
// ends up promising something the hook does not return.

import { createJournalEntry, saveJournalEntry } from '../repository/items'
import type { Item, JournalEntry, JournalPatch } from '../repository/items'

export type JournalActions = {
  addJournal: (what: {
    title: string | null
    body: string
    journaled_at: string
    area_id: string | null
  }) => Promise<void>
  saveJournal: (item: Item, entry: JournalEntry, patch: JournalPatch) => Promise<void>
}

export function journalActions(
  owner: string,
  write: (body: () => Promise<unknown>) => Promise<void>,
): JournalActions {
  return {
    addJournal: (what) => write(() => createJournalEntry(owner, what)),

    saveJournal: (item, entry, patch) =>
      write(() => saveJournalEntry(owner, item, entry, patch)),
  }
}
