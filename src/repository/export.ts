// The export: the one thing in the whole plan that gives you control that
// depends on nobody. One button, one file on your own phone.

import { localToday } from './item'
import type { Item } from './item'
import type { JournalEntry } from './journal-entry'
import type { QuickAction } from './quick-action'

export type ExportFile = {
  name: string
  /** The whole content, as text. */
  contents: string
}

/**
 * The entire snapshot, as a file.
 *
 * It includes the deleted rows and the point it is synced through: a file that
 * did not say how fresh it is would promise more than it knows.
 *
 * The journal rides beside `items`, not folded into it: an entry's body,
 * title and journaled_at live in their own table, exactly like a shift's
 * numbers or an expense's amount — and unlike those, the journal has no
 * other place a person can read its text back from. Leaving it out here
 * would mean "Download everything" downloaded everything except the one
 * thing Journal is actually for.
 *
 * Quick Actions ride beside `items` too, for the same reason: they are the
 * user's own configuration, not something derivable from anything else in
 * the file, so leaving them out would be an "everything" that quietly
 * excludes one table a person owns.
 */
export function exportFile(
  user: string,
  items: readonly Item[],
  journal: readonly JournalEntry[],
  quickActions: readonly QuickAction[],
  cursor: string | null,
  now: Date,
): ExportFile {
  const contents = JSON.stringify(
    {
      app: 'life-control-centre',
      formatVersion: 1,
      user,
      exportedAt: now.toISOString(),
      syncedThrough: cursor,
      items,
      journal,
      quickActions,
    },
    null,
    2,
  )

  // The local day, not the UTC one: a file downloaded late at night must not
  // be named after tomorrow. The contents already say the exact moment, with
  // its offset, in exportedAt.
  const day = localToday(now)
  return { name: `life-control-centre-${day}.json`, contents }
}
