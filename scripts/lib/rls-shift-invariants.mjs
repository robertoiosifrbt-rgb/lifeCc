/**
 * The cases for 20260906060000_shift_invariants: at most one live shift per
 * owner/day/Area, and at most one open session per shift.
 *
 * Separate from rls-shifts.mjs on purpose: that file's guarantee is about the
 * historical, already-live migration. These indexes are new and unapplied,
 * and the day this migration is declared applied is the day these cases
 * prove it did what it was written for — not a day earlier.
 *
 * Setup rows are made by the administrator, with an explicit owner, exactly
 * like every other file's *OwnedBy helpers — `owner` is not a grantable
 * insert column, so the statement actually under test always runs as A
 * without naming it, and relies on the column's own `auth.uid()` default.
 */

import { A } from './rls-context.mjs'

/** Refusal: a key already taken. */
const DUPLICATE = '23505'

/** An area owned by A, made by the administrator. Returns its id. */
async function areaOwnedBy(t, name = 'Business') {
  const { rows } = await t.q(
    'insert into public.areas (owner, name) values ($1, $2) returning id',
    [A, name],
  )
  return rows[0].id
}

/** A shift anchor owned by A, on a given day and Area. Returns its id. */
async function shiftOwnedBy(t, due, area_id) {
  const { rows } = await t.q(
    `insert into public.items (owner, title, kind, state, due, area_id)
     values ($1, 'Shift', 'shift', 'active', $2, $3) returning id`,
    [A, due, area_id],
  )
  return rows[0].id
}

export const CASES = [
  // ── Constraints ─────────────────────────────────────────────────────────
  {
    group: 'constraint',
    name: 'a second live shift for the same owner, day and Area is refused',
    run: async (t) => {
      const area = await areaOwnedBy(t)
      await shiftOwnedBy(t, '2026-09-10', area)
      await t.asA(() =>
        t.denied(
          DUPLICATE,
          `insert into public.items (title, kind, state, due, area_id)
           values ('Shift', 'shift', 'active', $1, $2)`,
          ['2026-09-10', area],
        ),
      )
    },
  },
  {
    group: 'constraint',
    name: 'a second open session on the same shift is refused',
    run: async (t) => {
      const id = await shiftOwnedBy(t, '2026-09-10', null)
      await t.asA(async () => {
        await t.q(
          'insert into public.shift_sessions (item_id, started_at) values ($1, now())',
          [id],
        )
        await t.denied(
          DUPLICATE,
          'insert into public.shift_sessions (item_id, started_at) values ($1, now())',
          [id],
        )
      })
    },
  },

  // ── Positive ────────────────────────────────────────────────────────────
  {
    group: 'positive',
    name: 'a soft-deleted shift does not block a fresh one for the same day and Area',
    run: async (t) => {
      const area = await areaOwnedBy(t)
      const gone = await shiftOwnedBy(t, '2026-09-11', area)
      await t.asA(async () => {
        await t.q('update public.items set deleted_at = now() where id = $1', [gone])
        const again = await t.q(
          `insert into public.items (title, kind, state, due, area_id)
           values ('Shift', 'shift', 'active', $1, $2) returning id`,
          ['2026-09-11', area],
        )
        t.require(again.rows[0].id !== gone, 'the discarded shift blocked the new one')
      })
    },
  },
  {
    group: 'positive',
    name: 'the same day in two different Areas is not a duplicate',
    run: async (t) => {
      const first = await areaOwnedBy(t, 'Business')
      const second = await areaOwnedBy(t, 'Health')
      await shiftOwnedBy(t, '2026-09-12', first)
      await t.asA(async () => {
        const other = await t.q(
          `insert into public.items (title, kind, state, due, area_id)
           values ('Shift', 'shift', 'active', $1, $2) returning id`,
          ['2026-09-12', second],
        )
        t.require(other.rows[0].id !== undefined, 'the second Area was refused too')
      })
    },
  },
  {
    group: 'positive',
    name: 'an unfiled shift (no Area) is never constrained by this at all',
    run: async (t) => {
      await shiftOwnedBy(t, '2026-09-13', null)
      await t.asA(async () => {
        const second = await t.q(
          `insert into public.items (title, kind, state, due)
           values ('Shift', 'shift', 'active', $1) returning id`,
          ['2026-09-13'],
        )
        t.require(second.rows[0].id !== undefined, 'a second unfiled shift was refused')
      })
    },
  },
  {
    group: 'positive',
    name: 'a closed session never blocks the next one from opening',
    run: async (t) => {
      const id = await shiftOwnedBy(t, '2026-09-14', null)
      await t.asA(async () => {
        await t.q(
          `insert into public.shift_sessions (item_id, started_at, ended_at)
           values ($1, now() - interval '3 hours', now() - interval '1 hour')`,
          [id],
        )
        const next = await t.q(
          'insert into public.shift_sessions (item_id, started_at) values ($1, now()) returning id',
          [id],
        )
        t.require(next.rows[0].id !== undefined, 'a session after a closed one was refused')
      })
    },
  },
  {
    group: 'positive',
    name: "the idempotent shifts upsert recovers an item-only shift, then a session finds it",
    run: async (t) => {
      const id = await shiftOwnedBy(t, '2026-09-15', null)
      await t.asA(async () => {
        // No `shifts` row yet — exactly clockOn's recovery path, done by
        // hand: the same no-sync upsert startSessionSafely's ensure half
        // makes (ensureShiftRow, not saveShift — saveShift syncs on its own,
        // which the recovery sequence exists specifically to avoid doing
        // twice for one clock-on).
        const recovered = await t.q(
          `insert into public.shifts (item_id) values ($1)
           on conflict (item_id) do update set item_id = excluded.item_id
           returning odo_start`,
          [id],
        )
        t.require(
          recovered.rows[0].odo_start === null,
          'the recovery touched a field it should not have',
        )
        // Run twice: the whole point is that it never duplicates the row.
        await t.q(
          `insert into public.shifts (item_id) values ($1)
           on conflict (item_id) do update set item_id = excluded.item_id`,
          [id],
        )
        const rows = await t.q('select item_id from public.shifts where item_id = $1', [id])
        t.require(rows.rows.length === 1, `${rows.rows.length} shifts rows for one item`)

        const session = await t.q(
          'insert into public.shift_sessions (item_id, started_at) values ($1, now()) returning id',
          [id],
        )
        t.require(session.rows[0].id !== undefined, 'the session could not attach after recovery')

        // Visible afterwards, not just written: the same join syncShifts
        // does — a `shifts` row joined to its sessions — has to find it, or
        // the recovery only looked successful at the moment of the insert.
        const visible = await t.q(
          `select s.item_id, ss.id as session_id
           from public.shifts s
           join public.shift_sessions ss on ss.item_id = s.item_id
           where s.item_id = $1`,
          [id],
        )
        t.require(visible.rows.length === 1, 'the session did not become visible after recovery')
      })
    },
  },
  {
    group: 'positive',
    name:
      'starting delivery work makes exactly one shift and one running session in the configured Area',
    run: async (t) => {
      const area = await areaOwnedBy(t)
      await t.asA(async () => {
        // The exact sequence startDeliveryWork issues: an item, then the
        // idempotent shifts upsert, then the session.
        const item = await t.q(
          `insert into public.items (title, kind, state, due, area_id)
           values ('Shift', 'shift', 'active', '2026-09-16', $1) returning id`,
          [area],
        )
        const id = item.rows[0].id
        await t.q(
          `insert into public.shifts (item_id) values ($1)
           on conflict (item_id) do update set item_id = excluded.item_id`,
          [id],
        )
        await t.q('insert into public.shift_sessions (item_id, started_at) values ($1, now())', [
          id,
        ])

        const shifts = await t.q(
          `select id from public.items
           where due = '2026-09-16' and area_id = $1 and kind = 'shift' and deleted_at is null`,
          [area],
        )
        t.require(shifts.rows.length === 1, `${shifts.rows.length} shifts made, expected exactly 1`)

        const running = await t.q(
          'select id from public.shift_sessions where item_id = $1 and ended_at is null',
          [id],
        )
        t.require(
          running.rows.length === 1,
          `${running.rows.length} running sessions, expected exactly 1`,
        )
      })
    },
  },
  {
    group: 'positive',
    name: 'resuming a stopped shift makes exactly one new running session, the old one untouched',
    run: async (t) => {
      const id = await shiftOwnedBy(t, '2026-09-17', null)
      await t.asA(async () => {
        await t.q('insert into public.shifts (item_id) values ($1)', [id])
        await t.q(
          `insert into public.shift_sessions (item_id, started_at, ended_at)
           values ($1, now() - interval '3 hours', now() - interval '1 hour')`,
          [id],
        )

        // The exact sequence clockOn/startSessionSafely issues: ensure the
        // extension exists (idempotent, already there), then the session.
        await t.q(
          `insert into public.shifts (item_id) values ($1)
           on conflict (item_id) do update set item_id = excluded.item_id`,
          [id],
        )
        await t.q('insert into public.shift_sessions (item_id, started_at) values ($1, now())', [
          id,
        ])

        const all = await t.q('select id, ended_at from public.shift_sessions where item_id = $1', [
          id,
        ])
        t.require(all.rows.length === 2, `${all.rows.length} sessions total, expected exactly 2`)
        const open = all.rows.filter((row) => row.ended_at === null)
        t.require(open.length === 1, `${open.length} open sessions, expected exactly 1`)
      })
    },
  },
]
