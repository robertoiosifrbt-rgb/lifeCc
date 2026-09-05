import { describe, expect, it } from 'vitest'

import { entityFromRow } from '../../repository/entity'
import type { Item } from '../../repository/item'
import { summarise } from './summary'

const TODAY = '2026-09-05'

function item(id: string, over: Partial<Item> = {}): Item {
  return {
    id,
    owner: 'a',
    kind: 'task',
    state: 'active',
    title: `title ${id}`,
    due: null,
    done_at: null,
    version: 1,
    created_at: '2026-09-01T10:00:00+00:00',
    updated_at: '2026-09-01T10:00:00+00:00',
    deleted_at: null,
    area_id: null,
    ...over,
  }
}

const CAR = entityFromRow({
  item_id: 'car',
  owner: 'a',
  entity_kind: 'vehicle',
  mot_due: '2026-09-08',
  insurance_due: '2026-12-01',
})

describe('the top of the day', () => {
  it('counts what is late, what is landing and what is unsorted', () => {
    const summary = summarise({
      items: [
        item('late', { due: '2026-09-01' }),
        item('soon', { due: '2026-09-07' }),
        item('caught', { state: 'inbox' }),
        item('far', { due: '2026-11-01' }),
      ],
      things: [],
      today: TODAY,
    })
    expect(summary.overdue.map((one) => one.id)).toEqual(['late'])
    expect(summary.coming.map((one) => one.title)).toEqual(['title soon'])
    expect(summary.inbox.map((one) => one.id)).toEqual(['caught'])
  })

  it('puts what a car owes in the same list as a task', () => {
    // From where you are standing they are the same thing: something with a
    // date that costs you if it passes. Keeping cars in a list of their own is
    // what made the MOT invisible until the day it was too late.
    const summary = summarise({
      items: [item('car', { kind: 'entity', title: 'Vivaro' }), item('t', { due: '2026-09-09' })],
      things: [CAR],
      today: TODAY,
    })
    expect(summary.coming.map((one) => one.title)).toEqual([
      'Vivaro — MOT',
      'title t',
    ])
  })

  it('leaves the insurance out until it is inside the week', () => {
    const summary = summarise({
      items: [item('car', { kind: 'entity', title: 'Vivaro' })],
      things: [CAR],
      today: TODAY,
    })
    expect(summary.coming.map((one) => one.title)).not.toContain('Vivaro — Insurance')
  })

  it('keeps a date that has already passed at the top, not out of sight', () => {
    const summary = summarise({
      items: [item('car', { kind: 'entity', title: 'Vivaro' }), item('t', { due: TODAY })],
      things: [CAR],
      today: '2026-09-20',
    })
    expect(summary.coming[0]?.title).toBe('Vivaro — MOT')
    expect(summary.coming[0]?.inDays).toBe(-12)
  })

  it('never counts a car as a thing to do', () => {
    // An entity is permanently active and permanently undated. Counted as a
    // task it would sit in "late" for ever, under a heading that means work.
    const summary = summarise({
      items: [item('car', { kind: 'entity', due: '2020-01-01' })],
      things: [],
      today: TODAY,
    })
    expect(summary.overdue).toEqual([])
    expect(summary.coming).toEqual([])
  })

  it('ignores what has been deleted', () => {
    const summary = summarise({
      items: [item('gone', { due: '2026-09-01', deleted_at: '2026-09-02T10:00:00+00:00' })],
      things: [],
      today: TODAY,
    })
    expect(summary.overdue).toEqual([])
  })
})
