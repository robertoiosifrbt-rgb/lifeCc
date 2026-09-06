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
    /** The trigger's own cache, not the screen's — nothing here reads it back. */
    async saveVehicleFuelRate(values: { vehicle_item_id: string; fuel_per_km: number }) {
      const response = await supabase()
        .from('vehicle_fuel_rates')
        .upsert(values, { onConflict: 'vehicle_item_id' })
        .select(ALL)
        .single()
      if (response.error !== null) fail('Writing the vehicle fuel rate', response.error)
      return response.data as unknown
    },
  }
}
