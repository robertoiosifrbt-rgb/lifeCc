// Everything "Download everything" needs, gathered from the tables that hold
// it. Kept apart from the orchestrator in items.ts so that file does not have
// to import every table's module just to grow one more field on export.

import { areasOf } from './areas'
import { linksOf, thingsOf } from './core'
import type { ExportData } from './export'
import { expensesOf } from './expenses'
import { journalStore } from './journal-store'
import { platformRulesOf, platformsOf } from './platforms'
import { runningCostsOf, taxYearsOf, vehicleCostRatesOf } from './settings-api'
import { shiftsOf } from './shifts'
import { quickActionStore, store } from './store'

export async function readExportData(
  owner: string,
): Promise<{ data: ExportData; cursor: string | null }> {
  const [
    items, cursor, journal, quickActions,
    areas, shifts, expenses, costs, vehicleCostRates, taxYears,
    things, links, platforms, platformRules,
  ] = await Promise.all([
    store.readAll(owner),
    store.cursor(owner),
    journalStore.readAll(owner),
    quickActionStore.readAll(owner),
    areasOf(owner),
    shiftsOf(owner),
    expensesOf(owner),
    runningCostsOf(owner),
    vehicleCostRatesOf(owner),
    taxYearsOf(owner),
    thingsOf(owner),
    linksOf(owner),
    platformsOf(owner),
    platformRulesOf(owner),
  ])
  return {
    data: {
      items, areas, shifts, expenses, costs, vehicleCostRates, taxYears,
      things, links, platforms, platformRules, journal, quickActions,
    },
    cursor,
  }
}
