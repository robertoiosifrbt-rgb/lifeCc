import { describe, expect, it } from 'vitest'

import { linkFromRow, neighboursOf } from './link'
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
