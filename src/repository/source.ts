// The only place that actually talks to Supabase.
//
// The rest of the repository works against the Source and Writer interfaces,
// so the sync and write logic can be checked without a network.

import { supabase } from './supabase'
import type { Source } from './sync'
import type { Writer } from './write'

/** Every column. Shared with core-source.ts, which was split off at the limit. */
export const ALL = '*'

export function fail(operation: string, error: { message: string }): never {
  throw new Error(`${operation}: ${error.message}`)
}

/**
 * The user's rows, paginated.
 *
 * It fetches the rows with deleted_at as well — that is why we keep them:
 * without them, an item deleted on the phone would stay forever in the
 * laptop's cache.
 */
export function supabaseSource(table: string): Source {
  return {
    async page({ from, to, sinceCursor }) {
      let query = supabase()
        .from(table)
        .select(ALL)
        // A stable order, otherwise pagination can skip or repeat rows.
        .order('id', { ascending: true })
        .range(from, to)

      if (sinceCursor !== null) {
        // Inclusive on purpose: the upsert is idempotent, so a row fetched
        // twice breaks nothing, and this way a second change sharing an
        // updated_at is not lost.
        query = query.gte('updated_at', sinceCursor)
      }

      // Without types generated from the schema, PostgREST returns `any`. It
      // goes through `unknown` on purpose: the only thing that validates a row
      // is fromRow.
      const response = await query
      if (response.error !== null) fail('Fetching rows', response.error)
      return response.data as unknown[]
    },
  }
}

/**
 * The writes, row by row.
 *
 * `owner` is put in the conditions as well, even though the RLS policy already
 * enforces it: if the policy were ever wrong, the condition still stands.
 */
export function supabaseWriter<P extends object>(
  table: string,
  owner: string,
): Writer<P> {
  return {
    async insert(values) {
      const response = await supabase()
        .from(table)
        .insert(values)
        .select(ALL)
        .single()
      if (response.error !== null) fail('Writing the new row', response.error)
      return response.data as unknown
    },

    async update(id: string, version: number, patch: P) {
      // update <table> set <patch>
      // where id = :id and owner = auth.uid() and version = :version
      const response = await supabase()
        .from(table)
        .update(patch)
        .eq('id', id)
        .eq('owner', owner)
        .eq('version', version)
        .select(ALL)
      if (response.error !== null) fail('Updating the row', response.error)
      return response.data as unknown[]
    },

    /**
     * The row as it is now, for the one retry.
     *
     * A deleted row is not found on purpose. Deleting is a soft delete, so the
     * row is still in the table — and without this the retry re-reads it,
     * writes the patch over it, and reports success, while deleted_at stays
     * set and every screen keeps hiding it. You would be told it saved, and
     * the thing would be nowhere. applyPatch already has the honest answer for
     * a row that is gone: it stops with "That row is not there any more."
     */
    async read(id: string) {
      const response = await supabase()
        .from(table)
        .select(ALL)
        .eq('id', id)
        .eq('owner', owner)
        .is('deleted_at', null)
        .maybeSingle()
      if (response.error !== null) fail('Re-reading the row', response.error)
      return response.data as unknown
    },
  }
}

/**
 * Every shift part this account has, in three requests.
 *
 * Not filtered to what changed. The parts carry no version and no updated_at
 * of their own — the anchor holds the news — so there is nothing to ask them
 * "since when", and asking per anchor would be one request per shift. Three
 * requests for the lot is the honest reading of a table with no cursor.
 */
export async function supabaseShiftParts(): Promise<{
  shifts: unknown[]
  sessions: unknown[]
  earnings: unknown[]
}> {
  const [shifts, sessions, earnings] = await Promise.all([
    supabase().from('shifts').select(ALL),
    supabase().from('shift_sessions').select(ALL).order('started_at', { ascending: true }),
    supabase().from('shift_earnings').select(ALL),
  ])
  for (const [what, response] of [
    ['Fetching the shifts', shifts],
    ['Fetching the sessions', sessions],
    ['Fetching the earnings', earnings],
  ] as const) {
    if (response.error !== null) fail(what, response.error)
  }
  return {
    shifts: shifts.data as unknown[],
    sessions: sessions.data as unknown[],
    earnings: earnings.data as unknown[],
  }
}

/** The writes for a shift's parts. Three tables, one owner condition each. */
export function supabaseShiftWriter(owner: string) {
  const on = (table: string) => supabase().from(table)
  return {
    async upsertShift(values: Record<string, unknown>) {
      const response = await on('shifts').upsert(values).select(ALL).single()
      if (response.error !== null) fail('Writing the shift', response.error)
      return response.data as unknown
    },
    async addSession(values: Record<string, unknown>) {
      const response = await on('shift_sessions').insert(values).select(ALL).single()
      if (response.error !== null) fail('Writing the session', response.error)
      return response.data as unknown
    },
    async endSession(id: string, ended_at: string) {
      const response = await on('shift_sessions')
        .update({ ended_at })
        .eq('id', id)
        .eq('owner', owner)
        .select(ALL)
        .single()
      if (response.error !== null) fail('Closing the session', response.error)
      return response.data as unknown
    },
    async setBreak(id: string, break_minutes: number) {
      const response = await on('shift_sessions')
        .update({ break_minutes })
        .eq('id', id)
        .eq('owner', owner)
        .select(ALL)
        .single()
      if (response.error !== null) fail('Writing the break', response.error)
      return response.data as unknown
    },
    async removeSession(id: string) {
      const response = await on('shift_sessions').delete().eq('id', id).eq('owner', owner)
      if (response.error !== null) fail('Removing the session', response.error)
    },
    async setEarning(values: Record<string, unknown>) {
      const response = await on('shift_earnings').upsert(values).select(ALL).single()
      if (response.error !== null) fail('Writing what a platform paid', response.error)
      return response.data as unknown
    },
  }
}

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
  }
}

/** Every expense of this account, whole: they ride their anchors. */
export async function supabaseExpenses(): Promise<unknown[]> {
  const response = await supabase().from('expenses').select(ALL)
  if (response.error !== null) fail('Fetching the expenses', response.error)
  return response.data as unknown[]
}

export function supabaseExpenseWriter(owner: string) {
  return {
    async save(values: Record<string, unknown>) {
      const response = await supabase()
        .from('expenses')
        .upsert(values, { onConflict: 'item_id' })
        .select(ALL)
        .single()
      if (response.error !== null) fail('Writing the expense', response.error)
      return response.data as unknown
    },
    async remove(item_id: string) {
      const response = await supabase()
        .from('expenses')
        .delete()
        .eq('item_id', item_id)
        .eq('owner', owner)
      if (response.error !== null) fail('Removing the expense', response.error)
    },
  }
}

/** Every journal entry of this account, whole: it rides its anchor. */
export async function supabaseJournal(): Promise<unknown[]> {
  const response = await supabase().from('journal_entries').select(ALL)
  if (response.error !== null) fail('Fetching the journal', response.error)
  return response.data as unknown[]
}

/** The journal's one write: made and edited alike, both are the whole row. */
export function supabaseJournalWriter() {
  return {
    async save(values: Record<string, unknown>) {
      const response = await supabase()
        .from('journal_entries')
        .upsert(values, { onConflict: 'item_id' })
        .select(ALL)
        .single()
      if (response.error !== null) fail('Writing the journal entry', response.error)
      return response.data as unknown
    },
  }
}
