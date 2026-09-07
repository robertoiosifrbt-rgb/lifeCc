/**
 * A Completed Workday's own anchor row, in `items` — the one place
 * Completed immutability was not yet enforced at the database boundary.
 * `shifts`/`shift_sessions`/`shift_earnings`/`links`/a linked road-cost
 * Expense already refuse a write once their shift is `done`; this is the
 * same refusal for the item itself (title/due/area_id/state/kind), found by
 * a live read-only check that `authenticated` could still rewrite every one
 * of them.
 */

import { A, DENIED } from './rls-context.mjs'

/**
 * Made by the administrator, active first and only then flipped to done —
 * the same order `completedWorkdayExpense` in rls-expenses.mjs uses, so the
 * guard under test (only fires once `old.state = 'done'`) never blocks the
 * setup itself.
 */
async function completedShift(t, owner) {
  const { rows: areaRows } = await t.q(
    'insert into public.areas (owner, name) values ($1, $2) returning id',
    [owner, 'Business'],
  )
  const { rows } = await t.q(
    `insert into public.items (owner, title, kind, state, due, area_id)
     values ($1, 'Shift', 'shift', 'active', current_date, $2) returning id`,
    [owner, areaRows[0].id],
  )
  const id = rows[0].id
  await t.q("update public.items set state = 'done' where id = $1", [id])
  return id
}

export const CASES = [
  {
    group: 'negative',
    name: "a Completed Workday's own title, due, area_id and state cannot be changed",
    run: async (t) => {
      const id = await completedShift(t, A)
      await t.asA(async () => {
        await t.denied(DENIED, "update public.items set title = 'Renamed' where id = $1", [id])
        await t.denied(DENIED, "update public.items set due = current_date + 1 where id = $1", [id])
        await t.denied(DENIED, 'update public.items set area_id = null where id = $1', [id])
        await t.denied(DENIED, "update public.items set state = 'active' where id = $1", [id])
      })
    },
  },
  {
    group: 'positive',
    name: 'a Completed Workday can still be soft-deleted, the same as a Draft one',
    run: async (t) => {
      const id = await completedShift(t, A)
      await t.q('update public.items set deleted_at = now() where id = $1', [id])
      const after = await t.q('select deleted_at from public.items where id = $1', [id])
      t.require(after.rows[0].deleted_at !== null, 'a Completed Workday could not be removed')
    },
  },
]
