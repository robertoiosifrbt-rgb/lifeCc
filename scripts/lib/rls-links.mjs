/**
 * The arrows: `links`, the table law 2 asked for on the first day and nothing
 * built until the core arrived.
 *
 * Its own file rather than a section of rls-upsert.mjs, which hit the 300-line
 * limit — and the split is the honest one anyway: a link is never upserted.
 * It is made and unmade, so there is no SET list to get wrong. What can go
 * wrong is an arrow reaching across two accounts, and an arrow that stamps one
 * end and not the other.
 */

import { A, B, DENIED } from './rls-context.mjs'

/** Refusal: a composite key with nothing to point at. */
const FOREIGN_KEY = '23503'

/** An anchor of some kind owned by someone, made by the administrator. */
async function anchorOwnedBy(t, owner, kind) {
  const { rows } = await t.q(
    `insert into public.items (owner, title, kind, state, due)
     values ($1, $2, $3, 'active', current_date) returning id`,
    [owner, kind, kind],
  )
  return rows[0].id
}

/**
 * The arrows, which are not upserted and never edited.
 *
 * Their own cases rather than a row in the table above: a link is made and
 * unmade, so there is no SET list to get wrong — what can go wrong is an arrow
 * reaching across two accounts, and that is what these check.
 */
export const CASES = [
  {
    group: 'negative',
    name: 'A cannot draw an arrow to one of B’s items',
    run: async (t) => {
      const mine = await anchorOwnedBy(t, A, 'task')
      const theirs = await anchorOwnedBy(t, B, 'task')
      // Refused by the composite key, not by the policy: the row would carry A
      // as its owner, so `owner = auth.uid()` is satisfied and RLS lets it by.
      // The key to (id, owner) is what cannot be spelled.
      await t.asA(() =>
        t.denied(
          FOREIGN_KEY,
          'insert into public.links (from_id, to_id, kind) values ($1, $2, $3)',
          [mine, theirs, 'about'],
        ),
      )
    },
  },
  {
    group: 'negative',
    name: 'an arrow cannot be edited into a different arrow',
    run: async (t) => {
      const one = await anchorOwnedBy(t, A, 'task')
      const other = await anchorOwnedBy(t, A, 'entity')
      const third = await anchorOwnedBy(t, A, 'entity')
      await t.asA(async () => {
        await t.q(
          'insert into public.links (from_id, to_id, kind) values ($1, $2, $3)',
          [one, other, 'about'],
        )
        // No UPDATE grant at all on this table, so both ends and the kind are
        // beyond reach. Changing any of them would make it a different arrow
        // wearing the same id.
        for (const [column, value] of [
          ['to_id', third],
          ['kind', 'pays'],
        ]) {
          await t.denied(DENIED, `update public.links set ${column} = $1`, [value])
        }
      })
    },
  },
  {
    group: 'positive',
    name: 'A joins its own task to its own car, from both ends',
    run: async (t) => {
      const renewal = await anchorOwnedBy(t, A, 'task')
      const car = await anchorOwnedBy(t, A, 'entity')
      await t.asA(async () => {
        const before = await t.q('select version from public.items where id = $1', [car])
        await t.q(
          'insert into public.links (from_id, to_id, kind) values ($1, $2, $3)',
          [renewal, car, 'about'],
        )
        // Both anchors are stamped, not just the one the arrow starts at: an
        // arrow that moved only one version reaches the other device on one
        // side and not the other, and half an arrow is worse than none.
        for (const [id, what] of [
          [renewal, 'the task'],
          [car, 'the car'],
        ]) {
          const after = await t.q('select version from public.items where id = $1', [id])
          t.require(after.rows[0].version > 1, `${what} was not stamped by the link`)
        }
        t.require(before.rows[0].version === 1, 'the car did not start at version 1')

        const seen = await t.q(
          'select count(*)::int as n from public.links where from_id = $1 or to_id = $1',
          [car],
        )
        t.require(seen.rows[0].n === 1, `the car sees ${seen.rows[0].n} arrows`)
      })
    },
  },
]
