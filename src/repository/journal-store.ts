// Where the journal sits in the cache.
//
// The same factory core-store.ts declares for entities and links: a journal
// entry rides its anchor exactly as they do, so there is nothing new to keep
// here beyond which table it is and how to read a row of it.

import type { JournalEntry } from './journal-entry'
import { journalFromRow } from './journal-entry'
import { wholeStore } from './core-store'
import { STORES } from './store'

export const journalStore = wholeStore<JournalEntry>(
  STORES.JOURNAL,
  journalFromRow,
  (entry) => `The journal entry ${entry.item_id}`,
)
