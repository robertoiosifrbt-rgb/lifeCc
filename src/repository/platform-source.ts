// Where Platforms talk to Supabase — its own file for the same reason
// core-source.ts is: a table with no cursor of its own, read and written
// apart from the synced tables.

import { ALL, fail } from './source'
import { supabase } from './supabase'

/** Every Platform this account has, whole: it rides its anchor. */
export async function supabasePlatforms(): Promise<unknown[]> {
  const response = await supabase().from('platforms').select(ALL)
  if (response.error !== null) fail('Fetching the platforms', response.error)
  return response.data as unknown[]
}

/** Every Platform rule this account has ever set — every effective date,
 *  not just the current one. */
export async function supabasePlatformRules(): Promise<unknown[]> {
  const response = await supabase().from('platform_rules').select(ALL)
  if (response.error !== null) fail('Fetching the platform rules', response.error)
  return response.data as unknown[]
}

export function supabasePlatformWriter(owner: string) {
  return {
    async save(values: Record<string, unknown>) {
      const response = await supabase()
        .from('platforms')
        .upsert(values, { onConflict: 'item_id' })
        .select(ALL)
        .single()
      if (response.error !== null) fail('Writing the platform', response.error)
      return response.data as unknown
    },
    async remove(item_id: string) {
      const response = await supabase()
        .from('platforms')
        .delete()
        .eq('item_id', item_id)
        .eq('owner', owner)
      if (response.error !== null) fail('Removing the platform', response.error)
    },
  }
}

export function supabasePlatformRuleWriter(owner: string) {
  return {
    /** A new dated row: history, not an overwrite — see platform-record.ts. */
    async save(values: Record<string, unknown>) {
      const response = await supabase()
        .from('platform_rules')
        .upsert(values, { onConflict: 'platform_item_id,effective_from' })
        .select(ALL)
        .single()
      if (response.error !== null) fail('Writing the platform rule', response.error)
      return response.data as unknown
    },
    async remove(platform_item_id: string, effective_from: string) {
      const response = await supabase()
        .from('platform_rules')
        .update({ deleted_at: new Date().toISOString() })
        .eq('platform_item_id', platform_item_id)
        .eq('effective_from', effective_from)
        .eq('owner', owner)
      if (response.error !== null) fail('Removing the platform rule', response.error)
    },
  }
}
