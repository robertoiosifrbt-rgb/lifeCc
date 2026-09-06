import { describe, expect, it } from 'vitest'

import { countUnder, fromRow, pathOf, settingsPatch, subtreeOf, treeOf } from './area'
import type { Area } from './area'

const GOOD_ROW = {
  id: 'a1',
  owner: 'me',
  parent_id: null,
  name: 'Business',
  version: 1,
  created_at: '2026-09-05T07:00:00+00:00',
  updated_at: '2026-09-05T07:00:00+00:00',
  deleted_at: null,
}

function area(id: string, over: Partial<Area> = {}): Area {
  return { ...fromRow(GOOD_ROW), id, name: `area ${id}`, ...over }
}

describe('fromRow', () => {
  it('accepts a whole row', () => {
    expect(fromRow(GOOD_ROW)).toEqual(GOOD_ROW)
  })

  it('refuses a name of nothing but spaces, as the database does', () => {
    expect(() => fromRow({ ...GOOD_ROW, name: '   ' })).toThrow('nothing but spaces')
  })

  it('refuses an area that is its own parent', () => {
    expect(() => fromRow({ ...GOOD_ROW, parent_id: 'a1' })).toThrow('its own parent')
  })

  it('refuses a version the trigger could never have written', () => {
    expect(() => fromRow({ ...GOOD_ROW, version: 0 })).toThrow('below one')
    expect(() => fromRow({ ...GOOD_ROW, version: 1.5 })).toThrow('without version')
  })

  it('refuses a row missing a stamp', () => {
    const rest: Record<string, unknown> = { ...GOOD_ROW }
    delete rest['created_at']
    expect(() => fromRow(rest)).toThrow('created_at')
  })
})

describe('treeOf', () => {
  it('walks the owner tree, deepest path in order, with its depth', () => {
    const business = area('b', { name: 'Business' })
    const employed = area('s', { name: 'Self-employed', parent_id: 'b' })
    const delivery = area('d', { name: 'MultiApp Delivery', parent_id: 's' })

    expect(treeOf([delivery, business, employed])).toEqual([
      { area: business, depth: 0 },
      { area: employed, depth: 1 },
      { area: delivery, depth: 2 },
    ])
  })

  it('sorts what sits side by side, so the order does not wander', () => {
    const home = area('h', { name: 'Home' })
    const business = area('b', { name: 'Business' })

    expect(treeOf([home, business]).map((row) => row.area.name)).toEqual([
      'Business',
      'Home',
    ])
  })

  it('leaves out a deleted area, and everything under it', () => {
    const business = area('b', {
      name: 'Business',
      deleted_at: '2026-09-05T08:00:00+00:00',
    })
    const employed = area('s', { name: 'Self-employed', parent_id: 'b' })

    // Not raised to the root. An area whose parent is gone has nowhere to be
    // shown, and quietly reparenting it is how a tree starts lying.
    expect(treeOf([business, employed])).toEqual([])
  })
})

describe('pathOf', () => {
  it('names every step from the root down', () => {
    const areas = [
      area('b', { name: 'Business' }),
      area('s', { name: 'Self-employed', parent_id: 'b' }),
      area('d', { name: 'MultiApp Delivery', parent_id: 's' }),
    ]
    expect(pathOf(areas, 'd')).toBe('Business › Self-employed › MultiApp Delivery')
  })

  it('gives back nothing for an area that is not there', () => {
    expect(pathOf([area('b')], 'gone')).toBe('')
  })
})

describe('countUnder', () => {
  const areas = [
    area('b', { name: 'Business' }),
    area('s', { name: 'Self-employed', parent_id: 'b' }),
    area('d', { name: 'MultiApp Delivery', parent_id: 's' }),
    area('h', { name: 'Home' }),
  ]

  it('counts every depth below, not only the children', () => {
    expect(countUnder(areas, 'b')).toBe(2)
    expect(countUnder(areas, 's')).toBe(1)
  })

  it('counts nothing under a leaf, or under an area that is not there', () => {
    expect(countUnder(areas, 'd')).toBe(0)
    expect(countUnder(areas, 'h')).toBe(0)
    expect(countUnder(areas, 'gone')).toBe(0)
  })

  it('stops at the next branch instead of running into it', () => {
    // Home follows the Business branch in the walk; it is not under it.
    expect(countUnder(areas, 'b')).toBe(2)
  })
})

describe('subtreeOf', () => {
  const areas = [
    area('b', { name: 'Business' }),
    area('s', { name: 'Self-employed', parent_id: 'b' }),
    area('d', { name: 'MultiApp Delivery', parent_id: 's' }),
    area('h', { name: 'Home' }),
  ]

  it('includes the area itself and everything under it, not a sibling branch', () => {
    expect(subtreeOf(areas, 'b')).toEqual(['b', 's', 'd'])
    expect(subtreeOf(areas, 's')).toEqual(['s', 'd'])
  })

  it('is just the area itself for a leaf, or for one that is not there', () => {
    expect(subtreeOf(areas, 'd')).toEqual(['d'])
    expect(subtreeOf(areas, 'h')).toEqual(['h'])
    expect(subtreeOf(areas, 'gone')).toEqual(['gone'])
  })
})

// A settings save is one version-checked write, not two: a patch carrying a
// changed name and a changed parent together is exactly what stops the
// second of two sequential saves from discarding whatever the first one did
// not carry. And a blank name makes the whole form unsaveable, rather than
// quietly dropping the name while a changed parent slips through underneath
// it — the same partial save by another route.
describe('settingsPatch', () => {
  const business = area('b', { name: 'Business', parent_id: null })

  it('carries a changed name and a changed parent together, in one patch', () => {
    expect(settingsPatch(business, 'Business Ltd', 's')).toEqual({
      name: 'Business Ltd',
      parent_id: 's',
    })
  })

  it('carries only the parent, when only the parent changed', () => {
    expect(settingsPatch(business, 'Business', 's')).toEqual({ parent_id: 's' })
  })

  it('carries only the name, when only the name changed', () => {
    expect(settingsPatch(business, 'Business Ltd', null)).toEqual({ name: 'Business Ltd' })
  })

  it('is empty when neither changed', () => {
    expect(settingsPatch(business, 'Business', null)).toEqual({})
  })

  it('refuses the whole save on a blank name, even with a changed parent', () => {
    expect(settingsPatch(business, '   ', 's')).toBeNull()
    expect(settingsPatch(business, '', 's')).toBeNull()
  })
})
