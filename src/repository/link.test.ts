import { describe, expect, it } from 'vitest'

import type { Item } from './item'
import { linkFromRow, liveNeighboursOf, neighboursOf } from './link'
import type { Link } from './link'

function link(id: string, from_id: string, to_id: string, kind = 'about'): Link {
  return linkFromRow({
    id,
    owner: 'a',
    from_id,
    to_id,
    kind,
    created_at: '2026-09-05T10:00:00+00:00',
  })
}

describe('reading an arrow', () => {
  it('refuses a kind nobody named', () => {
    expect(() => link('l1', 'a', 'b', 'concerns')).toThrow(/Unknown kind of link/)
  })

  it('refuses an arrow from an item to itself', () => {
    expect(() => link('l1', 'same', 'same')).toThrow(/to itself/)
  })
})

describe('what one item is joined to', () => {
  // The owner's own sentence: the renewal is about the car and about the
  // insurer, and the £740 pays the renewal.
  const links = [
    link('l1', 'renewal', 'car'),
    link('l2', 'renewal', 'admiral'),
    link('l3', 'money', 'renewal', 'pays'),
  ]

  it('finds arrows drawn from here and arrows drawn at here', () => {
    // Both directions, or the renewal would show the car and give no hint that
    // £740 is attached to it.
    const found = neighboursOf(links, 'renewal')
    expect(found.map((one) => one.otherId)).toEqual(['car', 'admiral', 'money'])
  })

  it('reads the same arrow differently from each end', () => {
    expect(neighboursOf(links, 'money')[0]?.says).toBe('Pays for')
    expect(neighboursOf(links, 'renewal')[2]?.says).toBe('Paid by')
  })

  it('says nothing for an item nothing points at', () => {
    expect(neighboursOf(links, 'lonely')).toEqual([])
  })
})

describe('liveNeighboursOf — a dangling arrow is not a live one', () => {
  function item(id: string, over: Partial<Item> = {}): Item {
    return {
      id, owner: 'a', kind: 'entity', state: 'active', title: id, due: null,
      done_at: null, area_id: null, waiting_since: null, version: 1,
      created_at: '2026-09-05T00:00:00Z', updated_at: '2026-09-05T00:00:00Z',
      deleted_at: null,
      ...over,
    }
  }

  it('drops a neighbour whose own item was soft-deleted, even though the link row survives it', () => {
    // Soft-delete never touches `links` itself, so the renewal's own arrow
    // to the car is still sitting there after the car is gone.
    const links = [link('l1', 'renewal', 'car')]
    const items = [item('renewal'), item('car', { deleted_at: '2026-09-06T00:00:00Z' })]
    expect(liveNeighboursOf(links, items, 'renewal')).toEqual([])
  })

  it('keeps a neighbour whose item is still there', () => {
    const links = [link('l1', 'renewal', 'car')]
    const items = [item('renewal'), item('car')]
    expect(liveNeighboursOf(links, items, 'renewal').map((n) => n.otherId)).toEqual(['car'])
  })
})
