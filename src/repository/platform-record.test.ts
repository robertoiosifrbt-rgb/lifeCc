import { describe, expect, it } from 'vitest'

import type { Item } from './item'
import { currentPlatformRuleOf, namedPlatformsFor, platformRuleFromRow } from './platform-record'
import type { PlatformRecord, PlatformRule } from './platform-record'

function rule(over: Partial<PlatformRule> = {}): PlatformRule {
  return {
    platform_item_id: 'p1',
    owner: 'me',
    effective_from: '2026-01-01',
    earning_cycle_kind: null,
    earning_cycle_starts_on: null,
    payout_schedule: null,
    cashout_enabled: false,
    cashout_settlement: null,
    cashout_fee_type: null,
    cashout_fee_value: null,
    payout_destination_reference: null,
    version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
    ...over,
  }
}

function platform(over: Partial<PlatformRecord> = {}): PlatformRecord {
  return {
    item_id: 'p1',
    owner: 'me',
    active: true,
    display_order: 0,
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

describe('platformRuleFromRow', () => {
  it('refuses a row without an effective date', () => {
    const raw = { ...rule(), effective_from: undefined }
    expect(() => platformRuleFromRow(raw)).toThrow('without an effective date')
  })

  it('refuses an unknown cash-out fee type', () => {
    expect(() => platformRuleFromRow({ ...rule(), cashout_fee_type: 'crypto' })).toThrow(
      'Unknown cash-out fee type',
    )
  })
})

describe('currentPlatformRuleOf', () => {
  it('none when this Platform has never had a rule', () => {
    expect(currentPlatformRuleOf([], 'p1', '2026-06-01')).toBeNull()
  })

  it('the newest rule not yet in the future — never a later one, never a stale one', () => {
    const rules = [
      rule({ effective_from: '2026-01-01', payout_schedule: 'weekly' }),
      rule({ effective_from: '2026-06-01', payout_schedule: 'daily' }),
      rule({ effective_from: '2026-12-01', payout_schedule: 'monthly' }),
    ]
    expect(currentPlatformRuleOf(rules, 'p1', '2026-06-15')?.payout_schedule).toBe('daily')
  })

  it('a change today never rewrites what an earlier date was assessed against', () => {
    const rules = [rule({ effective_from: '2026-01-01', payout_schedule: 'weekly' })]
    expect(currentPlatformRuleOf(rules, 'p1', '2025-12-01')).toBeNull()
  })

  it('ignores a soft-deleted (invalidated) rule', () => {
    const rules = [rule({ effective_from: '2026-01-01', deleted_at: '2026-02-01T00:00:00Z' })]
    expect(currentPlatformRuleOf(rules, 'p1', '2026-06-01')).toBeNull()
  })

  it('ignores another Platform’s rule entirely', () => {
    const rules = [rule({ platform_item_id: 'p2' })]
    expect(currentPlatformRuleOf(rules, 'p1', '2026-06-01')).toBeNull()
  })
})
