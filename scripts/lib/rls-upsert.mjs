/**
 * The statement the client actually sends, on every table it writes.
 *
 * 📜 Every other case in this checker sends a plain INSERT. The app has never
 * sent one: `.upsert()` in supabase-js reaches the database as
 *
 *   insert into t (a, b, c) values (...)
 *   on conflict (key) do update set a = excluded.a, b = excluded.b, ...
 *
 * with the key columns in the SET list, because PostgREST puts every column of
 * the payload there. Those columns have no `grant update` on purpose, and
 * PostgreSQL checks the SET list's privileges whether or not a conflict
 * happens — so the whole delivery module shipped unable to save a single
 * number, and the checker was green throughout. It had verified the
 * neighbouring statement.
 *
 * These cases are the reason the file exists: same tables, same columns, the
 * shape the app sends. If a future table is written with `.upsert()` and is
 * not listed here, it is not checked.
 */

import { A, B, DENIED } from './rls-context.mjs'

/** Refusal: a composite key with nothing to point at. */
const FOREIGN_KEY = '23503'

/** Every figure `tax_years` demands, in the order the table declares them. */
const YEAR_FIGURES = {
  personal_allowance: 12570,
  taper_from: 100000,
  basic_band: 37700,
  higher_band_to: 125140,
  basic_pct: 20,
  higher_pct: 40,
  additional_pct: 45,
  dividend_allowance: 500,
  dividend_basic_pct: 8.75,
  dividend_higher_pct: 33.75,
  dividend_additional_pct: 39.35,
  class4_from: 12570,
  class4_to: 50270,
  class4_main_pct: 6,
  class4_upper_pct: 2,
  employment: 0,
  employment_tax_paid: 0,
  dividends: 0,
}

/**
 * The statement PostgREST builds for `.upsert(payload)`.
 *
 * Written out rather than approximated: the SET list is the whole point, and a
 * version of it that quietly left the key columns out would pass while the app
 * still failed.
 */
function upsertOf(table, payload, conflict) {
  const columns = Object.keys(payload)
  const holes = columns.map((_, i) => `$${i + 1}`).join(', ')
  const set = columns.map((column) => `${column} = excluded.${column}`).join(', ')
  return {
    sql: `insert into public.${table} (${columns.join(', ')}) values (${holes})
          on conflict (${conflict}) do update set ${set}`,
    params: Object.values(payload),
  }
}

/**
 * Runs a statement that is expected to go through, and returns what the
 * database said if it did not.
 *
 * The savepoint is not tidiness. Without it the refusal aborts the
 * transaction, the `reset role` on the way out of the role fails too, and the
 * failure this checker prints is "current transaction is aborted" — which
 * names neither the table nor the reason, and sends the next session looking
 * in the wrong place.
 */
async function attempt(t, label, sql, params) {
  await t.q('savepoint attempt')
  try {
    await t.q(sql, params)
    await t.q('release savepoint attempt')
    return null
  } catch (error) {
    await t.q('rollback to savepoint attempt')
    return `${label} refused it with ${error.code}: ${error.message}`
  }
}

/** An anchor of some kind owned by someone, made by the administrator. */
async function anchorOwnedBy(t, owner, kind) {
  const { rows } = await t.q(
    `insert into public.items (owner, title, kind, state, due)
     values ($1, $2, $3, 'active', current_date) returning id`,
    [owner, kind, kind],
  )
  return rows[0].id
}

async function areaOwnedBy(t, owner) {
  const { rows } = await t.q(
    'insert into public.areas (owner, name) values ($1, $2) returning id',
    [owner, 'Deliveries'],
  )
  return rows[0].id
}

/** Every table the app upserts, and a payload in the shape the app sends. */
async function payloads(t) {
  const shift = await anchorOwnedBy(t, A, 'shift')
  const expense = await anchorOwnedBy(t, A, 'expense')
  const area = await areaOwnedBy(t, A)
  return [
    {
      table: 'shifts',
      conflict: 'item_id',
      payload: { item_id: shift, odo_start: 100, odo_end: 200, tips: 5, personal_km: 3 },
      keys: { item_id: await anchorOwnedBy(t, A, 'shift') },
    },
    {
      table: 'shift_earnings',
      conflict: 'item_id, platform',
      payload: { item_id: shift, platform: 'uber_eats', amount: 20 },
      keys: { item_id: await anchorOwnedBy(t, A, 'shift'), platform: 'deliveroo' },
    },
    {
      table: 'expenses',
      conflict: 'item_id',
      payload: { item_id: expense, amount: 30, category: 'fuel', business_pct: 100 },
      keys: { item_id: await anchorOwnedBy(t, A, 'expense') },
    },
    {
      table: 'running_costs',
      conflict: 'area_id',
      payload: { area_id: area, fuel_per_km: 0.1, vehicle_per_km: 0.05 },
      keys: { area_id: await areaOwnedBy(t, A) },
    },
    {
      table: 'entities',
      conflict: 'item_id',
      payload: {
        item_id: await anchorOwnedBy(t, A, 'entity'),
        entity_kind: 'vehicle',
        registration: 'AB12 CDE',
        odo: 148230.0,
        mot_due: '2027-03-14',
      },
      keys: { item_id: await anchorOwnedBy(t, A, 'entity') },
    },
    {
      table: 'tax_years',
      conflict: 'owner, tax_year',
      payload: { tax_year: '2026/27', ...YEAR_FIGURES },
      keys: { tax_year: '2027/28' },
    },
    {
      table: 'platform_rules',
      conflict: 'platform_item_id, effective_from',
      payload: {
        platform_item_id: await anchorOwnedBy(t, A, 'platform'),
        effective_from: '2026-01-01',
        payout_schedule: 'weekly',
        cashout_enabled: true,
        cashout_fee_type: 'fixed',
        cashout_fee_value: 0.5,
      },
      keys: {
        platform_item_id: await anchorOwnedBy(t, A, 'platform'),
        effective_from: '2026-02-01',
      },
    },
  ]
}

export const CASES = [
  {
    group: 'writing',
    name: 'every table the app upserts accepts the statement the app sends',
    run: async (t) => {
      const refusals = []
      for (const { table, payload, conflict } of await payloads(t)) {
        const { sql, params } = upsertOf(table, payload, conflict)
        await t.asA(async () => {
          const refusal = await attempt(t, table, sql, params)
          if (refusal !== null) refusals.push(refusal)
        })
      }
      // All of them, not the first: when the grants are wrong they are usually
      // wrong everywhere, and a checker that stops at `shifts` hides the other
      // four until the next run.
      t.require(refusals.length === 0, refusals.join('; '))
    },
  },
  {
    group: 'writing',
    name: 'the second write lands on the same row, so DO UPDATE really runs',
    run: async (t) => {
      const refusals = []
      for (const { table, payload, conflict } of await payloads(t)) {
        const { sql, params } = upsertOf(table, payload, conflict)
        let written = 0
        await t.asA(async () => {
          if ((await attempt(t, table, sql, params)) !== null) return
          const refusal = await attempt(t, `${table}, second write`, sql, params)
          if (refusal !== null) refusals.push(refusal)
          const { rows } = await t.q(`select count(*)::int as n from public.${table}`)
          written = rows[0].n
        })
        if (written !== 1) refusals.push(`${table} holds ${written} rows after two writes`)
        await t.q(`delete from public.${table}`)
      }
      t.require(refusals.length === 0, refusals.join('; '))
    },
  },
  {
    group: 'negative',
    // The grant that lets the upsert name the key column would, on its own,
    // also let a client move a row onto another anchor — or onto another
    // person's. The trigger is what stops it, and this is what proves the
    // trigger is there.
    name: 'a key column cannot be moved, though UPDATE on it is granted',
    run: async (t) => {
      const refusals = []
      for (const { table, payload, conflict, keys } of await payloads(t)) {
        const { sql, params } = upsertOf(table, payload, conflict)
        await t.asA(async () => {
          // Through `attempt`, so that a table which cannot be written at all
          // says so instead of aborting the transaction and reporting nothing.
          const refusal = await attempt(t, table, sql, params)
          if (refusal !== null) {
            refusals.push(`${refusal} — nothing to try moving`)
            return
          }
          for (const [column, value] of Object.entries(keys)) {
            await t.denied(DENIED, `update public.${table} set ${column} = $1`, [value])
          }
        })
        await t.q(`delete from public.${table}`)
      }
      t.require(refusals.length === 0, refusals.join('; '))
    },
  },
  {
    group: 'negative',
    // Not the policy: the row would carry A as its owner, so `owner =
    // auth.uid()` is satisfied and RLS lets it by. What refuses it is the
    // composite key to `(id, owner)` — the plan's "mechanism that makes a link
    // between two people's rows structurally impossible". Written down with
    // the code it actually returns, because a case that expected 42501 here
    // would be red for the wrong reason and get 'fixed' by loosening the key.
    name: 'an upsert cannot land a row on somebody else’s anchor',
    run: async (t) => {
      const theirs = await anchorOwnedBy(t, B, 'shift')
      const { sql, params } = upsertOf(
        'shift_earnings',
        { item_id: theirs, platform: 'uber_eats', amount: 20 },
        'item_id, platform',
      )
      await t.asA(() => t.denied(FOREIGN_KEY, sql, params))
    },
  },
]
