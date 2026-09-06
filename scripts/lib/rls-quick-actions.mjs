/**
 * The cases for quick_actions — what appears on Home, and in what order.
 *
 * The point of this table is the opposite of items and areas: it holds no
 * business data, only a name from a fixed, safe list and the Area context a
 * couple of them need. The database's own check constraints are the second
 * half of "an unknown action_key must never execute" — the client refuses one
 * on the way in, but a row could only ever have gotten here past a policy
 * that let it, so the constraints are what makes that refusal real rather
 * than cosmetic.
 */

import { A, B, CONSTRAINT, DENIED } from './rls-context.mjs'

/** Refusal: a foreign key with nothing to point at. */
const FOREIGN_KEY = '23503'
/** Refusal: a unique index — here, a second live row for the same action. */
const UNIQUE = '23505'

/** An area belonging to someone, made by the administrator. Returns its id. */
async function areaOwnedBy(t, owner, name = 'Business') {
  const { rows } = await t.q(
    'insert into public.areas (owner, name) values ($1, $2) returning id',
    [owner, name],
  )
  return rows[0].id
}

/** A quick_actions row belonging to someone. Returns its id. */
async function quickActionOwnedBy(t, owner, action_key = 'journal.new', area_id = null) {
  const { rows } = await t.q(
    'insert into public.quick_actions (owner, action_key, area_id) values ($1, $2, $3) returning id',
    [owner, action_key, area_id],
  )
  return rows[0].id
}

export const CASES = [
  // ── Negative ────────────────────────────────────────────────────────────
  {
    group: 'negative',
    name: 'an unauthenticated visitor cannot read quick_actions',
    run: (t) => t.asAnon(() => t.denied(DENIED, 'select * from public.quick_actions')),
  },
  {
    group: 'negative',
    name: "A sees none of B's quick_actions",
    run: async (t) => {
      await quickActionOwnedBy(t, B)
      await t.asA(async () => {
        const { rows } = await t.q('select id from public.quick_actions')
        t.require(rows.length === 0, `A saw ${rows.length} of B's quick_actions`)
      })
    },
  },
  {
    group: 'negative',
    name: 'A cannot make a quick_actions row owned by B',
    run: (t) =>
      t.asA(() =>
        t.denied(
          DENIED,
          "insert into public.quick_actions (owner, action_key) values ($1, 'journal.new')",
          [B],
        ),
      ),
  },
  {
    group: 'negative',
    name: 'A cannot rewrite action_key, owner or the stamps',
    run: async (t) => {
      const id = await quickActionOwnedBy(t, A)
      await t.asA(async () => {
        for (const column of ['action_key', 'owner', 'id', 'version', 'created_at', 'updated_at']) {
          await t.denied(
            DENIED,
            `update public.quick_actions set ${column} = ${column} where id = $1`,
            [id],
          )
        }
      })
    },
  },
  {
    group: 'negative',
    name: 'A cannot do a physical DELETE on a quick_actions row',
    run: async (t) => {
      const id = await quickActionOwnedBy(t, A)
      await t.asA(() =>
        t.denied(DENIED, 'delete from public.quick_actions where id = $1', [id]),
      )
    },
  },
  {
    group: 'negative',
    name: "A cannot point delivery.work at B's Area",
    run: async (t) => {
      const theirs = await areaOwnedBy(t, B)
      await t.asA(() =>
        // Not a policy refusing it: there is no row (theirs, A) to point at.
        t.denied(
          FOREIGN_KEY,
          "insert into public.quick_actions (action_key, area_id) values ('delivery.work', $1)",
          [theirs],
        ),
      )
    },
  },

  // ── Positive ────────────────────────────────────────────────────────────
  {
    group: 'positive',
    name: 'A configures journal.new, with no Area at all',
    run: (t) =>
      t.asA(async () => {
        const made = await t.q(
          "insert into public.quick_actions (action_key) values ('journal.new') returning version, area_id",
        )
        t.require(made.rows[0].version === 1, 'the stamp did not write version 1')
        t.require(made.rows[0].area_id === null, 'journal.new was given an Area')
      }),
  },
  {
    group: 'positive',
    name: 'A configures delivery.work under its own Area',
    run: async (t) => {
      const area = await areaOwnedBy(t, A)
      await t.asA(async () => {
        const made = await t.q(
          "insert into public.quick_actions (action_key, area_id) values ('delivery.work', $1) returning area_id",
          [area],
        )
        t.require(made.rows[0].area_id === area, 'delivery.work did not keep its Area')
      })
    },
  },
  {
    group: 'positive',
    name: 'A reorders by moving one action to a rank between its new neighbours, in one write',
    run: async (t) => {
      // Three, at 0/1/2 — the same shape positionForMove works from. Moving
      // the third to sit between the first and the second is one UPDATE, to
      // that row alone; the other two are never touched.
      const first = await quickActionOwnedBy(t, A, 'journal.new')
      const second = await quickActionOwnedBy(t, A, 'money.expense')
      const third = await quickActionOwnedBy(t, A, 'delivery.work', await areaOwnedBy(t, A))
      await t.q('update public.quick_actions set position = 0 where id = $1', [first])
      await t.q('update public.quick_actions set position = 1 where id = $1', [second])
      await t.q('update public.quick_actions set position = 2 where id = $1', [third])
      const before = await t.q(
        'select id, version, position from public.quick_actions where id in ($1, $2, $3)',
        [first, second, third],
      )
      const versionBefore = new Map(before.rows.map((row) => [row.id, row.version]))

      await t.asA(async () => {
        const moved = await t.q(
          'update public.quick_actions set position = 0.5 where id = $1 returning position',
          [third],
        )
        t.require(moved.rows[0].position === 0.5, 'the moved row did not take the midpoint')

        const after = await t.q(
          'select id, version, position from public.quick_actions where id in ($1, $2) order by id',
          [first, second],
        )
        for (const row of after.rows) {
          t.require(
            row.version === versionBefore.get(row.id),
            `${row.id === first ? 'first' : 'second'} changed version on a move that was not its own`,
          )
        }

        const ordered = await t.q(
          `select id from public.quick_actions
           where id in ($1, $2, $3) and deleted_at is null
           order by position`,
          [first, second, third],
        )
        t.require(
          JSON.stringify(ordered.rows.map((r) => r.id)) === JSON.stringify([first, third, second]),
          'the persisted order after the move is wrong',
        )
      })
    },
  },
  {
    group: 'positive',
    name: "A changes a configured delivery.work action's Area, in place",
    run: async (t) => {
      const before = await areaOwnedBy(t, A, 'Business')
      const after = await areaOwnedBy(t, A, 'Health')
      const id = await quickActionOwnedBy(t, A, 'delivery.work', before)
      await t.asA(async () => {
        const changed = await t.q(
          'update public.quick_actions set area_id = $1 where id = $2 returning area_id, version',
          [after, id],
        )
        t.require(changed.rows[0].area_id === after, 'the Area did not change')
        t.require(changed.rows[0].version === 2, 'changing the Area did not stamp the row')
      })
    },
  },
  {
    group: 'positive',
    name: 'A removes one and configures the same action again',
    run: async (t) => {
      const id = await quickActionOwnedBy(t, A, 'journal.new')
      await t.asA(async () => {
        await t.q('update public.quick_actions set deleted_at = now() where id = $1', [id])
        // The removed row does not count towards "already configured": the
        // partial unique index only looks at the rows still alive.
        const again = await t.q(
          "insert into public.quick_actions (action_key) values ('journal.new') returning id",
        )
        t.require(again.rows[0].id !== id, 'a soft-deleted row came back as itself')
      })
    },
  },

  // ── Constraints ─────────────────────────────────────────────────────────
  {
    group: 'constraint',
    name: 'an action_key outside the safe registry is refused',
    run: (t) =>
      t.asA(() =>
        t.denied(
          CONSTRAINT,
          "insert into public.quick_actions (action_key) values ('run.arbitrary.sql')",
        ),
      ),
  },
  {
    group: 'constraint',
    name: 'delivery.work without an Area is refused',
    run: (t) =>
      t.asA(() =>
        t.denied(
          CONSTRAINT,
          "insert into public.quick_actions (action_key) values ('delivery.work')",
        ),
      ),
  },
  {
    group: 'constraint',
    name: 'an Area on an action that does not take one is refused',
    run: async (t) => {
      const area = await areaOwnedBy(t, A)
      await t.asA(() =>
        t.denied(
          CONSTRAINT,
          "insert into public.quick_actions (action_key, area_id) values ('journal.new', $1)",
          [area],
        ),
      )
    },
  },
  {
    group: 'constraint',
    name: 'a second live row for the same action is refused',
    run: (t) =>
      t.asA(async () => {
        await t.q("insert into public.quick_actions (action_key) values ('journal.new')")
        await t.denied(
          UNIQUE,
          "insert into public.quick_actions (action_key) values ('journal.new')",
        )
      }),
  },
]
