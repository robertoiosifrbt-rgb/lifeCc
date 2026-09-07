/**
 * `save_workday`'s own input guards — split out of `rls-save-workday.mjs`
 * at the 300-line limit. That file proves the one-transaction shape (a
 * refusal partway through leaves nothing behind); these cases prove the
 * function refuses a payload that names the wrong kind of anchor at all,
 * rather than silently writing something incoherent — D1 audit round 3,
 * findings #7 and #14.
 */

import { A, DENIED } from './rls-context.mjs'

async function shiftOwnedBy(t, owner) {
  const { rows } = await t.q(
    `insert into public.items (owner, title, kind, state, due)
     values ($1, 'Shift', 'shift', 'active', current_date) returning id`,
    [owner],
  )
  return rows[0].id
}

async function taskOwnedBy(t, owner) {
  const { rows } = await t.q(
    `insert into public.items (owner, title, kind, state) values ($1, 'Errand', 'task', 'active') returning id`,
    [owner],
  )
  return rows[0].id
}

const EMPTY_PAYLOAD = {
  item_patch: {},
  expected_version: 1,
  force_shift_touch: false,
  vehicle_unlink_ids: [],
  vehicle_link_to: null,
  shift_patch: {},
  earnings_set: [],
  earnings_remove: [],
  platform_earnings_set: [],
  platform_earnings_remove: [],
  breaks_set: [],
  sessions_remove: [],
  road_cost_set: [],
  road_cost_remove: [],
}

export const CASES = [
  {
    group: 'negative',
    // D1 audit round 3, finding #14: ownership alone (the FK on `shifts`)
    // was never enough — the caller's own Task, just the wrong kind of
    // anchor, must be refused too, or this function would happily attach a
    // shift row to it.
    name: 'save_workday refuses an item that is not a Workday at all',
    run: async (t) => {
      const taskId = await taskOwnedBy(t, A)
      const payload = { ...EMPTY_PAYLOAD, item_id: taskId, force_shift_touch: true }
      await t.asA(() => t.denied(DENIED, 'select public.save_workday($1::jsonb)', [JSON.stringify(payload)]))

      const shift = await t.q('select 1 from public.shifts where item_id = $1', [taskId])
      t.require(shift.rows.length === 0, 'a shift row was attached to a non-shift anchor')
    },
  },
  {
    group: 'negative',
    // Same finding: a Vehicle link that never resolves to a Vehicle is not
    // caught by `pin_shift_rates()` failing to pin a rate from it — it is
    // caught here, before the link is ever written.
    name: 'save_workday refuses a vehicle_link_to that does not name a real Vehicle',
    run: async (t) => {
      const shiftId = await shiftOwnedBy(t, A)
      const notAVehicle = await taskOwnedBy(t, A)
      const payload = { ...EMPTY_PAYLOAD, item_id: shiftId, vehicle_link_to: notAVehicle }
      await t.asA(() => t.denied(DENIED, 'select public.save_workday($1::jsonb)', [JSON.stringify(payload)]))

      const link = await t.q(
        "select 1 from public.links where from_id = $1 and to_id = $2 and kind = 'uses'",
        [shiftId, notAVehicle],
      )
      t.require(link.rows.length === 0, 'a Vehicle link was written to a non-Vehicle item')
    },
  },
  {
    group: 'writing',
    // D1 audit round 3, finding #7: an existing road-cost Expense's own
    // `due` used to be ignored once it already existed — only a brand new
    // one ever got a day. A Workday's date moving must bring its already-
    // linked Expense along, even when the amount itself is unchanged (the
    // client sends a same-amount refresh entry for exactly this case).
    name: "save_workday brings an existing road-cost Expense's day along when the Workday's own date moves",
    run: async (t) => {
      const shiftId = await shiftOwnedBy(t, A)
      const setupPayload = {
        ...EMPTY_PAYLOAD,
        item_id: shiftId,
        road_cost_set: [
          { category: 'parking', title: 'Parking', day: '2026-09-05', amount: 5, existing_expense_item_id: null },
        ],
      }
      await t.asA(() => t.q('select public.save_workday($1::jsonb)', [JSON.stringify(setupPayload)]))
      const { rows } = await t.q(
        `select e.item_id from public.expenses e
           join public.links l on l.from_id = e.item_id and l.kind = 'about'
         where l.to_id = $1`,
        [shiftId],
      )
      const expenseId = rows[0].item_id

      const movePayload = {
        ...EMPTY_PAYLOAD,
        item_id: shiftId,
        item_patch: { due: '2026-09-20' },
        expected_version: (await t.q('select version from public.items where id = $1', [shiftId])).rows[0].version,
        // Same amount, only the day moves — exactly what roadCostDayRefreshOf sends.
        road_cost_set: [
          { category: 'parking', title: 'Parking', day: '2026-09-20', amount: 5, existing_expense_item_id: expenseId },
        ],
      }
      await t.asA(() => t.q('select public.save_workday($1::jsonb)', [JSON.stringify(movePayload)]))

      const after = await t.q('select due from public.items where id = $1', [expenseId])
      t.require(
        new Date(after.rows[0].due).toISOString().slice(0, 10) === '2026-09-20',
        "the Expense's own day did not follow the Workday's new date",
      )
    },
  },
]
