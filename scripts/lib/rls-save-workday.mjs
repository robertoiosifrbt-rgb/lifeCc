/**
 * `save_workday`, the Postgres function behind Save draft/Complete Workday:
 * one call is meant to replace up to nine separate ones, so what these
 * cases prove is not "does one field land" (every other file here already
 * covers each table on its own) but the two things unique to a single
 * transaction — everything in the payload lands together, and a refused
 * part leaves nothing written rather than the first half of it.
 */

import { A, B, CONSTRAINT, DENIED } from './rls-context.mjs'

/** Refusal: a composite key with nothing to point at. */
const FOREIGN_KEY = '23503'

async function shiftOwnedBy(t, owner) {
  const { rows } = await t.q(
    `insert into public.items (owner, title, kind, state, due)
     values ($1, 'Shift', 'shift', 'active', current_date) returning id`,
    [owner],
  )
  return rows[0].id
}

async function vehicleOwnedBy(t, owner) {
  const { rows } = await t.q(
    `insert into public.items (owner, title, kind, state) values ($1, 'Car', 'entity', 'active') returning id`,
    [owner],
  )
  const vehicleId = rows[0].id
  await t.q("insert into public.entities (item_id, owner, entity_kind) values ($1, $2, 'vehicle')", [
    vehicleId,
    owner,
  ])
  return vehicleId
}

const EMPTY_PAYLOAD = {
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
    group: 'writing',
    // The anchors are made by the administrator, exactly like every other
    // case's "data that already exists" — only the statement under test
    // runs as A, the same split `rls-upsert.mjs`'s own cases already use.
    name: 'save_workday writes the shift, an earning, the Vehicle link and a road-cost Expense together, in one call',
    run: async (t) => {
      const shiftId = await shiftOwnedBy(t, A)
      const vehicleId = await vehicleOwnedBy(t, A)
      const payload = {
        ...EMPTY_PAYLOAD,
        item_id: shiftId,
        vehicle_link_to: vehicleId,
        shift_patch: { tips: 12.5 },
        earnings_set: [{ platform: 'uber_eats', amount: 20 }],
        road_cost_set: [
          { category: 'parking', title: 'Parking', day: '2026-09-05', amount: 5, existing_expense_item_id: null },
        ],
      }
      await t.asA(() => t.q('select public.save_workday($1::jsonb)', [JSON.stringify(payload)]))

      const shift = await t.q('select tips from public.shifts where item_id = $1', [shiftId])
      t.require(Number(shift.rows[0]?.tips) === 12.5, 'the shift patch did not land')

      const earning = await t.q(
        'select amount from public.shift_earnings where item_id = $1 and platform = $2',
        [shiftId, 'uber_eats'],
      )
      t.require(Number(earning.rows[0]?.amount) === 20, 'the earning did not land')

      const link = await t.q(
        "select 1 from public.links where from_id = $1 and to_id = $2 and kind = 'uses'",
        [shiftId, vehicleId],
      )
      t.require(link.rows.length === 1, 'the Vehicle link did not land')

      const expense = await t.q(
        `select e.amount, e.category from public.expenses e
           join public.links l on l.from_id = e.item_id and l.kind = 'about'
         where l.to_id = $1`,
        [shiftId],
      )
      t.require(
        expense.rows.length === 1 && Number(expense.rows[0].amount) === 5 && expense.rows[0].category === 'parking',
        'the road-cost Expense did not land',
      )
    },
  },
  {
    group: 'negative',
    // The whole point of one function call over nine separate ones: a
    // refusal partway through must leave nothing behind, not the shift
    // patch that happened to run first.
    name: 'save_workday leaves nothing written when one part of the payload is refused',
    run: async (t) => {
      const shiftId = await shiftOwnedBy(t, A)
      const payload = {
        ...EMPTY_PAYLOAD,
        item_id: shiftId,
        shift_patch: { tips: 99 },
        // Not one of the three real platforms — refused by
        // `shift_earnings_platform`, after the shift patch above would
        // already have run if this were nine separate calls.
        earnings_set: [{ platform: 'not_a_real_platform', amount: 1 }],
      }
      await t.asA(() =>
        t.denied(CONSTRAINT, 'select public.save_workday($1::jsonb)', [JSON.stringify(payload)]),
      )

      const shift = await t.q('select tips from public.shifts where item_id = $1', [shiftId])
      t.require(shift.rows.length === 0, 'the shift row was written despite the refusal')
    },
  },
  {
    group: 'negative',
    name: 'save_workday cannot touch a shift owned by somebody else',
    run: async (t) => {
      const theirs = await shiftOwnedBy(t, B)
      const payload = { ...EMPTY_PAYLOAD, item_id: theirs, force_shift_touch: true }
      await t.asA(() =>
        t.denied(FOREIGN_KEY, 'select public.save_workday($1::jsonb)', [JSON.stringify(payload)]),
      )
    },
  },
  {
    group: 'negative',
    // Same owner on both Workdays, unlike the case above — RLS alone would
    // let this through. The payload names a link id that is real and A's
    // own, just not this Workday's, which only an item_id-scoped delete
    // catches.
    name: "save_workday cannot unlink a Vehicle link belonging to a different Workday of the same owner",
    run: async (t) => {
      const ownWorkday = await shiftOwnedBy(t, A)
      const otherWorkday = await shiftOwnedBy(t, A)
      const vehicleId = await vehicleOwnedBy(t, A)
      const { rows } = await t.q(
        "insert into public.links (from_id, to_id, kind, owner) values ($1, $2, 'uses', $3) returning id",
        [otherWorkday, vehicleId, A],
      )
      const otherWorkdaysLinkId = rows[0].id

      const payload = { ...EMPTY_PAYLOAD, item_id: ownWorkday, vehicle_unlink_ids: [otherWorkdaysLinkId] }
      await t.asA(() => t.q('select public.save_workday($1::jsonb)', [JSON.stringify(payload)]))

      const stillThere = await t.q('select 1 from public.links where id = $1', [otherWorkdaysLinkId])
      t.require(stillThere.rows.length === 1, "the other Workday's Vehicle link was removed")
    },
  },
  {
    group: 'negative',
    name: 'save_workday refuses a road-cost expense id that belongs to a different Workday',
    run: async (t) => {
      const otherWorkday = await shiftOwnedBy(t, A)
      const setupPayload = {
        ...EMPTY_PAYLOAD,
        item_id: otherWorkday,
        road_cost_set: [
          { category: 'parking', title: 'Parking', day: '2026-09-05', amount: 5, existing_expense_item_id: null },
        ],
      }
      await t.asA(() => t.q('select public.save_workday($1::jsonb)', [JSON.stringify(setupPayload)]))
      const { rows } = await t.q(
        `select e.item_id from public.expenses e
           join public.links l on l.from_id = e.item_id and l.kind = 'about'
         where l.to_id = $1`,
        [otherWorkday],
      )
      const othersExpenseId = rows[0].item_id

      const ownWorkday = await shiftOwnedBy(t, A)
      const attackPayload = {
        ...EMPTY_PAYLOAD,
        item_id: ownWorkday,
        road_cost_set: [
          {
            category: 'parking',
            title: 'Parking',
            day: '2026-09-05',
            amount: 999,
            existing_expense_item_id: othersExpenseId,
          },
        ],
      }
      await t.asA(() =>
        t.denied(DENIED, 'select public.save_workday($1::jsonb)', [JSON.stringify(attackPayload)]),
      )

      const untouched = await t.q('select amount from public.expenses where item_id = $1', [othersExpenseId])
      t.require(Number(untouched.rows[0].amount) === 5, "the other Workday's Expense was rewritten")
    },
  },
]
