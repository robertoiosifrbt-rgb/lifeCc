// The settings, as the screens ask for them.

import { currentSession } from './auth'
import { taxYearFromRow } from './hmrc-year'
import type { TaxYearPatch, TaxYearRow } from './hmrc-year'
import { runningCostsFromRow } from './settings'
import type { RunningCosts } from './settings'
import { settingsStore } from './settings-store'
import {
  supabaseSettings,
  supabaseSettingsWriter,
  supabaseVehicleCostRates,
} from './settings-source'
import { vehicleCostRateFromRow } from './vehicle-cost'
import type { VehicleCostRate } from './vehicle-cost'

async function requireAccount(owner: string): Promise<void> {
  const session = await currentSession()
  if (session === null) {
    throw new Error('Nobody is signed in. The cache is not read.')
  }
  if (session.userId !== owner) {
    throw new Error('The requested cache belongs to another account.')
  }
}

/** Reads the settings from the server and puts them in the cache. */
export async function syncSettings(owner: string): Promise<void> {
  const [fetched, rates] = await Promise.all([supabaseSettings(), supabaseVehicleCostRates()])
  await settingsStore.replaceCosts(owner, fetched.costs.map(runningCostsFromRow))
  await settingsStore.replaceTaxYears(owner, fetched.years.map(taxYearFromRow))
  await settingsStore.replaceVehicleCostRates(owner, rates.map(vehicleCostRateFromRow))
}

/** Every tax year the person has set up. A handful, fetched whole. */
export async function taxYearsOf(owner: string): Promise<TaxYearRow[]> {
  await requireAccount(owner)
  return settingsStore.taxYears(owner)
}

export async function runningCostsOf(owner: string): Promise<RunningCosts[]> {
  await requireAccount(owner)
  return settingsStore.costs(owner)
}

/**
 * One tax year, saved whole.
 *
 * All of its figures at once, because a bill worked out from half of them is a
 * number that looks like an answer with the expensive half missing.
 *
 * A year is its own row. Setting up 2027/28 next April leaves 2026/27 exactly
 * as it was, which is the difference between a record and a setting.
 */
export async function saveTaxYear(owner: string, year: TaxYearPatch): Promise<void> {
  await requireAccount(owner)
  await supabaseSettingsWriter().saveTaxYear({ ...year })
  await syncSettings(owner)
}

/** What a kilometre costs, for one area. */
export async function saveRunningCosts(
  owner: string,
  area_id: string,
  fuel_per_km: number,
  vehicle_per_km: number,
): Promise<void> {
  await requireAccount(owner)
  await supabaseSettingsWriter().saveCosts({ area_id, fuel_per_km, vehicle_per_km })
  await syncSettings(owner)
}

/** Every Vehicle cost rate the owner has set, a handful, fetched whole. */
export async function vehicleCostRatesOf(owner: string): Promise<VehicleCostRate[]> {
  await requireAccount(owner)
  return settingsStore.vehicleCostRates(owner)
}

/**
 * What a kilometre wears a Vehicle, from this date on.
 *
 * A new row, not an overwrite: `effective_from` defaults to today unless the
 * caller names an earlier date to correct, so a rate set once already stands
 * for every day it actually applied to.
 */
export async function saveVehicleCostRate(
  owner: string,
  vehicle_item_id: string,
  effective_from: string,
  vehicle_per_km: number,
): Promise<void> {
  await requireAccount(owner)
  await supabaseSettingsWriter().saveVehicleCostRate({ vehicle_item_id, effective_from, vehicle_per_km })
  await syncSettings(owner)
}
