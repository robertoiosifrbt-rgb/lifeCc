import { describe, expect, it } from 'vitest'

import type { Item } from './item'
import { namedPlatformsFor } from './platform-record'
import type { PlatformRecord } from './platform-record'

function platform(over: Partial<PlatformRecord> = {}): PlatformRecord {
  return {
    item_id: 'p1',
    owner: 'me',
    active: true,
    display_order: 0,
    earning_cycle_kind: null,
    earning_cycle_starts_on: null,
    payout_schedule: null,
    cashout_enabled: false,
    cashout_settlement: null,
    cashout_fee_type: null,
    cashout_fee_value: null,
    ...over,
  }
}

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'p1',
    owner: 'me',
    kind: 'platform',
    state: 'active',
    title: 'Uber Eats',
    due: null,
    done_at: null,
    area_id: null,
    waiting_since: null,
    version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
    ...over,
  }
}

describe('namedPlatformsFor', () => {
  it('names every active Platform from its own anchor', () => {
    expect(namedPlatformsFor([item()], [platform()], [])).toEqual([{ itemId: 'p1', name: 'Uber Eats' }])
  })

  it('leaves out an inactive Platform nothing already references', () => {
    expect(namedPlatformsFor([item()], [platform({ active: false })], [])).toEqual([])
  })

  it('keeps an inactive Platform that an existing earning already names', () => {
    expect(namedPlatformsFor([item()], [platform({ active: false })], ['p1'])).toEqual([
      { itemId: 'p1', name: 'Uber Eats' },
    ])
  })

  it('leaves out a Platform whose anchor is soft-deleted', () => {
    expect(namedPlatformsFor([item({ deleted_at: '2026-01-02T00:00:00Z' })], [platform()], [])).toEqual([])
  })

  it('active first, then by display order', () => {
    const platforms = [
      platform({ item_id: 'p2', active: true, display_order: 2 }),
      platform({ item_id: 'p3', active: false, display_order: 0 }),
      platform({ item_id: 'p1', active: true, display_order: 1 }),
    ]
    const items = [
      item({ id: 'p1', title: 'A' }),
      item({ id: 'p2', title: 'B' }),
      item({ id: 'p3', title: 'C' }),
    ]
    expect(namedPlatformsFor(items, platforms, ['p3']).map((p) => p.itemId)).toEqual(['p1', 'p2', 'p3'])
  })

  it('never lists the same Platform twice, active and also named by an existing earning', () => {
    expect(namedPlatformsFor([item()], [platform()], ['p1'])).toEqual([{ itemId: 'p1', name: 'Uber Eats' }])
  })
})
