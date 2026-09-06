// The export: the one thing in the whole plan that gives you control that
// depends on nobody. One button, one file on your own phone.

import { localToday } from './item'
import type { Item } from './item'
import type { Area } from './area'
import type { Expense } from './expense'
import type { TaxYearRow } from './hmrc-year'
import type { JournalEntry } from './journal-entry'
import type { Entity } from './entity'
import type { Link } from './link'
import type { PlatformRecord, PlatformRule } from './platform-record'
import type { QuickAction } from './quick-action'
import type { RunningCosts } from './settings'
import type { Shift } from './shift'
import type { VehicleCostRate } from './vehicle-cost'

export type ExportFile = {
  name: string
  /** The whole content, as text. */
  contents: string
}

export type ExportData = {
  items: readonly Item[]
  areas: readonly Area[]
  shifts: readonly Shift[]
  expenses: readonly Expense[]
  costs: readonly RunningCosts[]
  vehicleCostRates: readonly VehicleCostRate[]
  taxYears: readonly TaxYearRow[]
  things: readonly Entity[]
  links: readonly Link[]
  platforms: readonly PlatformRecord[]
  platformRules: readonly PlatformRule[]
  journal: readonly JournalEntry[]
  quickActions: readonly QuickAction[]
}

/**
 * The entire snapshot, as a file — every table `readSnapshot` reads, not
 * just `items`. A shift's numbers, an expense's amount, a Vehicle's cost
 * history, a Platform's rules: none of them are derivable from `items`
 * alone, so leaving any one out would make "Download everything" a file
 * that quietly excludes data a person owns.
 *
 * It includes the deleted rows and the point it is synced through: a file
 * that did not say how fresh it is would promise more than it knows.
 */
export function exportFile(
  user: string,
  data: ExportData,
  cursor: string | null,
  now: Date,
): ExportFile {
  const contents = JSON.stringify(
    {
      app: 'life-control-centre',
      formatVersion: 2,
      user,
      exportedAt: now.toISOString(),
      syncedThrough: cursor,
      ...data,
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
