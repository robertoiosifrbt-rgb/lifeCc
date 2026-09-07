/**
 * The cases for expenses: money out, on the day it went out.
 *
 * What is checked beyond the isolation is the one rule that keeps the numbers
 * honest — the pump details belong to a fuel purchase and to nothing else. An
 * insurance premium carrying an odometer reading is a row that would quietly
 * join the fuel legs and move the rate.
 */

import { A, B, CONSTRAINT, DENIED } from './rls-context.mjs'

const FOREIGN_KEY = '23503'

async function expenseAnchor(t, owner, day = 'current_date') {
  const { rows } = await t.q(
    `insert into public.items (owner, title, kind, state, due)
     values ($1, 'Fuel', 'expense', 'active', ${day}) returning id`,
    [owner],
  )
  return rows[0].id
}

/** A road-cost Expense already linked `about` a Completed (done) Workday of
 *  its own owner — set up directly as the administrator, the shape
 *  `save_workday`'s own road-cost writes leave behind. */
async function completedWorkdayExpense(t, owner) {
  // Built the way save_workday's own writes leave it: the Expense and its
  // `about` link land while the shift is still active — the guard under
  // test would refuse them otherwise — and only then does the shift itself
  // move to done, the same order Complete Workday's own two-call sequence
  // already runs in (save_workday, then the item patch to state='done').
  const { rows: shiftRows } = await t.q(
    `insert into public.items (owner, title, kind, state, due)
     values ($1, 'Shift', 'shift', 'active', current_date) returning id`,
    [owner],
  )
  const shiftId = shiftRows[0].id
  const { rows: expenseRows } = await t.q(
    `insert into public.items (owner, title, kind, state, due)
     values ($1, 'Parking', 'expense', 'active', current_date) returning id`,
    [owner],
  )
  const expenseId = expenseRows[0].id
  await t.q(
    "insert into public.expenses (item_id, owner, amount, category, business_pct) values ($1, $2, 5, 'parking', 100)",
    [expenseId, owner],
  )
  await t.q("insert into public.links (from_id, to_id, kind, owner) values ($1, $2, 'about', $3)", [
    expenseId,
    shiftId,
    owner,
  ])
  await t.q("update public.items set state = 'done' where id = $1", [shiftId])
  return { shiftId, expenseId }
}

export const CASES = [
  {
    group: 'negative',
    name: 'an unauthenticated visitor cannot read the expenses',
    run: (t) => t.asAnon(() => t.denied(DENIED, 'select * from public.expenses')),
  },
  {
    group: 'negative',
    name: "A sees none of B's expenses, and cannot hang one on B's day",
    run: async (t) => {
      const spent = await expenseAnchor(t, B)
      await t.q(
        "insert into public.expenses (owner, item_id, amount, category) values ($1, $2, 70, 'fuel')",
        [B, spent],
      )
      // A second anchor of B's, with no expense on it: otherwise the primary
      // key refuses the insert before the composite key is ever consulted,
      // and the case would pass while proving something else.
      const bare = await expenseAnchor(t, B)
      await t.asA(async () => {
        const { rows } = await t.q('select item_id from public.expenses')
        t.require(rows.length === 0, `A saw ${rows.length} of B's expenses`)
        await t.denied(
          FOREIGN_KEY,
          "insert into public.expenses (item_id, amount, category) values ($1, 5, 'fuel')",
          [bare],
        )
      })
    },
  },
  {
    group: 'positive',
    name: 'A records a fill-up with its reading, and the anchor is stamped',
    run: (t) =>
      t.asA(async () => {
        const anchor = await t.q(
          `insert into public.items (title, kind, state, due)
           values ('Fuel', 'expense', 'active', current_date) returning id, version`,
        )
        const id = anchor.rows[0].id
        await t.q(
          `insert into public.expenses (item_id, amount, category, odo, full_tank)
           values ($1, 70.00, 'fuel', 120000.0, true)`,
          [id],
        )
        const after = await t.q('select version from public.items where id = $1', [id])
        t.require(after.rows[0].version === 2, 'the expense did not stamp its anchor')

        // Deleted outright, like a shift's parts: an expense is only ever
        // read as this anchor's, so removing it leaves nothing stranded.
        const gone = await t.q('delete from public.expenses where item_id = $1', [id])
        t.require(gone.rowCount === 1, `deleted ${gone.rowCount} rows, expected 1`)
      }),
  },
  {
    group: 'negative',
    name: "a Completed Workday's linked road-cost Expense cannot be updated or deleted, even by its own owner",
    run: async (t) => {
      const { expenseId } = await completedWorkdayExpense(t, A)
      await t.asA(async () => {
        await t.denied(DENIED, 'update public.expenses set amount = 999 where item_id = $1', [expenseId])
        await t.denied(DENIED, 'delete from public.expenses where item_id = $1', [expenseId])
      })
    },
  },
  {
    group: 'negative',
    name: "the `about` link from a Completed Workday's Expense cannot be severed",
    run: async (t) => {
      const { shiftId, expenseId } = await completedWorkdayExpense(t, A)
      await t.asA(() =>
        t.denied(
          DENIED,
          "delete from public.links where from_id = $1 and to_id = $2 and kind = 'about'",
          [expenseId, shiftId],
        ),
      )
    },
  },
  {
    group: 'constraint',
    name: 'the pump details belong to fuel, and to nothing else',
    run: (t) =>
      t.asA(async () => {
        const anchor = await t.q(
          `insert into public.items (title, kind, state, due)
           values ('Insurance', 'expense', 'active', current_date) returning id`,
        )
        const id = anchor.rows[0].id

        // An odometer on an insurance premium would join the fuel legs and
        // move the rate, from a row nobody would think to look at.
        await t.denied(
          CONSTRAINT,
          `insert into public.expenses (item_id, amount, category, odo)
           values ($1, 400, 'insurance', 120000.0)`,
          [id],
        )
        await t.denied(
          CONSTRAINT,
          `insert into public.expenses (item_id, amount, category, full_tank)
           values ($1, 400, 'insurance', true)`,
          [id],
        )
        await t.denied(
          CONSTRAINT,
          `insert into public.expenses (item_id, amount, category)
           values ($1, 400, 'bribe')`,
          [id],
        )
        await t.denied(
          CONSTRAINT,
          `insert into public.expenses (item_id, amount, category)
           values ($1, -5, 'other')`,
          [id],
        )
      }),
  },
]
