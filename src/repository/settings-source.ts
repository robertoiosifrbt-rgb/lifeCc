// The settings' own Supabase calls — split off from source.ts at the
// 300-line limit, the same reason core-source.ts was.

import { supabase } from './supabase'
import { ALL, fail } from './source'

/** The settings, whole: one row for the person, one per area. */
export async function supabaseSettings(): Promise<{
  costs: unknown[]
  years: unknown[]
}> {
  const [costs, years] = await Promise.all([
    supabase().from('running_costs').select(ALL),
    supabase().from('tax_years').select(ALL),
  ])
  if (costs.error !== null) fail('Fetching the running costs', costs.error)
  if (years.error !== null) fail('Fetching the tax years', years.error)
  return { costs: costs.data as unknown[], years: years.data as unknown[] }
}

/** Every Vehicle cost rate this account has, whole: a handful of rows, one
 *  per Vehicle per date it changed. */
export async function supabaseVehicleCostRates(): Promise<unknown[]> {
  const response = await supabase().from('vehicle_cost_rates').select(ALL)
  if (response.error !== null) fail('Fetching the vehicle cost rates', response.error)
  return response.data as unknown[]
}

/**
 * The settings writes.
 *
 * Both are upserts on their key, because a setting either exists or does not
 * and there is exactly one of it. Nothing here needs a version check yet: the
 * shape says one row, so a second write replaces rather than duplicates. When
 * step 7 gives conflicts an interface, this is where the check goes.
 */
export function supabaseSettingsWriter() {
  return {
    async saveTaxYear(values: Record<string, number | string>) {
      const response = await supabase()
        .from('tax_years')
        .upsert(values, { onConflict: 'owner,tax_year' })
        .select(ALL)
        .single()
      if (response.error !== null) fail("Writing the year's figures", response.error)
      return response.data as unknown
    },
    async saveCosts(values: {
      area_id: string
      fuel_per_km: number
      vehicle_per_km: number
    }) {
      const response = await supabase()
        .from('running_costs')
        .upsert(values, { onConflict: 'area_id' })
        .select(ALL)
        .single()
      if (response.error !== null) fail('Writing the running costs', response.error)
      return response.data as unknown
    },
    /** The trigger's own cache, not the screen's — nothing here reads it back.
     *  `deleted_at` is always sent as `null`: an upsert only updates the
     *  columns it names, so a rate previously invalidated by
     *  `clearVehicleFuelRate` would otherwise stay soft-deleted forever —
     *  reactivated by name here, never left to whatever it was before. */
    async saveVehicleFuelRate(values: { vehicle_item_id: string; fuel_per_km: number }) {
      const response = await supabase()
        .from('vehicle_fuel_rates')
        .upsert({ ...values, deleted_at: null }, { onConflict: 'vehicle_item_id' })
        .select(ALL)
        .single()
      if (response.error !== null) fail('Writing the vehicle fuel rate', response.error)
      return response.data as unknown
    },
    /** Invalidates a Vehicle's cached fuel rate — soft-deleted, not deleted
     *  outright, the same rule every other row in this schema follows, so a
     *  rate that has become unknowable stops being pinned onto new Draft
     *  writes instead of quietly staying available and wrong. */
    async clearVehicleFuelRate(vehicle_item_id: string) {
      const response = await supabase()
        .from('vehicle_fuel_rates')
        .update({ deleted_at: new Date().toISOString() })
        .eq('vehicle_item_id', vehicle_item_id)
      if (response.error !== null) fail('Clearing the vehicle fuel rate', response.error)
    },
    /** A new dated row: history, not an overwrite — see vehicle-cost.ts. */
    async saveVehicleCostRate(values: {
      vehicle_item_id: string
      effective_from: string
      vehicle_per_km: number
    }) {
      const response = await supabase()
        .from('vehicle_cost_rates')
        .upsert(values, { onConflict: 'vehicle_item_id,effective_from' })
        .select(ALL)
        .single()
      if (response.error !== null) fail('Writing the vehicle cost rate', response.error)
      return response.data as unknown
    },
  }
}
