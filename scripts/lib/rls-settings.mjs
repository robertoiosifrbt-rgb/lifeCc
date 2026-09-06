/**
 * The cases for the settings tables, and for the pinning they feed.
 *
 * The isolation matters here the way it does everywhere. What matters more is
 * that the rates on a shift are the database's to write: if a client can set
 * them, "pinned" means nothing, and a report can be made to say whatever the
 * person reading it wants.
 *
 * There were two settings until the year's own figures arrived. The
 * percentages went with them — what a day owes depends on where it lands in
 * the year, and a flat rate could not know that — so what is left is the cost
 * of driving, which does belong to a line of work, and the tax year, which
 * belongs to a person and to one April.
 */

import { A, B, CONSTRAINT, DENIED } from './rls-context.mjs'

const FOREIGN_KEY = '23503'

/** A whole tax year, since every figure in one is required. */
const YEAR_COLUMNS = `tax_year,
  personal_allowance, taper_from,
  basic_band, higher_band_to, basic_pct, higher_pct, additional_pct,
  dividend_allowance, dividend_basic_pct, dividend_higher_pct,
  dividend_additional_pct,
  class4_from, class4_to, class4_main_pct, class4_upper_pct`

const YEAR_VALUES = `$1, 12570, 100000, 37700, 125140, 20, 40, 45,
  500, 8.75, 33.75, 39.35, 12570, 50270, 6, 2`

async function areaOwnedBy(t, owner, name = 'MultiApp Delivery') {
  const { rows } = await t.q(
    'insert into public.areas (owner, name) values ($1, $2) returning id',
    [owner, name],
  )
  return rows[0].id
}

async function shiftIn(t, owner, area) {
  const { rows } = await t.q(
    `insert into public.items (owner, title, kind, state, due, area_id)
     values ($1, 'Shift', 'shift', 'active', current_date, $2) returning id`,
    [owner, area],
  )
  return rows[0].id
}

export const CASES = [
  // ── Negative ────────────────────────────────────────────────────────────
  {
    group: 'negative',
    name: 'an unauthenticated visitor cannot read the costs or the tax years',
    run: (t) =>
      t.asAnon(async () => {
        await t.denied(DENIED, 'select * from public.running_costs')
        await t.denied(DENIED, 'select * from public.tax_years')
      }),
  },
  {
    group: 'negative',
    name: "A sees none of B's tax years",
    run: async (t) => {
      await t.q(
        `insert into public.tax_years (owner, ${YEAR_COLUMNS})
         values ($2, ${YEAR_VALUES})`,
        ['2026/27', B],
      )
      await t.asA(async () => {
        const { rows } = await t.q('select owner from public.tax_years')
        t.require(rows.length === 0, `A saw ${rows.length} of B's tax years`)
      })
    },
  },
  {
    group: 'negative',
    name: "A cannot put running costs on B's area",
    run: async (t) => {
      const theirs = await areaOwnedBy(t, B)
      await t.asA(() =>
        t.denied(
          FOREIGN_KEY,
          `insert into public.running_costs (area_id, fuel_per_km, vehicle_per_km)
           values ($1, 0.116, 0.116)`,
          [theirs],
        ),
      )
    },
  },
  {
    group: 'negative',
    name: 'A cannot write the driving rates pinned on its own shift',
    run: async (t) => {
      const area = await areaOwnedBy(t, A)
      const anchor = await shiftIn(t, A, area)
      await t.q('insert into public.shifts (owner, item_id) values ($1, $2)', [A, anchor])
      await t.asA(async () => {
        for (const column of ['rate_fuel_per_km', 'rate_vehicle_per_km']) {
          // Pinned means pinned. A client that can set the rate can make a
          // report say anything, which is the one thing a report may not do.
          await t.denied(
            DENIED,
            `update public.shifts set ${column} = 1 where item_id = $1`,
            [anchor],
          )
        }
      })
    },
  },
  {
    group: 'negative',
    name: 'A cannot change which year one of its own tax years describes',
    run: async (t) => {
      await t.asA(async () => {
        await t.q(
          `insert into public.tax_years (${YEAR_COLUMNS}) values (${YEAR_VALUES})`,
          ['2026/27'],
        )
        // A row that could be re-labelled would take a settled bill with it.
        await t.denied(DENIED, "update public.tax_years set tax_year = '2027/28'")
      })
    },
  },

  // ── Positive ────────────────────────────────────────────────────────────
  {
    group: 'positive',
    name: 'the driving rates are pinned onto a shift, and a later change does not reach back',
    run: (t) =>
      t.asA(async () => {
        // Both rates are Vehicle-keyed since `pin_while_draft`/D1 — never
        // Area-keyed `running_costs`. A shift pins from whatever Vehicle its
        // own `about` link resolves to, so the link has to exist before the
        // first write to `shifts` fires `pin_shift_rates()`.
        const vehicleItem = await t.q(
          "insert into public.items (title, kind, state) values ('Car', 'entity', 'active') returning id",
        )
        const vehicleId = vehicleItem.rows[0].id
        await t.q("insert into public.entities (item_id, entity_kind) values ($1, 'vehicle')", [
          vehicleId,
        ])
        await t.q('insert into public.vehicle_fuel_rates (vehicle_item_id, fuel_per_km) values ($1, 0.116)', [
          vehicleId,
        ])
        await t.q(
          'insert into public.vehicle_cost_rates (vehicle_item_id, vehicle_per_km) values ($1, 0.05)',
          [vehicleId],
        )

        const anchor = await t.q(
          "insert into public.items (title, kind, state, due) values ('Shift', 'shift', 'active', current_date) returning id",
        )
        const id = anchor.rows[0].id
        await t.q("insert into public.links (from_id, to_id, kind) values ($1, $2, 'about')", [
          id,
          vehicleId,
        ])
        await t.q('insert into public.shifts (item_id) values ($1)', [id])

        const pinned = await t.q('select * from public.shifts where item_id = $1', [id])
        t.require(
          Number(pinned.rows[0].rate_fuel_per_km) === 0.116,
          'the fuel cost was not pinned',
        )

        // What a kilometre cost in October is history. Changing the Vehicle's
        // rate on its own touches no shift row — only a further write to
        // `shifts` re-pins, and this test makes none — so the earlier pin
        // must still stand.
        await t.q('update public.vehicle_fuel_rates set fuel_per_km = 0.2 where vehicle_item_id = $1', [
          vehicleId,
        ])
        const after = await t.q(
          'select rate_fuel_per_km from public.shifts where item_id = $1',
          [id],
        )
        t.require(
          Number(after.rows[0].rate_fuel_per_km) === 0.116,
          'a later change reached back into a finished shift',
        )
      }),
  },
  {
    group: 'positive',
    name: 'a shift written before the costs existed is pinned by the next write to it',
    run: (t) =>
      t.asA(async () => {
        const anchor = await t.q(
          "insert into public.items (title, kind, state, due) values ('Shift', 'shift', 'active', current_date) returning id",
        )
        const id = anchor.rows[0].id
        await t.q('insert into public.shifts (item_id) values ($1)', [id])

        const bare = await t.q(
          'select rate_fuel_per_km from public.shifts where item_id = $1',
          [id],
        )
        t.require(bare.rows[0].rate_fuel_per_km === null, 'it pinned a rate out of nowhere')

        const vehicleItem = await t.q(
          "insert into public.items (title, kind, state) values ('Car', 'entity', 'active') returning id",
        )
        const vehicleId = vehicleItem.rows[0].id
        await t.q("insert into public.entities (item_id, entity_kind) values ($1, 'vehicle')", [
          vehicleId,
        ])
        await t.q('insert into public.vehicle_fuel_rates (vehicle_item_id, fuel_per_km) values ($1, 0.116)', [
          vehicleId,
        ])
        await t.q("insert into public.links (from_id, to_id, kind) values ($1, $2, 'about')", [
          id,
          vehicleId,
        ])
        await t.q('update public.shifts set tips = 12.50 where item_id = $1', [id])

        const now = await t.q(
          'select rate_fuel_per_km from public.shifts where item_id = $1',
          [id],
        )
        t.require(
          Number(now.rows[0].rate_fuel_per_km) === 0.116,
          'the later write did not pin it',
        )
      }),
  },
  {
    group: 'positive',
    name: 'A keeps one row per April, and last year is left alone',
    run: (t) =>
      t.asA(async () => {
        for (const year of ['2026/27', '2027/28']) {
          await t.q(
            `insert into public.tax_years (${YEAR_COLUMNS}) values (${YEAR_VALUES})`,
            [year],
          )
        }
        // Setting up a new April must not rewrite a bill already worked out.
        await t.q("update public.tax_years set personal_allowance = 13000 where tax_year = '2027/28'")
        const { rows } = await t.q(
          "select personal_allowance from public.tax_years where tax_year = '2026/27'",
        )
        t.require(
          Number(rows[0].personal_allowance) === 12570,
          "last year's allowance moved when this year's was set",
        )
      }),
  },

  // ── Constraints ─────────────────────────────────────────────────────────
  {
    group: 'constraint',
    name: 'a tax year refuses a rate that is not a percentage, and a band that falls',
    run: (t) =>
      t.asA(async () => {
        await t.denied(
          CONSTRAINT,
          `insert into public.tax_years (${YEAR_COLUMNS}) values ($1, 12570, 100000,
             37700, 125140, 101, 40, 45, 500, 8.75, 33.75, 39.35, 12570, 50270, 6, 2)`,
          ['2026/27'],
        )
        // A band ending before it starts would tax a slice twice, or not at
        // all, depending on which way round it happened to be read.
        await t.denied(
          CONSTRAINT,
          `insert into public.tax_years (${YEAR_COLUMNS}) values ($1, 12570, 100000,
             37700, 1000, 20, 40, 45, 500, 8.75, 33.75, 39.35, 12570, 50270, 6, 2)`,
          ['2026/27'],
        )
        await t.denied(
          CONSTRAINT,
          `insert into public.tax_years (${YEAR_COLUMNS}) values ($1, 12570, 100000,
             37700, 125140, 20, 40, 45, 500, 8.75, 33.75, 39.35, 12570, 50270, 6, 2)`,
          ['twenty-six'],
        )
      }),
  },
]
