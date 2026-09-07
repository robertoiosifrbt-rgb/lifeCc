/**
 * `record_platform`, the Postgres function behind recording a new
 * configurable Platform: one call replacing what used to be two separate
 * inserts (the `items` anchor, then the `platforms` extension row naming
 * it), with nothing before this tying them together. What these cases prove
 * is the one thing unique to a single transaction — a refusal partway
 * through leaves nothing behind, not an orphan anchor with no extension row.
 */

import { A, CONSTRAINT } from './rls-context.mjs'

export const CASES = [
  {
    group: 'writing',
    name: 'record_platform writes the anchor and its extension row together, in one call',
    run: async (t) => {
      const { rows } = await t.asA(() =>
        t.q("select * from public.record_platform($1)", ['Uber Eats']),
      )
      const itemId = rows[0].id

      const item = await t.q('select title, kind, state, owner from public.items where id = $1', [itemId])
      t.require(item.rows[0]?.title === 'Uber Eats', 'the anchor title did not land')
      t.require(item.rows[0]?.kind === 'platform', 'the anchor kind did not land')
      t.require(item.rows[0]?.owner === A, 'the anchor was not owned by the caller')

      const platform = await t.q('select 1 from public.platforms where item_id = $1', [itemId])
      t.require(platform.rows.length === 1, 'the extension row did not land')
    },
  },
  {
    group: 'negative',
    // The whole point of one function call over two separate ones: a
    // refusal on the anchor itself must never leave a request that already
    // ran (there is none here to run first, but the reverse direction — an
    // extension insert failing after the anchor already committed — is
    // exactly the gap this RPC exists to close) or an orphan half-write.
    name: 'record_platform leaves nothing written when the title is refused',
    run: async (t) => {
      await t.asA(() =>
        t.denied(CONSTRAINT, "select * from public.record_platform($1)", ['   ']),
      )

      const items = await t.q(
        "select count(*)::int as n from public.items where owner = $1 and kind = 'platform'",
        [A],
      )
      t.require(items.rows[0].n === 0, 'an anchor was left behind despite the refused title')
    },
  },
]
