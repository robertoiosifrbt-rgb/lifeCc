import { describe, expect, it } from 'vitest'

import {
  fromRow,
  needsArea,
  nextPositionOf,
  normalizeLabel,
  orderedOf,
  positionForMove,
} from './quick-action'
import type { QuickAction } from './quick-action'

const GOOD_ROW = {
  id: 'q1',
  owner: 'a',
  action_key: 'journal.new',
  area_id: null,
  position: 0,
  label: null,
  version: 1,
  created_at: '2026-09-06T07:00:00+00:00',
  updated_at: '2026-09-06T07:00:00+00:00',
  deleted_at: null,
}

function action(id: string, over: Partial<QuickAction> = {}): QuickAction {
  return { ...fromRow(GOOD_ROW), id, ...over }
}

describe('fromRow', () => {
  it('accepts a whole row', () => {
    expect(fromRow(GOOD_ROW)).toEqual(GOOD_ROW)
  })

  it('refuses an action_key outside the safe registry', () => {
    expect(() => fromRow({ ...GOOD_ROW, action_key: 'run.arbitrary.sql' })).toThrow(
      'Unknown quick action',
    )
  })

  it('refuses delivery.work without an Area, as the database does', () => {
    expect(() =>
      fromRow({ ...GOOD_ROW, action_key: 'delivery.work', area_id: null }),
    ).toThrow('without its Area')
  })

  it('refuses an Area on an action that does not take one', () => {
    expect(() => fromRow({ ...GOOD_ROW, action_key: 'journal.new', area_id: 'x' })).toThrow(
      'does not take an Area',
    )
    expect(() =>
      fromRow({ ...GOOD_ROW, action_key: 'money.expense', area_id: 'x' }),
    ).toThrow('does not take an Area')
  })

  it('accepts delivery.work with its Area', () => {
    const parsed = fromRow({ ...GOOD_ROW, action_key: 'delivery.work', area_id: 'x' })
    expect(parsed.action_key).toBe('delivery.work')
    expect(parsed.area_id).toBe('x')
  })

  it('refuses a row without a position', () => {
    const trimmed: Record<string, unknown> = { ...GOOD_ROW }
    delete trimmed['position']
    expect(() => fromRow(trimmed)).toThrow('Row without position')
  })

  it('refuses an infinite position', () => {
    expect(() => fromRow({ ...GOOD_ROW, position: Infinity })).toThrow('non-finite position')
    expect(() => fromRow({ ...GOOD_ROW, position: -Infinity })).toThrow('non-finite position')
  })

  it('refuses a NaN position', () => {
    // Caught earlier, by optionalNumber's own guard — still refused, just
    // under a different message than the Infinity case above.
    expect(() => fromRow({ ...GOOD_ROW, position: NaN })).toThrow('is not a number')
  })

  it('accepts a null label — the code-defined default applies', () => {
    expect(fromRow({ ...GOOD_ROW, label: null }).label).toBeNull()
  })

  it('accepts a real custom label', () => {
    expect(fromRow({ ...GOOD_ROW, label: 'Uber run' }).label).toBe('Uber run')
  })

  it('refuses a blank or whitespace-only label, the same as the database does', () => {
    expect(() => fromRow({ ...GOOD_ROW, label: '' })).toThrow('blank label')
    expect(() => fromRow({ ...GOOD_ROW, label: '   ' })).toThrow('blank label')
  })
})

describe('normalizeLabel', () => {
  it('trims a real label', () => {
    expect(normalizeLabel('  Uber run  ')).toBe('Uber run')
  })

  it('turns blank or whitespace-only input into null — clearing the field, not an error', () => {
    expect(normalizeLabel('')).toBeNull()
    expect(normalizeLabel('   ')).toBeNull()
    expect(normalizeLabel('\t\n')).toBeNull()
  })
})

describe('needsArea', () => {
  it('is true for delivery.work alone', () => {
    expect(needsArea('delivery.work')).toBe(true)
    expect(needsArea('journal.new')).toBe(false)
    expect(needsArea('money.expense')).toBe(false)
  })
})

describe('orderedOf', () => {
  it('sorts by position and drops anything removed', () => {
    const gone = action('g', { position: 0, deleted_at: '2026-09-06T08:00:00+00:00' })
    const second = action('b', { position: 2 })
    const first = action('a', { position: 1 })
    expect(orderedOf([gone, second, first]).map((row) => row.id)).toEqual(['a', 'b'])
  })

  it('breaks a position collision by id, deterministically, not by array input order', () => {
    // Two devices, appending from the same stale snapshot, can both compute
    // the same "one past the highest configured so far". The order Home
    // shows must not then depend on which one this array happens to list
    // first.
    const first = action('bbb', { position: 1 })
    const second = action('aaa', { position: 1 })
    expect(orderedOf([first, second]).map((row) => row.id)).toEqual(['aaa', 'bbb'])
    expect(orderedOf([second, first]).map((row) => row.id)).toEqual(['aaa', 'bbb'])
  })
})

describe('nextPositionOf', () => {
  it('is 0 for the first action, and after the highest one configured otherwise', () => {
    expect(nextPositionOf([])).toBe(0)
    expect(nextPositionOf([action('a', { position: 0 }), action('b', { position: 5 })])).toBe(6)
  })

  it('refuses when the current maximum is too large for +1 to move past it', () => {
    // 2**53 is the point where double precision stops being able to tell a
    // whole number and its neighbour apart: 2**53 + 1 === 2**53 in this exact
    // arithmetic, so a plain "+1" here would silently land a new row on top
    // of the existing maximum instead of genuinely after it.
    const huge = 2 ** 53
    expect(huge + 1).toBe(huge)
    expect(nextPositionOf([action('a', { position: huge })])).toBeNull()
  })
})

// Reordering is one write, to the moved row alone: its new position is a
// rank between its new neighbours, so nothing beside it ever changes. A
// conflict on that one write leaves the list exactly as it was — there is
// no second row a "half-swap" could still be sitting in.
describe('positionForMove', () => {
  const a = action('a', { position: 0 })
  const b = action('b', { position: 1 })
  const c = action('c', { position: 2 })
  const ordered = [a, b, c]

  it('moves a middle row up, and the persisted order reflects it', () => {
    const position = positionForMove(ordered, 'b', 'up')
    expect(position).not.toBeNull()
    const moved = { ...b, position: position! }
    expect(orderedOf([a, moved, c]).map((row) => row.id)).toEqual(['b', 'a', 'c'])
  })

  it('moves a middle row down, and the persisted order reflects it', () => {
    const position = positionForMove(ordered, 'b', 'down')
    expect(position).not.toBeNull()
    const moved = { ...b, position: position! }
    expect(orderedOf([a, moved, c]).map((row) => row.id)).toEqual(['a', 'c', 'b'])
  })

  it('is a no-op moving the first row up, or the last row down', () => {
    expect(positionForMove(ordered, 'a', 'up')).toBeNull()
    expect(positionForMove(ordered, 'c', 'down')).toBeNull()
  })

  it('is a no-op for an id that is not in the list', () => {
    expect(positionForMove(ordered, 'gone', 'up')).toBeNull()
  })

  it('places the moved row between the same two neighbours every time, not just past one of them', () => {
    // Moving 'c' up past 'b' must land it between 'a' and 'b', not merely
    // above 'b' — otherwise a second "up" move could reorder it past 'a'
    // without ever touching 'a' or 'b's own rows.
    const position = positionForMove(ordered, 'c', 'up')!
    expect(position).toBeGreaterThan(a.position)
    expect(position).toBeLessThan(b.position)
  })

  it('only ever computes a new value for the moved row — the neighbours are read, never written', () => {
    // The whole point of a rank-based move: nothing about 'a' or 'c' needs
    // to change for 'b' to move. Proven by construction — positionForMove
    // returns a single number for the moved id, with no way to express a
    // second row's update at all.
    const position = positionForMove(ordered, 'b', 'up')
    expect(typeof position).toBe('number')
  })

  describe('when a rank collision is in the way', () => {
    // b and c collide on position 1 — orderedOf's own tie-break (by id)
    // decides they sit b, then c. d moving up would need to land strictly
    // between b and c, and there is no such value: refusing is the honest
    // answer, not a midpoint that equals one of them and quietly does
    // nothing.
    const withCollision = orderedOf([
      action('a', { position: 0 }),
      action('b', { position: 1 }),
      action('c', { position: 1 }),
      action('d', { position: 2 }),
    ])

    it('refuses to move up into a collision it cannot land inside of', () => {
      expect(positionForMove(withCollision, 'd', 'up')).toBeNull()
    })

    it('refuses to move down into the same collision from the other side', () => {
      expect(positionForMove(withCollision, 'a', 'down')).toBeNull()
    })

    it('still moves normally when the collision is not in the way', () => {
      // b can still move up past a — the collision is between b and c, not
      // between a and b.
      const position = positionForMove(withCollision, 'b', 'up')
      expect(position).not.toBeNull()
      expect(position).toBeLessThan(0)
    })

    it('stops refusing once the collision is broken by an unrelated move', () => {
      const bMoved = positionForMove(withCollision, 'b', 'up')!
      const resolved = orderedOf([
        action('a', { position: 0 }),
        { ...withCollision[1]!, position: bMoved },
        action('c', { position: 1 }),
        action('d', { position: 2 }),
      ])
      expect(positionForMove(resolved, 'd', 'up')).not.toBeNull()
    })
  })

  describe('when the floating-point midpoint collapses onto a neighbour', () => {
    // Two adjacent doubles can be distinct — a !== b — while their computed
    // average rounds back to exactly one of them: (1 + (1+Number.EPSILON))
    // / 2 === 1. Equality-only collision checks miss this entirely, since
    // before.position !== target.position here. A move that "succeeds" onto
    // that rounded value would land exactly on a neighbour it was never
    // meant to collide with, so this must refuse the same as a real
    // collision does, even though the two ranks are not equal.
    const near = 1 + Number.EPSILON
    const collapsing = [
      action('a', { position: 0 }),
      action('b', { position: 1 }),
      action('c', { position: near }),
      action('d', { position: 2 }),
    ]

    it('refuses to move up into a midpoint that rounds onto its lower neighbour', () => {
      expect(positionForMove(collapsing, 'd', 'up')).toBeNull()
    })

    it('refuses to move down into the same collapsing midpoint from the other side', () => {
      expect(positionForMove(collapsing, 'a', 'down')).toBeNull()
    })

    it('still moves normally once the ranks are far enough apart to have a real midpoint', () => {
      const spread = [action('a', { position: 0 }), action('b', { position: 1 }), action('c', { position: 3 })]
      const position = positionForMove(spread, 'c', 'up')
      expect(position).not.toBeNull()
      expect(position).toBeGreaterThan(0)
      expect(position).toBeLessThan(1)
    })
  })
})
