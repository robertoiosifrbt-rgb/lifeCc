/**
 * The extra column-level guarantees on quick_actions, split out of
 * rls-quick-actions.mjs once the two grew past the 300-line limit together:
 * the position rank must stay finite, and a custom label must never be
 * blank — both refused by the database directly, not only by the client.
 *
 * positionForMove and nextPositionOf both refuse to compute a non-finite
 * rank in JavaScript — proven in quick-action.test.ts. What is proven here
 * instead is that the same three values are refused by Postgres itself for
 * any write that reaches the position column directly, since an
 * authenticated client has column-level UPDATE/INSERT access to it and a
 * unit test of fromRow alone cannot show what the database does. The same
 * reasoning applies to label: normalizeLabel refuses a blank one on the
 * client, but the column itself is just as directly writable.
 */

import { CONSTRAINT } from './rls-context.mjs'

export const CASES = [
  {
    group: 'constraint',
    name: 'a NaN position is refused',
    run: (t) =>
      t.asA(() =>
        t.denied(
          CONSTRAINT,
          "insert into public.quick_actions (action_key, position) values ('journal.new', 'nan'::double precision)",
        ),
      ),
  },
  {
    group: 'constraint',
    name: 'a +Infinity position is refused',
    run: (t) =>
      t.asA(() =>
        t.denied(
          CONSTRAINT,
          "insert into public.quick_actions (action_key, position) values ('journal.new', 'infinity'::double precision)",
        ),
      ),
  },
  {
    group: 'constraint',
    name: 'a -Infinity position is refused',
    run: (t) =>
      t.asA(() =>
        t.denied(
          CONSTRAINT,
          "insert into public.quick_actions (action_key, position) values ('journal.new', '-infinity'::double precision)",
        ),
      ),
  },
  {
    group: 'constraint',
    name: 'a blank or whitespace-only label is refused',
    run: (t) =>
      t.asA(async () => {
        await t.denied(
          CONSTRAINT,
          "insert into public.quick_actions (action_key, label) values ('journal.new', '')",
        )
        await t.denied(
          CONSTRAINT,
          "insert into public.quick_actions (action_key, label) values ('journal.new', '   ')",
        )
      }),
  },
  {
    group: 'positive',
    name: 'a real custom label is kept, and clearing it back to null is a normal update',
    run: (t) =>
      t.asA(async () => {
        const made = await t.q(
          "insert into public.quick_actions (action_key, label) values ('journal.new', 'Uber run') returning id, label",
        )
        t.require(made.rows[0].label === 'Uber run', 'the custom label was not kept')

        const cleared = await t.q(
          'update public.quick_actions set label = null where id = $1 returning label',
          [made.rows[0].id],
        )
        t.require(cleared.rows[0].label === null, 'clearing the label back to null was refused')
      }),
  },
]
