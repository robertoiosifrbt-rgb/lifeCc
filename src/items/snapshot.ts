// Everything the screens hold, read from the cache in one go.
//
// One function because it was written out three times — on first paint, after
// a sync, and after every write — and three copies of "what the screens need"
// drift apart the moment a sixth thing is added. The fifth one was added
// today and two of the three copies had to be found by the compiler.

import {
  all,
  areasOf,
  expensesOf,
  journalEntriesOf,
  linksOf,
  platformRulesOf,
  platformsOf,
  quickActionsOf,
  runningCostsOf,
  taxYearsOf,
  shiftsOf,
  thingsOf,
  vehicleCostRatesOf,
  withRoadCostExpenses,
} from '../repository/items'
import type {
  Area,
  Entity,
  Expense,
  Item,
  JournalEntry,
  Link,
  PlatformRecord,
  PlatformRule,
  QuickAction,
  RunningCosts,
  Shift,
  TaxYearRow,
  VehicleCostRate,
} from '../repository/items'

export type Snapshot = {
  items: Item[]
  areas: Area[]
  shifts: Shift[]
  expenses: Expense[]
  costs: RunningCosts[]
  vehicleCostRates: VehicleCostRate[]
  taxYears: TaxYearRow[]
  things: Entity[]
  links: Link[]
  platforms: PlatformRecord[]
  platformRules: PlatformRule[]
  journal: JournalEntry[]
  quickActions: QuickAction[]
}

/**
 * The whole cache for one account.
 *
 * Together, not one after another: an item names an area and a shift carries
 * rates, so a screen holding one of them fresh and another stale shows a row
 * pointing at nothing, or a cost of nothing where there is a cost.
 */
export async function readSnapshot(owner: string): Promise<Snapshot> {
  const [
    items, areas, shifts, expenses, costs, vehicleCostRates, taxYears,
    things, links, platforms, platformRules, journal, quickActions,
  ] = await Promise.all([
    all(owner),
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
    journalEntriesOf(owner),
    quickActionsOf(owner),
  ])
  return {
    items, areas, shifts: withRoadCostExpenses(shifts, expenses, links), expenses, costs,
    vehicleCostRates, taxYears, things, links, platforms, platformRules, journal, quickActions,
  }
}
