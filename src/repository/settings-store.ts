// Where the settings sit in the cache.
//
// Apart from store.ts because that file was at 295 of its 300 lines, and
// because these are not snapshots of a synced table: a handful of rows,
// replaced whole, with no cursor between them.

import type { Expense } from './expense'
import type { TaxYearRow } from './hmrc-year'
import type { RunningCosts } from './settings'
import type { VehicleCostRate } from './vehicle-cost'
import { completed, open, request, STORES } from './store'

const { COSTS, EXPENSES, TAX_YEARS, VEHICLE_COST_RATES } = STORES

/**
 * The settings, kept the same way the shift parts are: whole, no cursor.
 *
 * Running costs are one row per area and tax years one per April, so both are
 * read by owner like everything else.
 */
export const settingsStore = {
  async taxYears(owner: string): Promise<TaxYearRow[]> {
    const opened = await open()
    const tx = opened.transaction(TAX_YEARS, 'readonly')
    const rows: unknown = await request(
      tx.objectStore(TAX_YEARS).index('owner').getAll(owner),
    )
    if (!Array.isArray(rows)) throw new Error('The cache did not return a list')
    return rows as TaxYearRow[]
  },

  async replaceTaxYears(owner: string, years: readonly TaxYearRow[]): Promise<void> {
    for (const row of years) {
      if (row.owner !== owner) {
        throw new Error(`The year ${row.tax_year} belongs to ${row.owner}`)
      }
    }
    const opened = await open()
    const tx = opened.transaction(TAX_YEARS, 'readwrite')
    const store = tx.objectStore(TAX_YEARS)
    const keys = await request(store.index('owner').getAllKeys(owner))
    for (const key of keys) store.delete(key)
    for (const row of years) store.put(row)
    await completed(tx)
  },

  async costs(owner: string): Promise<RunningCosts[]> {
    const opened = await open()
    const tx = opened.transaction(COSTS, 'readonly')
    const rows: unknown = await request(
      tx.objectStore(COSTS).index('owner').getAll(owner),
    )
    if (!Array.isArray(rows)) throw new Error('The cache did not return a list')
    return rows as RunningCosts[]
  },

  async replaceCosts(owner: string, costs: readonly RunningCosts[]): Promise<void> {
    for (const row of costs) {
      if (row.owner !== owner) {
        throw new Error(`Costs for ${row.area_id} belong to ${row.owner}`)
      }
    }
    const opened = await open()
    const tx = opened.transaction(COSTS, 'readwrite')
    const store = tx.objectStore(COSTS)
    const keys = await request(store.index('owner').getAllKeys(owner))
    for (const key of keys) store.delete(key)
    for (const row of costs) store.put(row)
    await completed(tx)
  },

  async vehicleCostRates(owner: string): Promise<VehicleCostRate[]> {
    const opened = await open()
    const tx = opened.transaction(VEHICLE_COST_RATES, 'readonly')
    const rows: unknown = await request(
      tx.objectStore(VEHICLE_COST_RATES).index('owner').getAll(owner),
    )
    if (!Array.isArray(rows)) throw new Error('The cache did not return a list')
    return rows as VehicleCostRate[]
  },

  async replaceVehicleCostRates(owner: string, rates: readonly VehicleCostRate[]): Promise<void> {
    for (const row of rates) {
      if (row.owner !== owner) {
        throw new Error(`The cost rate for ${row.vehicle_item_id} belongs to ${row.owner}`)
      }
    }
    const opened = await open()
    const tx = opened.transaction(VEHICLE_COST_RATES, 'readwrite')
    const store = tx.objectStore(VEHICLE_COST_RATES)
    const keys = await request(store.index('owner').getAllKeys(owner))
    for (const key of keys) store.delete(key)
    for (const row of rates) store.put(row)
    await completed(tx)
  },
}

/** The expenses, replaced whole for the same reason the shift parts are. */
export const expenseStore = {
  async readAll(owner: string): Promise<Expense[]> {
    const opened = await open()
    const tx = opened.transaction(EXPENSES, 'readonly')
    const rows: unknown = await request(
      tx.objectStore(EXPENSES).index('owner').getAll(owner),
    )
    if (!Array.isArray(rows)) throw new Error('The cache did not return a list')
    return rows as Expense[]
  },

  async replaceAll(owner: string, expenses: readonly Expense[]): Promise<void> {
    for (const expense of expenses) {
      if (expense.owner !== owner) {
        throw new Error(`Expense ${expense.item_id} belongs to ${expense.owner}`)
      }
    }
    const opened = await open()
    const tx = opened.transaction(EXPENSES, 'readwrite')
    const store = tx.objectStore(EXPENSES)
    const keys = await request(store.index('owner').getAllKeys(owner))
    for (const key of keys) store.delete(key)
    for (const expense of expenses) store.put(expense)
    await completed(tx)
  },
}
