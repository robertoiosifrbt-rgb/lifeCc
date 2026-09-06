/**
 * The cases for the journal: freeform writing, anchored like everything else.
 *
 * What is checked beyond the isolation is the one rule that keeps an entry
 * honest — a body of nothing but whitespace is not an entry, whether or not
 * the person gave it a title, and every entry needs a real moment.
 */

import { B, CONSTRAINT, DENIED } from './rls-context.mjs'

const FOREIGN_KEY = '23503'
const NOT_NULL = '23502'

async function journalAnchor(t, owner) {
  const { rows } = await t.q(
    `insert into public.items (owner, title, kind, state)
     values ($1, 'A note to self', 'journal', 'active') returning id`,
    [owner],
  )
  return rows[0].id
}

export const CASES = [
  {
    group: 'negative',
    name: 'an unauthenticated visitor cannot read the journal',
    run: (t) => t.asAnon(() => t.denied(DENIED, 'select * from public.journal_entries')),
  },
  {
    group: 'negative',
    name: "A sees none of B's journal entries, and cannot hang one on B's anchor",
    run: async (t) => {
      const written = await journalAnchor(t, B)
      await t.q(
        `insert into public.journal_entries (owner, item_id, body, journaled_at)
         values ($1, $2, 'Something private', now())`,
        [B, written],
      )
      // A second anchor of B's, with no entry on it: otherwise the primary
      // key refuses the insert before the composite key is ever consulted.
      const bare = await journalAnchor(t, B)
      await t.asA(async () => {
        const { rows } = await t.q('select item_id from public.journal_entries')
        t.require(rows.length === 0, `A saw ${rows.length} of B's journal entries`)
        await t.denied(
          FOREIGN_KEY,
          `insert into public.journal_entries (item_id, body, journaled_at)
           values ($1, 'trying to attach', now())`,
          [bare],
        )
      })
    },
  },
  {
    group: 'positive',
    name: 'A writes an entry with no title, and the anchor is stamped',
    run: (t) =>
      t.asA(async () => {
        const anchor = await t.q(
          `insert into public.items (title, kind, state)
           values ('A note to self', 'journal', 'active') returning id, version`,
        )
        const id = anchor.rows[0].id
        await t.q(
          `insert into public.journal_entries (item_id, body, journaled_at)
           values ($1, 'Wrote this down before I forgot it.', now())`,
          [id],
        )
        const after = await t.q('select version from public.items where id = $1', [id])
        t.require(after.rows[0].version === 2, 'the entry did not stamp its anchor')

        const read = await t.q(
          'select title, body from public.journal_entries where item_id = $1',
          [id],
        )
        t.require(read.rows[0].title === null, 'a title nobody typed should be null')

        // Edited, not made twice: the same upsert path the client's save()
        // takes, keyed on item_id.
        await t.q(
          `insert into public.journal_entries (item_id, body, journaled_at)
           values ($1, 'Edited afterwards.', now())
           on conflict (item_id) do update set body = excluded.body`,
          [id],
        )
        const edited = await t.q(
          'select body from public.journal_entries where item_id = $1',
          [id],
        )
        t.require(edited.rows[0].body === 'Edited afterwards.', 'the edit did not take')
      }),
  },
  {
    group: 'positive',
    name: 'omitting journaled_at succeeds, filled by the column default',
    run: (t) =>
      t.asA(async () => {
        const anchor = await t.q(
          `insert into public.items (title, kind, state)
           values ('A note to self', 'journal', 'active') returning id`,
        )
        const id = anchor.rows[0].id

        // No journaled_at named at all: default now(), not a refusal.
        await t.q(
          `insert into public.journal_entries (item_id, body) values ($1, 'No moment given')`,
          [id],
        )
        const read = await t.q(
          'select journaled_at from public.journal_entries where item_id = $1',
          [id],
        )
        t.require(
          read.rows[0].journaled_at !== null,
          'omitting journaled_at should still leave a real moment, from the default',
        )
      }),
  },
  {
    group: 'constraint',
    name: 'an entry needs a real body, and a real moment, whatever its title',
    run: (t) =>
      t.asA(async () => {
        const anchor = await t.q(
          `insert into public.items (title, kind, state)
           values ('A note to self', 'journal', 'active') returning id`,
        )
        const id = anchor.rows[0].id

        await t.denied(
          CONSTRAINT,
          `insert into public.journal_entries (item_id, body, journaled_at)
           values ($1, '   ', now())`,
          [id],
        )
        await t.denied(
          NOT_NULL,
          `insert into public.journal_entries (item_id, journaled_at) values ($1, now())`,
          [id],
        )
        // The default only fills a journaled_at nobody named. Naming it and
        // handing over NULL explicitly overrides the default and still hits
        // the column's own not-null.
        await t.denied(
          NOT_NULL,
          `insert into public.journal_entries (item_id, body, journaled_at)
           values ($1, 'A real body', null)`,
          [id],
        )
        await t.denied(
          CONSTRAINT,
          `insert into public.journal_entries (item_id, title, body, journaled_at)
           values ($1, '   ', 'A real body', now())`,
          [id],
        )
      }),
  },
  {
    group: 'constraint',
    name: 'a journal anchor cannot be turned into a task, a done item or a Waiting one',
    run: (t) =>
      t.asA(async () => {
        const anchor = await t.q(
          `insert into public.items (title, kind, state)
           values ('A note to self', 'journal', 'active') returning id`,
        )
        const id = anchor.rows[0].id

        await t.denied(CONSTRAINT, 'update public.items set state = $2 where id = $1', [
          id,
          'done',
        ])
        await t.denied(
          CONSTRAINT,
          'update public.items set due = current_date where id = $1',
          [id],
        )
        await t.denied(
          CONSTRAINT,
          'update public.items set done_at = current_date where id = $1',
          [id],
        )
        await t.denied(
          CONSTRAINT,
          'update public.items set waiting_since = current_date where id = $1',
          [id],
        )
      }),
  },
]
