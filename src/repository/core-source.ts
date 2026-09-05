// Where the core's two tables talk to Supabase.
//
// Apart from source.ts because that file hit the 300-line limit the structure
// checker enforces, and the split falls naturally: everything here belongs to
// entities and links, and nothing else reads them.

import { ALL, fail } from './source'
import { supabase } from './supabase'

/** Every thing and every arrow, whole: both ride their anchors. */
export async function supabaseCore(): Promise<{
  entities: unknown[]
  links: unknown[]
}> {
  const [entities, links] = await Promise.all([
    supabase().from('entities').select(ALL),
    supabase().from('links').select(ALL).order('created_at', { ascending: true }),
  ])
  for (const [what, response] of [
    ['Fetching the things', entities],
    ['Fetching the links', links],
  ] as const) {
    if (response.error !== null) fail(what, response.error)
  }
  return {
    entities: entities.data as unknown[],
    links: links.data as unknown[],
  }
}

export function supabaseEntityWriter(owner: string) {
  return {
    async save(values: Record<string, unknown>) {
      const response = await supabase()
        .from('entities')
        .upsert(values, { onConflict: 'item_id' })
        .select(ALL)
        .single()
      if (response.error !== null) fail('Writing the thing', response.error)
      return response.data as unknown
    },
    async remove(item_id: string) {
      const response = await supabase()
        .from('entities')
        .delete()
        .eq('item_id', item_id)
        .eq('owner', owner)
      if (response.error !== null) fail('Removing the thing', response.error)
    },
  }
}

/**
 * The arrows. Made and unmade, never edited — so there is no upsert here, and
 * the table grants no UPDATE at all.
 */
export function supabaseLinkWriter(owner: string) {
  return {
    async add(values: { from_id: string; to_id: string; kind: string }) {
      const response = await supabase().from('links').insert(values).select(ALL).single()
      if (response.error !== null) fail('Drawing the link', response.error)
      return response.data as unknown
    },
    async remove(id: string) {
      const response = await supabase().from('links').delete().eq('id', id).eq('owner', owner)
      if (response.error !== null) fail('Removing the link', response.error)
    },
  }
}
