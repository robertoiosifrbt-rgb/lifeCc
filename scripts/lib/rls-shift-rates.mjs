/**
 * The driving-rate pinning cases: a Vehicle's fuel/cost-per-km rates,
 * written onto a shift by `pin_shift_rates()`, and only by it.
 *
 * Split out of rls-settings.mjs once it crossed the line limit — these are
 * all about the same trigger, so they read better together than mixed in
 * with tax-year and running-costs cases that share nothing with them.
 */

export const CASES = [
  {
    group: 'positive',
    name: 'the driving rates are pinned onto a shift, and a later change does not reach back',
    run: (t) =>
      t.asA(async () => {
        // Both rates are Vehicle-keyed since `pin_while_draft`/D1 — never
        // Area-keyed `running_costs`. A shift pins from whatever Vehicle its
        // own `uses` link resolves to (never the looser `about`, which a fuel
        // Expense or an unrelated mention could also carry), so the link has
        // to exist before the first write to `shifts` fires `pin_shift_rates()`.
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
        await t.q("insert into public.links (from_id, to_id, kind) values ($1, $2, 'uses')", [
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
    name: 'a Workday pins the rate in force on its own day, not on the day it is written',
    run: (t) =>
      t.asA(async () => {
        // A Workday typed up long after the day it is for must pin what the
        // rate actually was on that day — never whatever is current "now",
        // the moment of this write.
        const vehicleItem = await t.q(
          "insert into public.items (title, kind, state) values ('Car', 'entity', 'active') returning id",
        )
        const vehicleId = vehicleItem.rows[0].id
        await t.q("insert into public.entities (item_id, entity_kind) values ($1, 'vehicle')", [
          vehicleId,
        ])
        await t.q(
          `insert into public.vehicle_cost_rates (vehicle_item_id, effective_from, vehicle_per_km)
           values ($1, '2020-01-01', 0.05), ($1, current_date, 0.10)`,
          [vehicleId],
        )

        const anchor = await t.q(
          "insert into public.items (title, kind, state, due) values ('Shift', 'shift', 'active', '2020-06-01') returning id",
        )
        const id = anchor.rows[0].id
        await t.q("insert into public.links (from_id, to_id, kind) values ($1, $2, 'uses')", [
          id,
          vehicleId,
        ])
        await t.q('insert into public.shifts (item_id) values ($1)', [id])

        const pinned = await t.q(
          'select rate_vehicle_per_km from public.shifts where item_id = $1',
          [id],
        )
        t.require(
          Number(pinned.rows[0].rate_vehicle_per_km) === 0.05,
          `pinned ${pinned.rows[0].rate_vehicle_per_km}, the rate current today, not 0.05 which was in force on the Workday's own day`,
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
        await t.q("insert into public.links (from_id, to_id, kind) values ($1, $2, 'uses')", [
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
]
