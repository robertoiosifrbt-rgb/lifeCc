import { describe, expect, it, vi } from 'vitest'

import { fromRow as areaFromRow } from '../repository/area'
import type { Area } from '../repository/area'
import { fromRow as itemFromRow } from '../repository/item'
import type { Item } from '../repository/item'
import { shiftFromRow } from '../repository/shift'
import type { Shift } from '../repository/shift'
import { deliveryLabel, deliveryStateOf, runDeliveryAction } from './deliveryQuickAction'

const TODAY = '2026-09-06'
const AREA = 'area-1'
const OTHER_AREA = 'area-2'

const GOOD_ITEM = {
  id: 'i1',
  owner: 'a',
  kind: 'shift',
  state: 'active',
  title: 'Shift',
  due: TODAY,
  done_at: null,
  version: 1,
  created_at: '2026-09-06T07:00:00+00:00',
  updated_at: '2026-09-06T07:00:00+00:00',
  deleted_at: null,
  area_id: AREA,
  waiting_since: null,
}

const GOOD_AREA = {
  id: AREA,
  owner: 'a',
  parent_id: null,
  name: 'Business',
  version: 1,
  created_at: '2026-09-05T07:00:00+00:00',
  updated_at: '2026-09-05T07:00:00+00:00',
  deleted_at: null,
}

function shift(item_id: string, over: Partial<Shift> = {}): Shift {
  return {
    ...shiftFromRow({ item_id, owner: 'a' }, [], []),
    ...over,
  }
}

function items(...over: Partial<Item>[]): Item[] {
  return over.map((one, index) =>
    itemFromRow({ ...GOOD_ITEM, id: `i${index + 1}`, ...one }),
  )
}

function area(id: string, over: Partial<Area> = {}): Area {
  return { ...areaFromRow(GOOD_AREA), id, ...over }
}

/** The Area this Quick Action is configured for, alive and in the tree. */
const LIVE_AREA = [area(AREA)]

describe('deliveryStateOf', () => {
  it('says start when no shift matches the day and the configured Area', () => {
    expect(deliveryStateOf([], [], LIVE_AREA, AREA, TODAY)).toEqual({ kind: 'start' })
  })

  it('is not fooled by a shift on the right day but the wrong Area', () => {
    const wrongArea = items({ area_id: OTHER_AREA })
    expect(deliveryStateOf(wrongArea, [], LIVE_AREA, AREA, TODAY)).toEqual({ kind: 'start' })
  })

  it('is not fooled by a shift in the right Area on a different day', () => {
    const wrongDay = items({ due: '2026-09-05' })
    expect(deliveryStateOf(wrongDay, [], LIVE_AREA, AREA, TODAY)).toEqual({ kind: 'start' })
  })

  it('ignores a deleted shift that would otherwise match', () => {
    const gone = items({ deleted_at: '2026-09-06T08:00:00+00:00' })
    expect(deliveryStateOf(gone, [], LIVE_AREA, AREA, TODAY)).toEqual({ kind: 'start' })
  })

  it('says resume when the matching shift has nobody currently out', () => {
    const day = items({})
    const parts = [shift('i1')]
    expect(deliveryStateOf(day, parts, LIVE_AREA, AREA, TODAY)).toEqual({
      kind: 'resume',
      shiftId: 'i1',
    })
  })

  it('never starts a session from an unknown state: missing shift parts must OPEN, not resume', () => {
    // A shift item can arrive locally before its `shifts` row has synced.
    // That is not proof nobody is out — it is exactly the gap that would
    // let a second session start on top of one already running elsewhere.
    const day = items({})
    expect(deliveryStateOf(day, [], LIVE_AREA, AREA, TODAY)).toEqual({
      kind: 'open',
      shiftId: 'i1',
    })
  })

  it('says open when a session is currently running', () => {
    const day = items({})
    const parts = [
      shift('i1', {
        sessions: [{ id: 's1', started_at: '2026-09-06T09:00:00Z', ended_at: null, break_minutes: 0 }],
      }),
    ]
    expect(deliveryStateOf(day, parts, LIVE_AREA, AREA, TODAY)).toEqual({
      kind: 'open',
      shiftId: 'i1',
    })
  })

  it('says resume, not open, once every session of the day has ended', () => {
    const day = items({})
    const parts = [
      shift('i1', {
        sessions: [
          {
            id: 's1',
            started_at: '2026-09-06T09:00:00Z',
            ended_at: '2026-09-06T12:00:00Z',
            break_minutes: 0,
          },
        ],
      }),
    ]
    expect(deliveryStateOf(day, parts, LIVE_AREA, AREA, TODAY)).toEqual({
      kind: 'resume',
      shiftId: 'i1',
    })
  })

  it('is unavailable when the configured Area is not in the tree at all', () => {
    expect(deliveryStateOf([], [], [], AREA, TODAY)).toEqual({ kind: 'unavailable' })
  })

  it('is unavailable when the configured Area itself was deleted', () => {
    const deletedArea = [area(AREA, { deleted_at: '2026-09-06T08:00:00+00:00' })]
    expect(deliveryStateOf([], [], deletedArea, AREA, TODAY)).toEqual({ kind: 'unavailable' })
  })

  it('is unavailable when an ancestor of the configured Area was deleted', () => {
    const parent = area('parent', { deleted_at: '2026-09-06T08:00:00+00:00' })
    const child = area(AREA, { parent_id: 'parent' })
    expect(deliveryStateOf([], [], [parent, child], AREA, TODAY)).toEqual({
      kind: 'unavailable',
    })
  })

  it('does not even look for a shift once the Area is unavailable', () => {
    // A matching shift existing is irrelevant once the context it would run
    // in is gone — this must report unavailable regardless.
    const day = items({})
    const parts = [shift('i1')]
    expect(deliveryStateOf(day, parts, [], AREA, TODAY)).toEqual({ kind: 'unavailable' })
  })
})

describe('deliveryLabel', () => {
  it('spells out the domain, since Home sits outside it, with no custom label', () => {
    expect(deliveryLabel({ kind: 'start' }, null)).toBe('Start delivery work')
    expect(deliveryLabel({ kind: 'resume', shiftId: 'i1' }, null)).toBe('Resume delivery work')
    expect(deliveryLabel({ kind: 'open', shiftId: 'i1' }, null)).toBe('Open delivery shift')
    expect(deliveryLabel({ kind: 'unavailable' }, null)).toBe('Delivery work needs an Area')
  })

  it('puts a configured custom label after the verb the state decided, not instead of it', () => {
    expect(deliveryLabel({ kind: 'start' }, 'Uber run')).toBe('Start Uber run')
    expect(deliveryLabel({ kind: 'resume', shiftId: 'i1' }, 'Uber run')).toBe('Resume Uber run')
    expect(deliveryLabel({ kind: 'open', shiftId: 'i1' }, 'Uber run')).toBe('Open Uber run')
  })

  it('never lets a custom label affect the unavailable message — a system fact, not a subject', () => {
    expect(deliveryLabel({ kind: 'unavailable' }, 'Uber run')).toBe('Delivery work needs an Area')
  })
})

// The decision QuickActionsRow's own click handler makes, proven here
// instead of only by reading the component: which of the two writes a
// resolved state may call, and that the other one is never touched.
describe('runDeliveryAction', () => {
  const EXISTING = items({})[0]!

  function effects() {
    return {
      startDeliveryWork: vi.fn(() => Promise.resolve(items({ id: 'fresh' })[0]!)),
      clockOn: vi.fn(() => Promise.resolve(undefined)),
    }
  }

  it('start calls startDeliveryWork alone, and returns what it made', async () => {
    const fx = effects()
    const result = await runDeliveryAction({ kind: 'start' }, AREA, TODAY, null, fx)
    expect(fx.startDeliveryWork).toHaveBeenCalledExactlyOnceWith(TODAY, AREA)
    expect(fx.clockOn).not.toHaveBeenCalled()
    expect(result.id).toBe('fresh')
  })

  it('resume calls clockOn alone, on the existing shift, and returns it', async () => {
    const fx = effects()
    const result = await runDeliveryAction(
      { kind: 'resume', shiftId: EXISTING.id },
      AREA,
      TODAY,
      EXISTING,
      fx,
    )
    expect(fx.clockOn).toHaveBeenCalledExactlyOnceWith(EXISTING.id)
    expect(fx.startDeliveryWork).not.toHaveBeenCalled()
    expect(result).toBe(EXISTING)
  })

  it('open calls neither — no new session, and nothing new made', async () => {
    const fx = effects()
    const result = await runDeliveryAction(
      { kind: 'open', shiftId: EXISTING.id },
      AREA,
      TODAY,
      EXISTING,
      fx,
    )
    expect(fx.clockOn).not.toHaveBeenCalled()
    expect(fx.startDeliveryWork).not.toHaveBeenCalled()
    expect(result).toBe(EXISTING)
  })

  it('refuses to resume or open onto a row it was not given', async () => {
    const fx = effects()
    await expect(
      runDeliveryAction({ kind: 'resume', shiftId: 'i1' }, AREA, TODAY, null, fx),
    ).rejects.toThrow('could not be found')
    // Refusing to guess still means it never started a session on nothing.
    expect(fx.clockOn).not.toHaveBeenCalled()
  })
})
